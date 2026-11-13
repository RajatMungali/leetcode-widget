import type { Counts } from "../types";
import GlassBg from "./GlassBg";

const CX = 100, CY = 100, R = 84, SW = 7;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number) => [CX + R * Math.cos(rad(deg)), CY + R * Math.sin(rad(deg))];

function arc(a: number, b: number) {
  if (b - a < 0.01) return "";
  const [x1, y1] = pt(a);
  const [x2, y2] = pt(b);
  return `M ${x1} ${y1} A ${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

// Segments (SVG degrees, clockwise from +x). Gap sits at the bottom.
const SEGS = [
  { key: "easy" as const, a: 135, b: 213, color: "#00b8a3", dim: "rgba(0,184,163,.28)" },
  { key: "medium" as const, a: 218, b: 322, color: "#ffc01e", dim: "rgba(255,192,30,.26)" },
  { key: "hard" as const, a: 327, b: 405, color: "#ef4743", dim: "rgba(239,71,67,.28)" },
];

export default function StatsCard({
  solved,
  totals,
  attempting,
  loading,
}: {
  solved: Counts | null;
  totals: Counts | null;
  attempting: number | null;
  loading: boolean;
}) {
  const fmt = (n: number | undefined | null) => (n == null ? "—" : String(n));
  return (
    <div className="card flex items-center justify-between" style={{ width: 502, height: 224, padding: "0 28px 0 24px" }}>
      <GlassBg ox={18} oy={18} />
      <div className={`relative ${loading && !solved ? "skeleton" : ""}`} style={{ width: 200, height: 200 }}>
        <svg viewBox="0 0 200 200" width="200" height="200">
          {SEGS.map((s) => {
            const frac = solved && totals && totals[s.key] ? solved[s.key] / totals[s.key] : 0;
            const end = s.a + (s.b - s.a) * Math.max(frac, solved ? 0.012 : 0);
            return (
              <g key={s.key}>
                <path d={arc(s.a, s.b)} stroke={s.dim} strokeWidth={SW} fill="none" strokeLinecap="round" />
                {solved && (
                  <path
                    d={arc(s.a, end)}
                    stroke={s.color}
                    strokeWidth={SW}
                    fill="none"
                    strokeLinecap="round"
                    style={{ transition: "all .6s ease" }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 6 }}>
          <div className="leading-none">
            <span style={{ fontSize: 38, fontWeight: 600 }}>{fmt(solved?.all)}</span>
            <span style={{ fontSize: 17, color: "#c4c4c8" }}>/{fmt(totals?.all)}</span>
          </div>
          <div className="flex items-center gap-1" style={{ marginTop: 8, fontSize: 15 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2cbb5d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l5 5L20 6" />
            </svg>
            <span style={{ color: "#e2e2e6" }}>Solved</span>
          </div>
        </div>
        <div className="absolute w-full text-center" style={{ bottom: 6, fontSize: 13, color: "#c4c4c8" }}>
          <b style={{ color: "#e8e8ec" }}>{fmt(attempting)}</b> Attempting
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 10, width: 113 }}>
        {(
          [
            ["Easy", "easy", "#00d4bc"],
            ["Med.", "medium", "#ffc01e"],
            ["Hard", "hard", "#ff5a55"],
          ] as const
        ).map(([label, k, color]) => (
          <div key={k} className="pill flex flex-col items-center justify-center" style={{ height: 55 }}>
            <div style={{ color, fontSize: 14, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {fmt(solved?.[k])}/{fmt(totals?.[k])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
