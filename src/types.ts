export interface Counts {
  all: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface Badge {
  id: string;
  displayName: string;
  icon: string;
  creationDate: string;
}

export interface Recent {
  id?: string;
  title: string;
  titleSlug: string;
  timestamp: number;
}

export interface CalendarData {
  /** UTC-midnight epoch seconds -> submissions that day */
  counts: Record<string, number>;
  activeYears: number[];
  totalActiveDays: number;
  apiStreak: number;
}

export interface Profile {
  username: string;
  solved: Counts | null;
  totals: Counts | null;
  attempting: number | null;
  calendar: CalendarData | null;
  badges: Badge[] | null;
  recent: Recent[] | null;
  /** human-readable names of sections LeetCode didn't return */
  missing: string[];
}

export interface Settings {
  username: string;
  opacity: number; // glass tint strength, 0.1 - 1
  pin: "desktop" | "top";
  clickThrough: boolean;
  glass: boolean;
  v: number;
  refreshMinutes: number; // 2 - 5
  goals: { daily: number; weekly: number; monthly: number };
  scale: number; // tracked from window size
}

export const DEFAULT_SETTINGS: Settings = {
  username: "",
  opacity: 0.28,
  pin: "desktop",
  clickThrough: false,
  glass: true,
  v: 3,
  refreshMinutes: 3,
  goals: { daily: 3, weekly: 15, monthly: 60 },
  scale: 0.66,
};
