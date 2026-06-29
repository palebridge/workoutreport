// Pure, framework-free analytics computed from the decrypted Dataset. Kept on
// the client so drill-downs stay flexible; the dataset is small.

import type { Dataset, DatasetSet, TemplateMeta } from "./types";

export const KG_TO_LB = 2.2046226218;

// ----------------------------------------------------------------------------
// Units
// ----------------------------------------------------------------------------

export type Unit = "kg" | "lb";

export function toUnit(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kg * KG_TO_LB;
}

export function fmtWeight(kg: number, unit: Unit, digits = 0): string {
  const v = toUnit(kg, unit);
  return `${v.toLocaleString(undefined, { maximumFractionDigits: digits })} ${unit}`;
}

// ----------------------------------------------------------------------------
// Set-level helpers
// ----------------------------------------------------------------------------

export function isStrengthSet(s: DatasetSet): boolean {
  return s.weightKg != null && s.reps != null && s.reps > 0;
}

export function isWorkingSet(s: DatasetSet): boolean {
  return s.type !== "warmup";
}

export function setVolumeKg(s: DatasetSet): number {
  return (s.weightKg ?? 0) * (s.reps ?? 0);
}

/** Epley estimated one-rep max. */
export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

// ----------------------------------------------------------------------------
// Date helpers (local time — this is a personal dashboard)
// ----------------------------------------------------------------------------

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Monday-based ISO week key like "2026-W26", plus a sortable timestamp. */
export function isoWeek(iso: string): { key: string; weekStart: Date } {
  const d = new Date(iso);
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // Mon=0
  const weekStart = new Date(day);
  weekStart.setDate(day.getDate() - dow);
  // ISO week number
  const thursday = new Date(weekStart);
  thursday.setDate(weekStart.getDate() + 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { key: `${thursday.getFullYear()}-W${pad(week)}`, weekStart };
}

// ----------------------------------------------------------------------------
// Overview
// ----------------------------------------------------------------------------

export interface Overview {
  workouts: number;
  totalDurationSec: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  totalDistanceM: number;
  avgDurationSec: number;
  firstWorkout: string | null;
  lastWorkout: string | null;
  daysTraining: number;
  uniqueExercises: number;
}

export function overview(d: Dataset): Overview {
  let totalDurationSec = 0;
  let totalVolumeKg = 0;
  let totalSets = 0;
  let totalReps = 0;
  let totalDistanceM = 0;
  const exerciseIds = new Set<string>();

  for (const w of d.workouts) {
    totalDurationSec += w.durationSeconds;
    for (const e of w.exercises) {
      exerciseIds.add(e.templateId);
      for (const s of e.sets) {
        totalSets += 1;
        totalReps += s.reps ?? 0;
        totalVolumeKg += setVolumeKg(s);
        totalDistanceM += s.distanceMeters ?? 0;
      }
    }
  }

  const first = d.workouts[0]?.startTime ?? null;
  const last = d.workouts[d.workouts.length - 1]?.startTime ?? null;
  const daysTraining = first
    ? Math.max(1, Math.round((Date.now() - Date.parse(first)) / 86400000) + 1)
    : 0;

  return {
    workouts: d.workouts.length,
    totalDurationSec,
    totalVolumeKg,
    totalSets,
    totalReps,
    totalDistanceM,
    avgDurationSec: d.workouts.length ? Math.round(totalDurationSec / d.workouts.length) : 0,
    firstWorkout: first,
    lastWorkout: last,
    daysTraining,
    uniqueExercises: exerciseIds.size,
  };
}

// ----------------------------------------------------------------------------
// Muscle balance (featured)
// ----------------------------------------------------------------------------

export type MuscleCategory = "Push" | "Pull" | "Legs" | "Core" | "Other";

const CATEGORY: Record<string, MuscleCategory> = {
  chest: "Push",
  shoulders: "Push",
  triceps: "Push",
  lats: "Pull",
  upper_back: "Pull",
  biceps: "Pull",
  forearms: "Pull",
  traps: "Pull",
  quadriceps: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
  abductors: "Legs",
  adductors: "Legs",
  abdominals: "Core",
  lower_back: "Core",
};

export function categoryOf(muscle: string): MuscleCategory {
  return CATEGORY[muscle] ?? "Other";
}

export const CATEGORY_COLORS: Record<MuscleCategory, string> = {
  Push: "#fb7185",
  Pull: "#22d3ee",
  Legs: "#34d399",
  Core: "#fbbf24",
  Other: "#a78bfa",
};

export function prettyMuscle(m: string): string {
  return m
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface MuscleStat {
  muscle: string;
  label: string;
  category: MuscleCategory;
  sets: number; // weighted: primary 1.0, secondary 0.5
  volumeKg: number;
}

/**
 * Weighted set contribution per muscle group. The primary mover gets full
 * credit (1.0) and each secondary mover half credit (0.5) — a common way to
 * approximate effective volume.
 */
export function muscleBalance(d: Dataset): MuscleStat[] {
  const map = new Map<string, { sets: number; volumeKg: number }>();
  const add = (m: string, sets: number, vol: number) => {
    const cur = map.get(m) ?? { sets: 0, volumeKg: 0 };
    cur.sets += sets;
    cur.volumeKg += vol;
    map.set(m, cur);
  };

  for (const w of d.workouts) {
    for (const e of w.exercises) {
      const t = d.templates[e.templateId];
      if (!t || !t.primaryMuscleGroup) continue;
      const working = e.sets.filter(isWorkingSet);
      const n = working.length;
      if (n === 0) continue;
      const vol = working.reduce((acc, s) => acc + setVolumeKg(s), 0);
      add(t.primaryMuscleGroup, n, vol);
      for (const sec of t.secondaryMuscleGroups) add(sec, n * 0.5, vol * 0.5);
    }
  }

  return [...map.entries()]
    .map(([muscle, v]) => ({
      muscle,
      label: prettyMuscle(muscle),
      category: categoryOf(muscle),
      sets: round1(v.sets),
      volumeKg: Math.round(v.volumeKg),
    }))
    .sort((a, b) => b.sets - a.sets);
}

export interface CategorySplit {
  category: MuscleCategory;
  sets: number;
  color: string;
}

export function categorySplit(stats: MuscleStat[]): CategorySplit[] {
  const order: MuscleCategory[] = ["Push", "Pull", "Legs", "Core", "Other"];
  const map = new Map<MuscleCategory, number>();
  for (const s of stats) map.set(s.category, (map.get(s.category) ?? 0) + s.sets);
  return order
    .filter((c) => (map.get(c) ?? 0) > 0)
    .map((c) => ({ category: c, sets: round1(map.get(c) ?? 0), color: CATEGORY_COLORS[c] }));
}

// ----------------------------------------------------------------------------
// Consistency — weekly-goal model (more meaningful than daily streaks for
// people who train a few times a week rather than every day).
// ----------------------------------------------------------------------------

export interface Consistency {
  /** dayKey -> number of workouts that day (for the calendar heatmap) */
  byDay: Record<string, number>;
  /** weekly session goal the metrics are measured against */
  target: number;
  sessionsThisWeek: number;
  /** average sessions per week across the active span (first week → now) */
  avgPerWeek: number;
  /** consecutive weeks (counting back from now) that hit the target */
  weeksOnTargetStreak: number;
  /** longest run of consecutive weeks that hit the target */
  longestWeekStreak: number;
  weeksMetTarget: number;
  totalWeeks: number;
  /** most sessions in any single week */
  bestWeek: number;
  activeDays: number;
}

export function consistency(d: Dataset, target: number): Consistency {
  const byDay: Record<string, number> = {};
  for (const w of d.workouts) {
    const k = dayKey(w.startTime);
    byDay[k] = (byDay[k] ?? 0) + 1;
  }

  // Bucket sessions into ISO weeks.
  const perWeek = new Map<string, number>();
  for (const w of d.workouts) {
    const key = isoWeek(w.startTime).key;
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }

  // Build a *contiguous* list of weeks from the first workout's week to the
  // current week, filling gap weeks with 0 so streaks/averages are correct.
  const now = new Date();
  const currentWeekStart = isoWeek(now.toISOString()).weekStart;
  const counts: number[] = [];
  if (d.workouts.length > 0) {
    const firstStart = isoWeek(d.workouts[0].startTime).weekStart;
    const cursor = new Date(firstStart);
    while (cursor.getTime() <= currentWeekStart.getTime()) {
      counts.push(perWeek.get(isoWeek(cursor.toISOString()).key) ?? 0);
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  const totalWeeks = counts.length;
  const totalWorkouts = d.workouts.length;
  const sessionsThisWeek = perWeek.get(isoWeek(now.toISOString()).key) ?? 0;
  const avgPerWeek = totalWeeks > 0 ? totalWorkouts / totalWeeks : 0;
  const bestWeek = counts.reduce((m, c) => Math.max(m, c), 0);
  const weeksMetTarget = counts.filter((c) => c >= target).length;

  // Longest run of on-target weeks anywhere in the span.
  let longestWeekStreak = 0;
  let run = 0;
  for (const c of counts) {
    run = c >= target ? run + 1 : 0;
    longestWeekStreak = Math.max(longestWeekStreak, run);
  }

  // Current weekly streak, counting back from now. Forgive the in-progress
  // current week if it hasn't hit the target yet (mirrors a grace day).
  let weeksOnTargetStreak = 0;
  let i = counts.length - 1;
  if (i >= 0 && counts[i] < target) i -= 1; // skip unfinished current week
  for (; i >= 0; i--) {
    if (counts[i] >= target) weeksOnTargetStreak += 1;
    else break;
  }

  return {
    byDay,
    target,
    sessionsThisWeek,
    avgPerWeek,
    weeksOnTargetStreak,
    longestWeekStreak,
    weeksMetTarget,
    totalWeeks,
    bestWeek,
    activeDays: Object.keys(byDay).length,
  };
}

// ----------------------------------------------------------------------------
// Trends (per-workout + weekly)
// ----------------------------------------------------------------------------

export interface WorkoutPoint {
  date: string; // dayKey
  label: string; // short human label
  title: string;
  volumeKg: number;
  durationMin: number;
  sets: number;
}

export function workoutTrend(d: Dataset): WorkoutPoint[] {
  return d.workouts.map((w) => {
    let volumeKg = 0;
    let sets = 0;
    for (const e of w.exercises)
      for (const s of e.sets) {
        sets += 1;
        volumeKg += setVolumeKg(s);
      }
    return {
      date: dayKey(w.startTime),
      label: shortDate(w.startTime),
      title: w.title,
      volumeKg: Math.round(volumeKg),
      durationMin: Math.round(w.durationSeconds / 60),
      sets,
    };
  });
}

export interface WeekPoint {
  week: string;
  label: string;
  volumeKg: number;
  durationMin: number;
  workouts: number;
}

export function weeklyTrend(d: Dataset): WeekPoint[] {
  const map = new Map<string, WeekPoint & { sortKey: number }>();
  for (const w of d.workouts) {
    const { key, weekStart } = isoWeek(w.startTime);
    let vol = 0;
    for (const e of w.exercises) for (const s of e.sets) vol += setVolumeKg(s);
    const cur =
      map.get(key) ??
      ({
        week: key,
        label: shortDate(weekStart.toISOString()),
        volumeKg: 0,
        durationMin: 0,
        workouts: 0,
        sortKey: weekStart.getTime(),
      } as WeekPoint & { sortKey: number });
    cur.volumeKg += Math.round(vol);
    cur.durationMin += Math.round(w.durationSeconds / 60);
    cur.workouts += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((p) => ({
      week: p.week,
      label: p.label,
      volumeKg: p.volumeKg,
      durationMin: p.durationMin,
      workouts: p.workouts,
    }));
}

// ----------------------------------------------------------------------------
// Per-exercise progression + PRs
// ----------------------------------------------------------------------------

export interface ExerciseSummary {
  templateId: string;
  title: string;
  template?: TemplateMeta;
  sessions: number;
  totalSets: number;
  bestWeightKg: number;
  best1RMKg: number;
  lastPerformed: string;
}

export function exerciseSummaries(d: Dataset): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>();
  for (const w of d.workouts) {
    for (const e of w.exercises) {
      const cur =
        map.get(e.templateId) ??
        ({
          templateId: e.templateId,
          title: e.title,
          template: d.templates[e.templateId],
          sessions: 0,
          totalSets: 0,
          bestWeightKg: 0,
          best1RMKg: 0,
          lastPerformed: w.startTime,
        } as ExerciseSummary);
      cur.sessions += 1;
      for (const s of e.sets) {
        cur.totalSets += 1;
        if (isStrengthSet(s) && isWorkingSet(s)) {
          cur.bestWeightKg = Math.max(cur.bestWeightKg, s.weightKg!);
          cur.best1RMKg = Math.max(cur.best1RMKg, epley1RM(s.weightKg!, s.reps!));
        }
      }
      if (Date.parse(w.startTime) >= Date.parse(cur.lastPerformed)) cur.lastPerformed = w.startTime;
      map.set(e.templateId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions - a.sessions || b.totalSets - a.totalSets);
}

export interface ProgressPoint {
  date: string;
  label: string;
  topWeightKg: number;
  est1RMKg: number;
  volumeKg: number;
  totalReps: number;
  isPR: boolean;
}

/** Per-session progression for one exercise, oldest first, with PR flags. */
export function exerciseProgress(d: Dataset, templateId: string): ProgressPoint[] {
  const points: ProgressPoint[] = [];
  for (const w of d.workouts) {
    const matches = w.exercises.filter((e) => e.templateId === templateId);
    if (matches.length === 0) continue;
    let topWeight = 0;
    let best1RM = 0;
    let volume = 0;
    let reps = 0;
    let hasStrength = false;
    for (const e of matches)
      for (const s of e.sets) {
        volume += setVolumeKg(s);
        reps += s.reps ?? 0;
        if (isStrengthSet(s) && isWorkingSet(s)) {
          hasStrength = true;
          topWeight = Math.max(topWeight, s.weightKg!);
          best1RM = Math.max(best1RM, epley1RM(s.weightKg!, s.reps!));
        }
      }
    points.push({
      date: dayKey(w.startTime),
      label: shortDate(w.startTime),
      topWeightKg: hasStrength ? round1(topWeight) : 0,
      est1RMKg: hasStrength ? round1(best1RM) : 0,
      volumeKg: Math.round(volume),
      totalReps: reps,
      isPR: false,
    });
  }
  // Flag PRs on estimated 1RM (falls back to volume for non-weighted work).
  let best = 0;
  const useVolume = points.every((p) => p.est1RMKg === 0);
  for (const p of points) {
    const metric = useVolume ? p.volumeKg : p.est1RMKg;
    if (metric > best) {
      best = metric;
      p.isPR = true;
    }
  }
  return points;
}

export interface PRRecord {
  templateId: string;
  title: string;
  date: string;
  best1RMKg: number;
  bestWeightKg: number;
  reps: number;
}

/** One best-effort PR per exercise, newest achievement first. */
export function personalRecords(d: Dataset): PRRecord[] {
  const map = new Map<string, PRRecord>();
  for (const w of d.workouts) {
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!isStrengthSet(s) || !isWorkingSet(s)) continue;
        const e1 = epley1RM(s.weightKg!, s.reps!);
        const cur = map.get(e.templateId);
        if (!cur || e1 > cur.best1RMKg) {
          map.set(e.templateId, {
            templateId: e.templateId,
            title: e.title,
            date: w.startTime,
            best1RMKg: round1(e1),
            bestWeightKg: s.weightKg!,
            reps: s.reps!,
          });
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.best1RMKg - a.best1RMKg);
}

// ----------------------------------------------------------------------------
// Achievements (gamification)
// ----------------------------------------------------------------------------

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number; // 0..1
}

export function achievements(_d: Dataset, ov: Overview, cons: Consistency): Achievement[] {
  const tonnage = ov.totalVolumeKg;
  const hours = ov.totalDurationSec / 3600;

  const mk = (
    id: string,
    emoji: string,
    title: string,
    description: string,
    value: number,
    goal: number,
  ): Achievement => ({
    id,
    emoji,
    title,
    description,
    earned: value >= goal,
    progress: Math.max(0, Math.min(1, goal === 0 ? 1 : value / goal)),
  });

  return [
    mk("first", "🌱", "First Steps", "Log your first workout", ov.workouts, 1),
    mk("five", "🔥", "Getting Consistent", "Complete 5 workouts", ov.workouts, 5),
    mk("twenty", "🏋️", "Committed", "Complete 20 workouts", ov.workouts, 20),
    mk("fifty", "💎", "Iron Habit", "Complete 50 workouts", ov.workouts, 50),
    mk("ontarget", "🎯", "On Target", "Hit your weekly session goal", cons.weeksMetTarget, 1),
    mk("lockedin", "📆", "Locked In", "Hit your weekly goal 4 weeks running", cons.longestWeekStreak, 4),
    mk("ton", "🐘", "One Tonne Club", "Lift 1,000 kg of total volume", tonnage, 1000),
    mk("tenton", "🚛", "Ten Tonnes", "Lift 10,000 kg of total volume", tonnage, 10000),
    mk("hour", "⏱️", "Hour of Power", "Train for 1 total hour", hours, 1),
    mk("tenhours", "🕙", "Time Under Tension", "Train for 10 total hours", hours, 10),
    mk("explorer", "🧭", "Explorer", "Try 10 different exercises", ov.uniqueExercises, 10),
  ];
}

// ----------------------------------------------------------------------------
// formatting helpers
// ----------------------------------------------------------------------------

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor(totalSec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
