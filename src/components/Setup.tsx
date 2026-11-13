import { useState } from "react";
import GlassBg from "./GlassBg";

export default function Setup({ onConnect, error, busy }: { onConnect: (u: string) => void; error: string | null; busy: boolean }) {
  const [name, setName] = useState("");
  return (
    <div className="card flex flex-col items-center justify-center" style={{ width: 1021, height: 473, gap: 16 }}>
      <GlassBg ox={18} oy={18} />
      <div style={{ fontSize: 30, fontWeight: 600 }}>
        <span style={{ color: "#ffa116" }}>LeetCode</span> Widget
      </div>
      <div style={{ color: "#d0d0d6", fontSize: 16 }}>Enter your LeetCode username to connect your public profile.</div>
      <form
        data-nodrag
        onSubmit={(e) => { e.preventDefault(); name.trim() && onConnect(name.trim()); }}
        className="flex gap-3"
      >
        <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="username" style={{ width: 280, fontSize: 18, padding: "8px 12px" }} />
        <button type="submit" disabled={busy} style={{ background: "#ffa116", color: "#111", borderRadius: 8, padding: "8px 24px", fontSize: 17, fontWeight: 600 }}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
      {error && <div style={{ color: "#ff6b66", fontSize: 15 }}>{error}</div>}
      <div style={{ color: "#aaa", fontSize: 13 }}>No password or cookies needed.</div>
    </div>
  );
}
