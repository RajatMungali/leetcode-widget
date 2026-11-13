export interface Cell {
  date: number; // epoch seconds, UTC midnight
  count: number;
}
export interface MonthBlock {
  label: string;
  cols: (Cell | null)[][];
}

const DAY = 86400;
export const todayUtc = () => Math.floor(Date.now() / 1000 / DAY) * DAY;

export function level(n: number): number {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 5) return 2;
  if (n <= 9) return 3;
  return 4;
}

/** Streaks computed from the calendar (UTC days, like LeetCode). */
export function streaks(counts: Record<string, number>, apiMax: number) {
  const days = Object.keys(counts)
    .filter((k) => counts[k] > 0)
    .map(Number)
    .sort((a, b) => a - b);
  let max = 0;
  let run = 0;
  let prev = -1;
  for (const d of days) {
    run = prev >= 0 && d - prev === DAY ? run + 1 : 1;
    max = Math.max(max, run);
    prev = d;
  }
  const set = new Set(days);
  const today = todayUtc();
  let cur = 0;
  // a streak is still alive if you solved today or yesterday
  let d = set.has(today) ? today : today - DAY;
  while (set.has(d)) {
    cur++;
    d -= DAY;
  }
  return { current: cur, max: Math.max(max, apiMax) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Build month blocks. year=null -> last 12 months up to today; else that calendar year. */
export function buildMonths(counts: Record<string, number>, year: number | null): MonthBlock[] {
  const now = new Date();
  let startY: number, startM: number, endY: number, endM: number;
  if (year === null) {
    endY = now.getUTCFullYear();
    endM = now.getUTCMonth();
    const s = new Date(Date.UTC(endY, endM - 11, 1));
    startY = s.getUTCFullYear();
    startM = s.getUTCMonth();
  } else {
    startY = endY = year;
    startM = 0;
    endM = 11;
  }
  const today = todayUtc();
  const blocks: MonthBlock[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const cols: (Cell | null)[][] = [];
    let cur: (Cell | null)[] = Array(7).fill(null);
    let any = false;
    for (let dd = 1; dd <= dim; dd++) {
      const date = Math.floor(Date.UTC(y, m, dd) / 1000);
      if (date > today) break;
      const dow = new Date(date * 1000).getUTCDay();
      if (dow === 0 && any) {
        cols.push(cur);
        cur = Array(7).fill(null);
      }
      cur[dow] = { date, count: counts[String(date)] ?? 0 };
      any = true;
    }
    if (any) cols.push(cur);
    if (cols.length) blocks.push({ label: MONTHS[m], cols });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return blocks;
}

export function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
