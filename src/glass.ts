import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

const win = getCurrentWindow();
const root = document.documentElement.style;

/** Load the desktop wallpaper, pre-blur it small, and expose it as --glass-img. */
export async function loadWallpaper(): Promise<void> {
  try {
    const buf = await invoke<ArrayBuffer>("get_wallpaper");
    const bmp = await createImageBitmap(new Blob([buf]));
    const w = 720;
    const h = Math.round((w * bmp.height) / bmp.width);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.filter = "blur(9px) saturate(1.4) brightness(0.95)";
    ctx.drawImage(bmp, -24, -24, w + 48, h + 48); // overscan so blurred edges stay clean
    bmp.close();
    root.setProperty("--glass-img", `url(${c.toDataURL("image/jpeg", 0.85)})`);
  } catch {
    root.setProperty("--glass-img", "none");
  }
}

export function disableWallpaper() {
  root.setProperty("--glass-img", "none");
}

/** Tell the CSS where the window sits on the monitor so the blurred wallpaper lines up. */
export async function updateGlassPosition(W: number, H: number): Promise<void> {
  try {
    const [pos, mon, sf] = await Promise.all([win.outerPosition(), currentMonitor(), win.scaleFactor()]);
    if (!mon) return;
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    root.setProperty("--wx", String((pos.x - mon.position.x) / sf / s));
    root.setProperty("--wy", String((pos.y - mon.position.y) / sf / s));
    root.setProperty("--mw", String(mon.size.width / sf / s));
    root.setProperty("--mh", String(mon.size.height / sf / s));
  } catch {
    /* ignore */
  }
}
