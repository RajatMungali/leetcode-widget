import { useEffect, useState } from "react";
import type { Settings } from "../types";
import { timeAgo } from "../calendar";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  autostart: boolean;
  onAutostart: (v: boolean) => void;
  onSync: () => void;
  onClose: () => void;
  lastSync: number | null;
  missing: string[];
  syncing: boolean;
}

function Section({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#ffa116", marginBottom: 4 }}>{title}</div>
      <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "0 14px" }}>{children}</div>
    </div>
  );
}

function Row({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "7px 0", gap: 14, borderBottom: last ? "none" : "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#ececf0", fontSize: 14, whiteSpace: "nowrap" }}>{label}</div>
        {hint && <div style={{ color: "#a0a0a8", fontSize: 11.5, marginTop: 1 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, background: on ? "#ffa116" : "rgba(255,255,255,.2)", position: "relative", transition: "background .25s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .25s cubic-bezier(.4,1.4,.6,1)", boxShadow: "0 1px 3px rgba(0,0,0,.4)" }} />
    </button>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex" style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: 2 }}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          style={{ padding: "4px 12px", fontSize: 13, borderRadius: 6, whiteSpace: "nowrap", transition: "all .2s", background: v === value ? "#ffa116" : "transparent", color: v === value ? "#161616" : "#dcdce0", fontWeight: v === value ? 600 : 400 }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({ value, min, max, onChange, suffix = "%" }: { value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} style={{ width: 150 }} />
      <span style={{ width: 40, textAlign: "right", fontSize: 13, color: "#ccc" }}>{value}{suffix}</span>
    </div>
  );
}

export default function SettingsPanel(p: Props) {
  const { settings: s } = p;
  const [name, setName] = useState(s.username);
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [p]);
  const saveName = () => name.trim() && name.trim() !== s.username && p.onChange({ username: name.trim() });

  return (
    <div
      data-nodrag
      onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}
      className="absolute inset-0 z-30 flex justify-center items-center"
      style={{ background: shown ? "rgba(0,0,0,.3)" : "rgba(0,0,0,0)", transition: "background .25s", padding: 14 }}
    >
      <div
        className="sbar"
        style={{
          width: 760, maxWidth: "100%", maxHeight: "100%", overflowY: "auto", padding: "16px 22px 14px",
          background: "rgba(24,26,34,.72)", backdropFilter: "blur(28px) saturate(160%)",
          border: "1px solid rgba(255,255,255,.2)", borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.14)",
          transform: shown ? "translateY(0) scale(1)" : "translateY(14px) scale(.98)", opacity: shown ? 1 : 0,
          transition: "transform .3s cubic-bezier(.2,.9,.3,1), opacity .25s",
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Settings</div>
          <button onClick={p.onClose} className="hover:bg-white/10" style={{ width: 28, height: 28, borderRadius: 8, fontSize: 20, color: "#ccc" }}>×</button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", columnGap: 22 }}>
        <Section title="Account" style={{ gridColumn: 1 }}>
          <Row label="LeetCode username" last>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()} onBlur={saveName}
              style={{ width: 170 }}
            />
          </Row>
        </Section>

        <Section title="Appearance" style={{ gridColumn: 1 }}>
          <Row label="Glass blur" hint="Blurred wallpaper behind the cards">
            <Toggle on={s.glass} onClick={() => p.onChange({ glass: !s.glass })} />
          </Row>
          <Row label="Glass tint" hint="Lower = clearer" last>
            <Slider value={Math.round(s.opacity * 100)} min={5} max={90} onChange={(v) => p.onChange({ opacity: v / 100 })} />
          </Row>
        </Section>

        <Section title="Behaviour" style={{ gridColumn: 2, gridRow: "1 / span 3" }}>
          <Row label="Placement" hint={s.pin === "desktop" ? "Behind your apps" : "Above all apps"}>
            <Segmented value={s.pin} options={[["desktop", "Desktop"], ["top", "On top"]]} onChange={(v) => p.onChange({ pin: v })} />
          </Row>
          <Row label="Click-through" hint="Tray icon → Toggle click-through to undo">
            <Toggle on={s.clickThrough} onClick={() => p.onChange({ clickThrough: !s.clickThrough })} />
          </Row>
          <Row label="Launch on startup" last><Toggle on={p.autostart} onClick={() => p.onAutostart(!p.autostart)} /></Row>
        </Section>

        <Section title="Sync" style={{ gridColumn: 1 }}>
          <Row label="Auto-refresh">
            <Segmented value={s.refreshMinutes} options={[[2, "2m"], [3, "3m"], [5, "5m"]]} onChange={(v) => p.onChange({ refreshMinutes: v })} />
          </Row>
          <Row label="Last synced" hint={timeAgo(p.lastSync)} last>
            <button onClick={p.onSync} disabled={p.syncing} style={{ background: "rgba(255,255,255,.14)", borderRadius: 8, padding: "5px 14px", fontSize: 13 }}>
              {p.syncing ? "Syncing…" : "Sync now"}
            </button>
          </Row>
        </Section>
        </div>

        {p.missing.length > 0 && (
          <div style={{ color: "#ffc01e", fontSize: 12 }}>LeetCode didn’t return: {p.missing.join(", ")}.</div>
        )}
        <div style={{ color: "#9a9aa2", fontSize: 11.5, marginTop: 6 }}>Resize by dragging the widget’s edges. Public profile only. Esc closes.</div>
      </div>
    </div>
  );
}
