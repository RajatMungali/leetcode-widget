import { useMemo, useState } from "react";
import { buildMonths, level, streaks, todayUtc } from "../calendar";
import type { CalendarData } from "../types";
import GlassBg from "./GlassBg";

export default function HeatmapCard({
  calendar,
  yearCalendar,
  year,
  onYear,
  loading,
}: {
  calendar: CalendarData | null;
  yearCalendar: CalendarData | null;
  year: number | null;
  onYear: (y: number | null) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = year === null ? calendar : yearCalendar;
  const counts = active?.counts;
  const months = useMemo(() => (counts ? buildMonths(counts, year) : []), [counts, year]);
  const { total, activeDays } = useMemo(() => {
    let t = 0, a = 0;
    if (year === null && counts) {
      const since = todayUtc() - 365 * 86400;
      for (const [k, v] of Object.entries(counts)) if (+k > since && v > 0) { t += v; a++; }
      return { total: t, activeDays: a };
    }
    for (const m of months) for (const c of m.cols) for (const cell of c) if (cell) { t += cell.count; if (cell.count) a++; }
    return { total: t, activeDays: a };
  }, [months, counts, year]);
  const st = useMemo(() => (calendar ? streaks(calendar.counts, calendar.apiStreak) : null), [calendar]);
  const years = [...(calendar?.activeYears ?? [])].sort((a, b) => b - a);

  return (
    <div className="card" style={{ width: 1021, height: 228, padding: "16px 22px 0 20px", marginTop: 21 }}>
      <GlassBg ox={18} oy={263} />
      <div className="flex items-baseline justify-between">
        <div style={{ fontSize: 17, color: "#e0e0e6" }}>
          <b style={{ fontSize: 22, color: "#fff", fontWeight: 600 }}>{active ? total : "—"}</b>{" "}
          submissions {year === null ? "in the past one year" : `in ${year}`}
        </div>
        <div className="flex items-center" style={{ gap: 18, fontSize: 13, color: "#d0d0d6" }}>
          <span>Total active days: <b style={{ color: "#fff" }}>{active ? activeDays : "—"}</b></span>
          <span>Max streak: <b style={{ color: "#fff" }}>{st ? st.max : "—"}</b></span>
          <span>Current streak: <b style={{ color: "#fff" }}>{st ? st.current : "—"}</b></span>
          <div className="relative" data-nodrag>
            <button
              onClick={() => setOpen(!open)}
              className="pill flex items-center"
              style={{ padding: "7px 16px", gap: 18, fontSize: 14, color: "#f0f0f4" }}
            >
              {year === null ? "Current" : year}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="#ddd" strokeWidth="1.5"><path d="M1 1l4 4 4-4" /></svg>
            </button>
            {open && (
              <div className="absolute right-0 z-20" style={{ top: 38, minWidth: 110, background: "rgba(30,30,36,.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 8, overflow: "hidden" }}>
                {[null, ...years].map((y) => (
                  <div
                    key={y ?? "cur"}
                    onClick={() => { setOpen(false); onYear(y); }}
                    className="cursor-pointer hover:bg-white/10"
                    style={{ padding: "7px 14px", fontSize: 14 }}
                  >
                    {y === null ? "Current" : y}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`flex justify-between ${loading && !active ? "skeleton" : ""}`} style={{ marginTop: 16, paddingRight: 4 }}>
        {months.map((m, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="flex" style={{ gap: 3 }}>
              {m.cols.map((col, ci) => (
                <div key={ci} className="flex flex-col" style={{ gap: 3 }}>
                  {col.map((cell, ri) =>
                    cell ? (
                      <div
                        key={ri}
                        className={`cell l${level(cell.count)}`}
                        title={`${cell.count} submission${cell.count === 1 ? "" : "s"} · ${new Date(cell.date * 1000).toISOString().slice(0, 10)}`}
                      />
                    ) : (
                      <div key={ri} className="cell" style={{ background: "transparent" }} />
                    ),
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 15, color: "#d0d0d6" }}>{m.label}</div>
          </div>
        ))}
        {!active && !loading && <div style={{ color: "#aaa", fontSize: 14 }}>Submission calendar unavailable</div>}
      </div>
    </div>
  );
}
