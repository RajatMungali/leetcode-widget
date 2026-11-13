import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { fetchProfile } from "./api";
import { disableWallpaper, loadWallpaper, updateGlassPosition } from "./glass";
import { timeAgo } from "./calendar";
import { DEFAULT_SETTINGS } from "./types";
import type { CalendarData, Profile, Settings } from "./types";
import StatsCard from "./components/StatsCard";
import GoalsCard from "./components/GoalsCard";
import { computeGoals, loadLedger, mergeLedger } from "./goals";
import HeatmapCard from "./components/HeatmapCard";
import SettingsPanel from "./components/SettingsPanel";
import Setup from "./components/Setup";

const W = 1057;
const H = 509;
const win = getCurrentWindow();

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

const HANDLES = [
  ["East", { right: 0, top: 14, bottom: 14, width: 7, cursor: "ew-resize" }],
  ["West", { left: 0, top: 14, bottom: 14, width: 7, cursor: "ew-resize" }],
  ["South", { bottom: 0, left: 14, right: 14, height: 7, cursor: "ns-resize" }],
  ["North", { top: 0, left: 14, right: 14, height: 7, cursor: "ns-resize" }],
  ["SouthEast", { right: 0, bottom: 0, width: 16, height: 16, cursor: "nwse-resize" }],
  ["SouthWest", { left: 0, bottom: 0, width: 16, height: 16, cursor: "nesw-resize" }],
  ["NorthEast", { right: 0, top: 0, width: 16, height: 16, cursor: "nesw-resize" }],
  ["NorthWest", { left: 0, top: 0, width: 16, height: 16, cursor: "nwse-resize" }],
] as const;

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = load("settings", DEFAULT_SETTINGS);
    return s.v === DEFAULT_SETTINGS.v ? s : { ...DEFAULT_SETTINGS, username: s.username };
  });
  const [profile, setProfile] = useState<Profile | null>(() => load<Profile | null>("profile", null as any) as any);
  const [lastSync, setLastSync] = useState<number | null>(() => Number(localStorage.getItem("lastSync")) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [yearCal, setYearCal] = useState<CalendarData | null>(null);
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / W, window.innerHeight / H));
  const [tickN, tick] = useState(0);
  const [ledgerVer, setLedgerVer] = useState(0);
  const inflight = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // persist settings + apply to CSS
  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
    document.documentElement.style.setProperty("--card-a", String(settings.opacity));
  }, [settings]);

  // placement: sit on the wallpaper (behind apps) or float on top
  useEffect(() => {
    const apply = async () => {
      if (settings.pin === "top") {
        await win.setAlwaysOnBottom(false);
        await win.setAlwaysOnTop(true);
      } else {
        await win.setAlwaysOnTop(false);
        await win.setAlwaysOnBottom(true);
      }
    };
    apply().catch(() => {});
    if (settings.pin !== "desktop") return;
    // clicking the widget raises it; push it back behind other apps afterwards
    // (only after focus is LOST, so clicks/drags on the widget aren't interrupted)
    const un = win.onFocusChanged((e) => { if (!e.payload) win.setAlwaysOnBottom(true).catch(() => {}); });
    return () => { un.then((f) => f()); };
  }, [settings.pin]);

  // glass: blurred wallpaper painted behind each card, aligned to the window position
  useEffect(() => {
    if (!settings.glass) { disableWallpaper(); return; }
    loadWallpaper().then(() => updateGlassPosition(W, H));
    const id = setInterval(() => loadWallpaper(), 10 * 60_000);
    return () => clearInterval(id);
  }, [settings.glass]);
  useEffect(() => {
    let raf = 0;
    const upd = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => updateGlassPosition(W, H)); };
    updateGlassPosition(W, H);
    const a = win.onMoved(upd);
    const b = win.onResized(upd);
    return () => { a.then((f) => f()); b.then((f) => f()); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { win.setIgnoreCursorEvents(settings.clickThrough).catch(() => {}); }, [settings.clickThrough]);
  useEffect(() => { isEnabled().then(setAutostart).catch(() => {}); }, []);

  const patch = useCallback((p: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...p }));
  }, []);

  // keep proportions when the user drags a resize handle
  useEffect(() => {
    let t: number | undefined;
    const un = win.onResized(() => {
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
      clearTimeout(t);
      t = window.setTimeout(() => {
        const w = window.innerWidth;
        const h = Math.round((w * H) / W);
        if (Math.abs(window.innerHeight - h) > 3) win.setSize(new LogicalSize(w, h)).catch(() => {});
        setSettings((s) => ({ ...s, scale: w / W }));
      }, 180);
    });
    return () => { un.then((f) => f()); clearTimeout(t); };
  }, []);

  const sync = useCallback(async (force = false, username = settingsRef.current.username) => {
    if (!username || inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const p = await fetchProfile(username, null, force);
      setProfile(p);
      setError(null);
      if (p.recent) { mergeLedger(username, p.recent, p.solved?.all ?? null); setLedgerVer((n) => n + 1); }
      const now = Date.now();
      setLastSync(now);
      localStorage.setItem("profile", JSON.stringify(p));
      localStorage.setItem("lastSync", String(now));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  // initial + username change
  useEffect(() => {
    if (settings.username) sync(false, settings.username);
  }, [settings.username, sync]);

  // background polling
  useEffect(() => {
    if (!settings.username) return;
    const id = setInterval(() => sync(false), settings.refreshMinutes * 60_000);
    return () => clearInterval(id);
  }, [settings.username, settings.refreshMinutes, sync]);

  // refresh on focus/visibility; re-render "synced x ago"
  useEffect(() => {
    const onFocus = () => sync(false);
    const onVis = () => document.visibilityState === "visible" && sync(false);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [sync]);

  // tray actions
  useEffect(() => {
    const un = listen<string>("tray-action", (e) => {
      if (e.payload === "click-through") patch({ clickThrough: !settingsRef.current.clickThrough });
      else if (e.payload === "settings") setShowSettings(true);
      else if (e.payload === "refresh") sync(true);
    });
    return () => { un.then((f) => f()); };
  }, [patch, sync]);

  // year selection
  useEffect(() => {
    if (year === null || !settings.username) { setYearCal(null); return; }
    fetchProfile(settings.username, year, false).then((p) => setYearCal(p.calendar)).catch(() => setYearCal(null));
  }, [year, settings.username, lastSync]);

  const toggleAutostart = async (v: boolean) => {
    try { v ? await enable() : await disable(); setAutostart(v); } catch { /* ignore */ }
  };

  const connect = async (u: string) => {
    setError(null);
    setLoading(true);
    try {
      const p = await fetchProfile(u, null, true);
      if (p.recent) { mergeLedger(u, p.recent, p.solved?.all ?? null); setLedgerVer((n) => n + 1); }
      setProfile(p);
      setSettings((s) => ({ ...s, username: u }));
      setLastSync(Date.now());
      localStorage.setItem("profile", JSON.stringify(p));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-nodrag]")) return;
    win.startDragging().catch(() => {});
  };

  // goals: unique accepted problems per local day / Monday-week / month
  const goalResults = useMemo(
    () => (settings.username && profile?.recent ? computeGoals(loadLedger(settings.username), profile.solved?.all ?? null, settings.goals) : null),
    // tickN re-evaluates at period rollovers (midnight etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.username, settings.goals, profile, ledgerVer, tickN],
  );

  const ctlBtn = "flex items-center justify-center rounded-md hover:bg-white/15";
  const hasUser = !!settings.username;
  const stale = error && profile;

  return (
    <div onMouseDown={onMouseDown} style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* drag-to-resize handles (the window is frameless) */}
      {HANDLES.map(([dir, st]) => (
        <div
          key={dir}
          data-nodrag
          onMouseDown={(e) => { e.stopPropagation(); win.startResizeDragging(dir).catch(() => {}); }}
          style={{ position: "fixed", zIndex: 60, ...st }}
        />
      ))}

      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {!hasUser ? (
          <Setup onConnect={connect} error={error} busy={loading} />
        ) : (
          <>
            <div className="flex" style={{ gap: 21 }}>
              <StatsCard solved={profile?.solved ?? null} totals={profile?.totals ?? null} attempting={profile?.attempting ?? null} loading={loading} />
              <GoalsCard goals={goalResults} targets={settings.goals} onSave={(g) => patch({ goals: g })} loading={loading} />
            </div>
            <HeatmapCard calendar={profile?.calendar ?? null} yearCalendar={yearCal} year={year} onYear={setYear} loading={loading} />
          </>
        )}

        {/* controls */}
        <div data-nodrag className="ctl absolute flex items-center" style={{ top: 26, right: 34, gap: 4, zIndex: 40, display: showSettings ? "none" : "flex" }}>
          {hasUser && (
            <span style={{ fontSize: 11, color: stale ? "#ffc01e" : "#d0d0d6", marginRight: 6 }}>
              {stale ? `Offline · ${error} · ` : ""}synced {timeAgo(lastSync)}
            </span>
          )}
          {hasUser && (
            <button title="Refresh" className={ctlBtn} style={{ width: 26, height: 26 }} onClick={() => sync(true)}>
              <svg className={loading ? "spin" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
              </svg>
            </button>
          )}
          {hasUser && (
            <button title="Settings" className={ctlBtn} style={{ width: 26, height: 26 }} onClick={() => setShowSettings((v) => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          )}
          <button title="Hide to tray" className={ctlBtn} style={{ width: 26, height: 26 }} onClick={() => win.hide()}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="#eee" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button title="Quit" className={`${ctlBtn} hover:!bg-red-500/60`} style={{ width: 26, height: 26 }} onClick={() => invoke("quit_app")}>
            <svg width="14" height="14" viewBox="0 0 24 24" stroke="#eee" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {showSettings && hasUser && (
          <SettingsPanel
            settings={settings}
            onChange={patch}
            autostart={autostart}
            onAutostart={toggleAutostart}
            onSync={() => sync(true)}
            onClose={() => setShowSettings(false)}
            lastSync={lastSync}
            missing={profile?.missing ?? []}
            syncing={loading}
          />
        )}
      </div>
    </div>
  );
}
