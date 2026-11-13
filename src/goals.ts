import type { Recent } from "./types";

export interface Targets {
  daily: number;
  weekly: number;
  monthly: number;
}
export const DEFAULT_TARGETS: Targets = { daily: 3, weekly: 15, monthly: 60 };

/**
 * LeetCode's public API only exposes the 20 most recent accepted submissions, so we keep a
 * local ledger that accumulates them across syncs. It also stores one "total solved"
 * snapshot per day, which gives an independent exact count of newly-solved unique problems.
 */
interface Ledger {
  init: boolean;
  /** period starts earlier than this (epoch s) may be missing submissions; 0 = complete */
  coveredSince: number;
  subs: Record<string, { s: string; t: number }>;
  snaps: Record<string, number>; // yyyymmdd (local) -> total unique solved at last sync that day
  /** yyyymm -> total unique solved when that month began; monthly goal = total now − this */
  base?: Record<string, number>;
}

const monthKey = (d: Date) => d.getFullYear() * 100 + (d.getMonth() + 1);

const key = (u: string) => `acLedger.v1:${u.toLowerCase()}`;

export function loadLedger(user: string): Ledger {
  try {
    const v = localStorage.getItem(key(user));
    if (v) return JSON.parse(v);
  } catch { /* ignore */ }
  return { init: false, coveredSince: 0, subs: {}, snaps: {} };
}

const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export function mergeLedger(user: string, recent: Recent[], solvedTotal: number | null, nowMs = Date.now()): Ledger {
  const L = loadLedger(user);
  const ts = recent.map((r) => Number(r.timestamp));
  const saturated = recent.length >= 20; // API cap: more may exist than returned
  const oldest = ts.length ? Math.min(...ts) : 0;
  const known = Object.values(L.subs);
  const newestKnown = known.length ? Math.max(...known.map((x) => x.t)) : 0;

  if (!L.init) {
    L.coveredSince = saturated ? oldest : 0;
    L.init = true;
  } else if (saturated && oldest > newestKnown) {
    // we were away long enough that a gap may exist between what we have and what we got
    L.coveredSince = Math.max(L.coveredSince, oldest);
  }

  for (const r of recent) L.subs[`${r.titleSlug}:${r.timestamp}`] = { s: r.titleSlug, t: Number(r.timestamp) };

  if (solvedTotal != null) {
    L.snaps[String(dayKey(new Date(nowMs)))] = solvedTotal;
    const keys = Object.keys(L.snaps).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 70))) delete L.snaps[k];
  }
  // Month baseline: the "total solved" number at the start of this month.
  // New problems raise that total; re-solving an old problem does not.
  const now = new Date(nowMs);
  L.base = L.base ?? {};
  const mk = String(monthKey(now));
  if (L.base[mk] == null && solvedTotal != null) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prior = Object.keys(L.snaps).filter((k) => +k < dayKey(monthStart)).sort().pop();
    if (prior) {
      L.base[mk] = L.snaps[prior]; // exact: last total seen before this month began
    } else {
      // First run mid-month: infer from accepted submissions this month on problems not accepted earlier
      const s = monthStart.getTime() / 1000;
      const inM = new Set<string>();
      const before = new Set<string>();
      for (const x of Object.values(L.subs)) (x.t < s ? before : inM).add(x.s);
      let n = 0;
      inM.forEach((slug) => { if (!before.has(slug)) n++; });
      L.base[mk] = Math.max(0, solvedTotal - n);
    }
  }
  try { localStorage.setItem(key(user), JSON.stringify(L)); } catch { /* quota */ }
  return L;
}

export type GoalState = "done" | "ontrack" | "behind";
export interface GoalResult {
  id: "daily" | "weekly" | "monthly";
  label: string;
  target: number;
  done: number;
  pct: number;
  remaining: number;
  state: GoalState;
  status: string;
  /** history before the period start is only partially known: `done` is a lower bound */
  approx: boolean;
}

function periods(now: Date) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wk = new Date(day);
  wk.setDate(day.getDate() - ((day.getDay() + 6) % 7)); // Monday start
  const mo = new Date(now.getFullYear(), now.getMonth(), 1);
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  return [
    { id: "daily" as const, label: "Daily", start: day, end: addDays(day, 1), done: "Goal completed!" },
    { id: "weekly" as const, label: "Weekly", start: wk, end: addDays(wk, 7), done: "Weekly target achieved" },
    { id: "monthly" as const, label: "Monthly", start: mo, end: new Date(now.getFullYear(), now.getMonth() + 1, 1), done: "Monthly target achieved" },
  ];
}

export function computeGoals(L: Ledger, solvedTotal: number | null, targets: Targets, nowMs = Date.now()): GoalResult[] {
  const now = new Date(nowMs);
  const subs = Object.values(L.subs);
  return periods(now).map((p) => {
    const s = p.start.getTime() / 1000;
    const e = p.end.getTime() / 1000;
    const inPeriod = new Set<string>();
    const earlier = new Set<string>();
    for (const x of subs) {
      if (x.t < s) earlier.add(x.s);
      else if (x.t < e) inPeriod.add(x.s);
    }
    // unique problems accepted in the period that weren't already solved before it
    let ledgerCount = 0;
    inPeriod.forEach((slug) => { if (!earlier.has(slug)) ledgerCount++; });

    // independent check: growth in "total unique solved" since the end of the previous day
    const sk = dayKey(p.start);
    const prior = Object.keys(L.snaps).filter((k) => +k < sk).sort().pop();
    const delta = solvedTotal != null && prior ? Math.max(0, solvedTotal - L.snaps[prior]) : null;

    const covered = s >= L.coveredSince;
    let done: number;
    if (covered) done = delta != null ? Math.min(ledgerCount, delta) : ledgerCount;
    else done = delta != null ? delta : ledgerCount;

    // Monthly goal = growth of the total-solved counter since the month began
    let approxFlag = !covered;
    const mBase = L.base?.[String(monthKey(now))];
    if (p.id === "monthly" && solvedTotal != null && mBase != null) {
      done = Math.max(0, solvedTotal - mBase);
      approxFlag = false;
    }

    const target = Math.max(1, targets[p.id]);
    const remaining = Math.max(0, target - done);
    const elapsed = (nowMs / 1000 - s) / (e - s);
    const expected = target * elapsed;
    let state: GoalState = "ontrack";
    let status = "You're on track";
    if (done >= target) {
      state = "done";
      status = p.done;
    } else if (remaining === 1) {
      status = "1 more question to reach your goal";
      if (expected - done >= Math.max(1, 0.15 * target) + 1) state = "behind";
    } else if (expected - done >= Math.max(1, 0.15 * target)) {
      state = "behind";
      status = "You're falling behind";
    }
    return { id: p.id, label: p.label, target, done, pct: Math.round((done / target) * 100), remaining, state, status, approx: approxFlag };
  });
}
