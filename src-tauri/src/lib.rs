use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

use serde_json::{json, Value};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tokio::sync::Mutex;

const QUERY: &str = r#"
query widget($u: String!, $year: Int) {
  matchedUser(username: $u) {
    username
    submitStats { acSubmissionNum { difficulty count } }
    userCalendar(year: $year) { activeYears streak totalActiveDays submissionCalendar }
    badges { id displayName icon creationDate category }
  }
  allQuestionsCount { difficulty count }
  userProfileUserQuestionProgressV2(userSlug: $u) {
    numFailedQuestions { difficulty count }
  }
  recentAcSubmissionList(username: $u, limit: 20) { id title titleSlug timestamp }
}"#;

struct State {
    client: reqwest::Client,
    // Holding this lock across the network call de-duplicates concurrent requests:
    // the second caller waits, then finds a fresh cache entry.
    cache: Mutex<HashMap<String, (Instant, Value)>>,
}

#[tauri::command]
async fn fetch_profile(
    state: tauri::State<'_, State>,
    username: String,
    year: Option<i32>,
    force: bool,
) -> Result<Value, String> {
    let key = format!("{}:{}", username.to_lowercase(), year.unwrap_or(0));
    let mut cache = state.cache.lock().await;
    // Normal polls are cached 30s; even a manual refresh is throttled to once per 8s.
    let ttl = Duration::from_secs(if force { 8 } else { 30 });
    if let Some((at, v)) = cache.get(&key) {
        if at.elapsed() < ttl {
            return Ok(v.clone());
        }
    }

    let body = json!({ "query": QUERY, "variables": { "u": username, "year": year } });
    let resp = state
        .client
        .post("https://leetcode.com/graphql")
        .header("Referer", "https://leetcode.com")
        .header("Origin", "https://leetcode.com")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("LeetCode returned HTTP {}", resp.status()));
    }
    let v: Value = resp.json().await.map_err(|e| format!("Bad response: {e}"))?;
    if v["data"]["matchedUser"].is_null() {
        return Err("User not found (is the profile public?)".into());
    }
    cache.insert(key, (Instant::now(), v.clone()));
    Ok(v)
}

#[cfg(windows)]
fn wallpaper_path() -> Option<String> {
    #[link(name = "user32")]
    extern "system" {
        fn SystemParametersInfoW(action: u32, param: u32, pv: *mut u16, win_ini: u32) -> i32;
    }
    let mut buf = [0u16; 520];
    // SPI_GETDESKWALLPAPER = 0x73
    let ok = unsafe { SystemParametersInfoW(0x73, 520, buf.as_mut_ptr(), 0) };
    if ok == 0 {
        return None;
    }
    let n = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    let p = String::from_utf16_lossy(&buf[..n]);
    if p.is_empty() { None } else { Some(p) }
}

/// Raw bytes of the current desktop wallpaper (the frontend blurs it for the glass effect).
#[tauri::command]
fn get_wallpaper() -> Result<tauri::ipc::Response, String> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<String> = Vec::new();
        if let Some(p) = wallpaper_path() {
            candidates.push(p);
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            candidates.push(format!("{appdata}\\Microsoft\\Windows\\Themes\\TranscodedWallpaper"));
        }
        for p in candidates {
            if let Ok(bytes) = std::fs::read(&p) {
                return Ok(tauri::ipc::Response::new(bytes));
            }
        }
    }
    Err("No wallpaper image found".into())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn toggle_visibility(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        // launching again (Start menu / search) just reveals the running widget
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(State {
            client: reqwest::Client::builder()
                .user_agent("Mozilla/5.0 LeetCodeWidget/1.0")
                .timeout(Duration::from_secs(20))
                .build()
                .expect("http client"),
            cache: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![fetch_profile, quit_app, get_wallpaper])
        .setup(|app| {
            let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Refresh now", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let click = MenuItem::with_id(
                app,
                "click-through",
                "Toggle click-through",
                true,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&toggle, &refresh, &settings, &click, &sep, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("LeetCode Widget")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_visibility(app),
                    "quit" => app.exit(0),
                    id => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                        }
                        let _ = app.emit("tray-action", id);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_visibility(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running widget");
}
