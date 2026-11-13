import { useState } from "react";
import { DEFAULT_TARGETS } from "../goals";
import type { GoalResult, Targets } from "../goals";
import GlassBg from "./GlassBg";

export default function GoalsCard({
  goals,
  targets,
  onSave,
  loading,
}: {
  goals: GoalResult[] | null;
  targets: Targets;
  onSave: (t: Targets) => void;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(targets.monthly);
  const g = goals?.find((x) => x.id === "monthly") ?? null;
  const done = g?.state === "done";
  const green = done ? "#6ef0a4" : "#2cbb5d";
  const month = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <div className="card" style={{ width: 498, height: 224, padding: "18px 24px" }}>
      <GlassBg ox={541} oy={18} />
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ color: "#d0d0d6", fontSize: 15 }}>Monthly Goal</div>
        <button
          data-nodrag title="Edit target" className="hover:bg-white/15"
          style={{ width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}
          onClick={() => { setDraft(targets.monthly); setEditing(true); }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </div>

      <div className={loading && !g ? "skeleton" : ""} style={{ position: "absolute", left: 24, right: 24, top: 70 }}>
        {g ? (
          <>
            <div className="flex items-end justify-between" style={{ lineHeight: 1 }}>
              <div>
                <span style={{ fontSize: 52, fontWeight: 600 }} title={g.approx ? "At least — older history isn't fully available from LeetCode" : undefined}>
                  {g.approx ? "≥" : ""}{g.done}
                </span>
                <span style={{ fontSize: 22, color: "#c4c4c8", marginLeft: 4 }}>/{g.target}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: green, paddingBottom: 4, transition: "color .3s" }}>{g.pct}%</div>
            </div>
            <div style={{ marginTop: 18, height: 10, borderRadius: 5, background: "rgba(255,255,255,.16)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, g.pct)}%`, height: "100%", borderRadius: 5, background: green,
                  boxShadow: done ? "0 0 12px rgba(110,240,164,.7)" : "none",
                  transition: "width .7s cubic-bezier(.2,.8,.2,1), background .3s",
                }}
              />
            </div>
            <div className="flex justify-between" style={{ marginTop: 10, fontSize: 13, color: "#d0d0d6" }}>
              <span>{g.remaining > 0 ? `${g.remaining} left` : "Completed"}</span>
              <span>{month}</span>
            </div>
          </>
        ) : (
          <div style={{ color: "#aaa", fontSize: 14, marginTop: 40, textAlign: "center" }}>{loading ? "Loading…" : "Submission history unavailable"}</div>
        )}
      </div>

      {editing && (
        <div
          data-nodrag
          className="absolute inset-0 flex flex-col justify-between"
          style={{ zIndex: 5, padding: "16px 24px 18px", background: "rgba(20,22,30,.72)", backdropFilter: "blur(18px)" }}
        >
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Monthly target</div>
              <button onClick={() => setEditing(false)} className="hover:bg-white/10" style={{ width: 24, height: 24, borderRadius: 6, fontSize: 18, color: "#ccc" }}>×</button>
            </div>
            <div className="flex items-center justify-center" style={{ gap: 10 }}>
              <button className="pill" style={{ width: 34, height: 34, fontSize: 20, lineHeight: 1 }} onClick={() => setDraft(Math.max(1, draft - 5))}>−</button>
              <input
                type="text" inputMode="numeric" value={draft}
                onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "") || "1", 10); setDraft(Math.min(999, Math.max(1, n))); }}
                style={{ width: 90, textAlign: "center", fontSize: 24, padding: "4px" }}
              />
              <button className="pill" style={{ width: 34, height: 34, fontSize: 20, lineHeight: 1 }} onClick={() => setDraft(Math.min(999, draft + 5))}>+</button>
            </div>
            <div style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 8 }}>questions per month</div>
          </div>
          <div className="flex justify-between">
            <button className="pill" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setDraft(DEFAULT_TARGETS.monthly)}>Reset to {DEFAULT_TARGETS.monthly}</button>
            <button
              style={{ background: "#ffa116", color: "#161616", borderRadius: 8, padding: "6px 22px", fontSize: 13, fontWeight: 600 }}
              onClick={() => { onSave({ ...targets, monthly: draft }); setEditing(false); }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
