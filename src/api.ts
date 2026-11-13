import { invoke } from "@tauri-apps/api/core";
import type { CalendarData, Counts, Profile } from "./types";

const sum = (a: { count: number }[]) => a.reduce((s, x) => s + x.count, 0);

function counts(list: { difficulty: string; count: number }[] | undefined): Counts | null {
  if (!list) return null;
  const get = (d: string) => list.find((x) => x.difficulty.toLowerCase() === d)?.count ?? 0;
  return { all: get("all"), easy: get("easy"), medium: get("medium"), hard: get("hard") };
}

function parseCalendar(c: any): CalendarData | null {
  if (!c) return null;
  let counts: Record<string, number> = {};
  try {
    counts = JSON.parse(c.submissionCalendar || "{}");
  } catch {
    return null;
  }
  return {
    counts,
    activeYears: c.activeYears ?? [],
    totalActiveDays: c.totalActiveDays ?? 0,
    apiStreak: c.streak ?? 0,
  };
}

export async function fetchProfile(
  username: string,
  year: number | null,
  force: boolean,
): Promise<Profile> {
  const res: any = await invoke("fetch_profile", { username, year, force });
  const d = res.data ?? {};
  const u = d.matchedUser;
  const missing: string[] = [];

  const solved = counts(
    u?.submitStats?.acSubmissionNum?.map((x: any) => ({ difficulty: x.difficulty, count: x.count })),
  );
  const totals = counts(d.allQuestionsCount);
  const failed = d.userProfileUserQuestionProgressV2?.numFailedQuestions;
  const attempting = failed ? sum(failed) : null;
  const calendar = parseCalendar(u?.userCalendar);
  const badges = u?.badges ?? null;
  const recent = d.recentAcSubmissionList
    ? d.recentAcSubmissionList.map((r: any) => ({ ...r, timestamp: Number(r.timestamp) }))
    : null;

  if (!solved) missing.push("solved counts");
  if (!totals) missing.push("question totals");
  if (attempting === null) missing.push("attempted count");
  if (!calendar) missing.push("submission calendar");
  if (!badges) missing.push("badges");
  if (!recent) missing.push("recent submissions");

  return { username: u.username, solved, totals, attempting, calendar, badges, recent, missing };
}
