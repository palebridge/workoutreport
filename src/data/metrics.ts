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

/**
 * A set that represents actual resistance/rep work. Duration-only entries
 * (timed warm-ups, stretching) shouldn't count toward muscle-balance sets.
 */
export function isCountableSet(s: DatasetSet): boolean {
  return isWorkingSet(s) && (s.reps != null || s.weightKg != null);
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

// Validated categorical palette (dataviz six-checks, dark surface #10131b):
// lightness band, chroma floor, CVD ΔE 39.3, contrast ≥3:1 all pass. Keep the
// slot order fixed — it is the CVD-safety mechanism, not cosmetic.
export const CATEGORY_COLORS: Record<MuscleCategory, string> = {
  Push: "#e11d48",
  Pull: "#0891b2",
  Legs: "#059669",
  Core: "#d97706",
  Other: "#8b5cf6",
};

/** Single-series accent colors reused across the standalone charts. */
export const CHART = {
  accent: "#8b5cf6", // violet — primary line/marks
  volume: "#059669", // emerald — tonnage
  time: "#0891b2", // cyan — duration
  pr: "#d97706", // amber — PR markers
  grid: "rgba(255,255,255,0.06)",
  surface: "#10131b", // card surface (for surface gaps/rings on marks)
} as const;

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
      const working = e.sets.filter(isCountableSet);
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

export interface WeekSessions {
  /** short label of the week's Monday, e.g. "Jun 29" */
  label: string;
  count: number;
  onTarget: boolean;
}

export interface Consistency {
  /** dayKey -> number of workouts that day (for the calendar heatmap) */
  byDay: Record<string, number>;
  /** contiguous week-by-week session counts, first workout's week → now */
  weeks: WeekSessions[];
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
  const weeks: WeekSessions[] = [];
  if (d.workouts.length > 0) {
    const firstStart = isoWeek(d.workouts[0].startTime).weekStart;
    const cursor = new Date(firstStart);
    while (cursor.getTime() <= currentWeekStart.getTime()) {
      const count = perWeek.get(isoWeek(cursor.toISOString()).key) ?? 0;
      counts.push(count);
      weeks.push({ label: shortDate(cursor.toISOString()), count, onTarget: count >= target });
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
    weeks,
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
// Weekday rhythm — which days of the week training happens on
// ----------------------------------------------------------------------------

export interface WeekdayCount {
  day: string;
  count: number;
}

export function weekdayRhythm(d: Dataset): WeekdayCount[] {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const counts = new Array(7).fill(0) as number[];
  for (const w of d.workouts) {
    counts[(new Date(w.startTime).getDay() + 6) % 7] += 1;
  }
  return names.map((day, i) => ({ day, count: counts[i] }));
}

// ----------------------------------------------------------------------------
// Insights — computed "coach's notes" from the data
// ----------------------------------------------------------------------------

export interface Insight {
  id: string;
  emoji: string;
  text: string;
}

export function buildInsights(
  d: Dataset,
  ov: Overview,
  cons: Consistency,
  muscles: MuscleStat[],
  badges: Achievement[],
): Insight[] {
  const out: Insight[] = [];

  // Weekly goal status
  const remaining = cons.target - cons.sessionsThisWeek;
  if (ov.workouts > 0) {
    out.push(
      remaining <= 0
        ? { id: "goal", emoji: "✅", text: `Weekly goal hit — ${cons.sessionsThisWeek} of ${cons.target} sessions done. Anything extra is a bonus.` }
        : { id: "goal", emoji: "🎯", text: `${remaining} more session${remaining > 1 ? "s" : ""} to hit this week's goal of ${cons.target}.` },
    );
  }

  // Time since last session
  if (ov.lastWorkout) {
    const days = Math.floor((Date.now() - Date.parse(ov.lastWorkout)) / 86400000);
    if (days >= 4) {
      out.push({ id: "gap", emoji: "⏰", text: `It's been ${days} days since your last session — a short one still counts.` });
    } else if (days >= 0) {
      out.push({
        id: "gap",
        emoji: "💪",
        text: days === 0 ? "You trained today. Recovery is where the growth happens." : `Last session ${days} day${days > 1 ? "s" : ""} ago — right on rhythm.`,
      });
    }
  }

  // Muscle balance callout (needs enough data to be meaningful)
  if (muscles.length >= 3) {
    const most = muscles[0];
    const least = muscles[muscles.length - 1];
    if (most.sets >= least.sets * 2) {
      out.push({
        id: "balance",
        emoji: "⚖️",
        text: `${least.label} is getting the least attention (${least.sets} weighted sets vs ${most.sets} for ${most.label.toLowerCase()}) — worth a couple of sets next visit.`,
      });
    } else {
      out.push({ id: "balance", emoji: "⚖️", text: `Training is nicely balanced — ${most.label.toLowerCase()} leads with ${most.sets} weighted sets, nothing is badly lagging.` });
    }
  }

  // Progression: biggest est-1RM improvement across repeated exercises
  let bestGain: { title: string; gainKg: number } | null = null;
  const byTemplate = new Map<string, ProgressPoint[]>();
  const ids = new Set<string>();
  for (const w of d.workouts) for (const e of w.exercises) ids.add(e.templateId);
  for (const id of ids) byTemplate.set(id, exerciseProgress(d, id));
  for (const [id, pts] of byTemplate) {
    const strength = pts.filter((p) => p.est1RMKg > 0);
    if (strength.length >= 2) {
      const gain = strength[strength.length - 1].est1RMKg - strength[0].est1RMKg;
      if (gain > 0 && (!bestGain || gain > bestGain.gainKg)) {
        const t = d.templates[id];
        bestGain = { title: t?.title ?? "an exercise", gainKg: Math.round(gain * 10) / 10 };
      }
    }
  }
  if (bestGain) {
    out.push({ id: "gain", emoji: "📈", text: `${bestGain.title} est. 1RM is up ${bestGain.gainKg} kg since you started — progress is compounding.` });
  } else if (ov.workouts >= 2) {
    out.push({ id: "gain", emoji: "📈", text: "Repeat an exercise from an earlier session to unlock progression tracking — same lift, add a rep or a little weight." });
  }

  // Next badge within reach
  const next = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.progress - a.progress)[0];
  if (next) {
    out.push({ id: "badge", emoji: next.emoji, text: `Next badge in reach: ${next.title} — ${next.description.toLowerCase()}.` });
  }

  return out.slice(0, 4);
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
// Routine progression — how a repeated workout develops over time
// ----------------------------------------------------------------------------

export interface RoutinePoint {
  date: string;
  label: string;
  volumeKg: number;
  durationMin: number;
  sets: number;
}

export interface RoutineSeries {
  /** routineId when Hevy provides one, else the workout title */
  key: string;
  title: string;
  timesPerformed: number;
  points: RoutinePoint[]; // oldest first
}

export function routineProgress(d: Dataset): RoutineSeries[] {
  const map = new Map<string, RoutineSeries>();
  for (const w of d.workouts) {
    const key = w.routineId ?? w.title;
    let volumeKg = 0;
    let sets = 0;
    for (const e of w.exercises)
      for (const s of e.sets) {
        sets += 1;
        volumeKg += setVolumeKg(s);
      }
    const cur =
      map.get(key) ??
      ({ key, title: w.title, timesPerformed: 0, points: [] } as RoutineSeries);
    cur.timesPerformed += 1;
    cur.title = w.title; // keep the most recent name if it was renamed
    cur.points.push({
      date: w.startTime,
      label: shortDate(w.startTime),
      volumeKg: Math.round(volumeKg),
      durationMin: Math.round(w.durationSeconds / 60),
      sets,
    });
    map.set(key, cur);
  }
  // Most-performed first, ties by most recent.
  return [...map.values()].sort(
    (a, b) =>
      b.timesPerformed - a.timesPerformed ||
      Date.parse(b.points[b.points.length - 1].date) - Date.parse(a.points[a.points.length - 1].date),
  );
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
    // Count each workout once per exercise, even if the exercise appears in
    // multiple slots (e.g. split across supersets).
    const seenThisWorkout = new Set<string>();
    for (const e of w.exercises) {
      // Duration-only entries (timed warm-ups, stretching) aren't trackable
      // lifts — keep them out of the progress picker entirely.
      if (!e.sets.some(isCountableSet)) continue;
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
      if (!seenThisWorkout.has(e.templateId)) {
        cur.sessions += 1;
        seenThisWorkout.add(e.templateId);
      }
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

export interface PRWallEntry {
  templateId: string;
  title: string;
  muscle: string | null;
  /** heaviest weight ever moved on this lift, with the reps of that set */
  heaviestKg: number;
  heaviestReps: number;
  best1RMKg: number;
  /** when the current best est-1RM was set */
  date: string;
  /** sessions that beat a previous best (0 = only the baseline so far) */
  timesImproved: number;
  sessions: number;
}

/** Full per-exercise record wall, newest record first. */
export function prWall(d: Dataset): PRWallEntry[] {
  const map = new Map<string, PRWallEntry>();
  const seenSessions = new Map<string, Set<string>>();
  for (const w of d.workouts) {
    const sessionBest = new Map<string, number>();
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!isStrengthSet(s) || !isWorkingSet(s)) continue;
        let cur = map.get(e.templateId);
        if (!cur) {
          cur = {
            templateId: e.templateId,
            title: e.title,
            muscle: d.templates[e.templateId]?.primaryMuscleGroup ?? null,
            heaviestKg: 0,
            heaviestReps: 0,
            best1RMKg: 0,
            date: w.startTime,
            timesImproved: 0,
            sessions: 0,
          };
          map.set(e.templateId, cur);
        }
        if (
          s.weightKg! > cur.heaviestKg ||
          (s.weightKg! === cur.heaviestKg && s.reps! > cur.heaviestReps)
        ) {
          cur.heaviestKg = s.weightKg!;
          cur.heaviestReps = s.reps!;
        }
        const e1 = epley1RM(s.weightKg!, s.reps!);
        if (e1 > (sessionBest.get(e.templateId) ?? 0)) sessionBest.set(e.templateId, e1);
        const sessions = seenSessions.get(e.templateId) ?? new Set<string>();
        sessions.add(w.id);
        seenSessions.set(e.templateId, sessions);
      }
    }
    for (const [id, e1] of sessionBest) {
      const cur = map.get(id)!;
      if (e1 > cur.best1RMKg) {
        if (cur.best1RMKg > 0) cur.timesImproved += 1;
        cur.best1RMKg = Math.round(e1 * 10) / 10;
        cur.date = w.startTime;
      }
    }
  }
  for (const [id, sessions] of seenSessions) {
    const cur = map.get(id);
    if (cur) cur.sessions = sessions.size;
  }
  return [...map.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
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

export type Medal = "bronze" | "silver" | "gold" | "platinum";
export const MEDALS: Medal[] = ["bronze", "silver", "gold", "platinum"];

export interface BadgeTier {
  threshold: number;
  name: string;
}

interface FamilyDef {
  id: string;
  icon: string;
  label: string;
  /** how the value reads in progress text, e.g. "sets" */
  unit: string;
  tiers: BadgeTier[]; // exactly 4: bronze → platinum
  describe: (threshold: number) => string;
  format?: (v: number) => string;
}

export interface BadgeFamily extends FamilyDef {
  value: number;
  /** number of tiers earned, 0–4 */
  earnedTiers: number;
  next: { tier: BadgeTier; medal: Medal; progress: number } | null;
}

export interface TrophySummary {
  families: BadgeFamily[];
  earnedBadges: number;
  totalBadges: number;
  /** bronze 10 · silver 25 · gold 50 · platinum 100 */
  score: number;
  heaviest: { weightKg: number; reps: number; title: string } | null;
  best1RM: { kg: number; title: string } | null;
  /** sessions where a previous personal best was beaten */
  prImprovements: number;
}

const MEDAL_SCORE: Record<Medal, number> = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

function familyDefs(): FamilyDef[] {
  const fmt = (v: number) => Math.round(v).toLocaleString();
  return [
    {
      id: "sessions", icon: "🏋️", label: "Sessions", unit: "workouts",
      tiers: [
        { threshold: 5, name: "First Five" },
        { threshold: 15, name: "Regular" },
        { threshold: 40, name: "Dedicated" },
        { threshold: 100, name: "Centurion" },
      ],
      describe: (n) => `complete ${fmt(n)} workouts`, format: fmt,
    },
    {
      id: "volume", icon: "🐘", label: "Total Volume", unit: "kg lifted",
      tiers: [
        { threshold: 1_000, name: "One Tonne Club" },
        { threshold: 10_000, name: "Ten Tonnes" },
        { threshold: 50_000, name: "Fifty Tonnes" },
        { threshold: 150_000, name: "Freight Train" },
      ],
      describe: (n) => `lift ${fmt(n)} kg of total volume`, format: fmt,
    },
    {
      id: "hours", icon: "⏱️", label: "Gym Time", unit: "hours",
      tiers: [
        { threshold: 1, name: "Hour of Power" },
        { threshold: 10, name: "Time Under Tension" },
        { threshold: 30, name: "Thirty Deep" },
        { threshold: 75, name: "Iron Hours" },
      ],
      describe: (n) => `train for ${fmt(n)} total hour${n > 1 ? "s" : ""}`,
      format: (v) => v.toFixed(1),
    },
    {
      id: "sets", icon: "📦", label: "Total Sets", unit: "sets",
      tiers: [
        { threshold: 100, name: "Century Club" },
        { threshold: 300, name: "Set Builder" },
        { threshold: 750, name: "Volume Dealer" },
        { threshold: 1_500, name: "Set Machine" },
      ],
      describe: (n) => `log ${fmt(n)} total sets`, format: fmt,
    },
    {
      id: "reps", icon: "🔁", label: "Total Reps", unit: "reps",
      tiers: [
        { threshold: 1_000, name: "The Grand" },
        { threshold: 3_000, name: "Rep Collector" },
        { threshold: 7_500, name: "Rep Dealer" },
        { threshold: 15_000, name: "Rep Tycoon" },
      ],
      describe: (n) => `perform ${fmt(n)} total reps`, format: fmt,
    },
    {
      id: "weeksOnGoal", icon: "🎯", label: "Weeks on Goal", unit: "weeks",
      tiers: [
        { threshold: 1, name: "On Target" },
        { threshold: 4, name: "Habit Forming" },
        { threshold: 12, name: "Quarter Master" },
        { threshold: 26, name: "Half-Year Strong" },
      ],
      describe: (n) => `hit your weekly goal in ${fmt(n)} week${n > 1 ? "s" : ""}`, format: fmt,
    },
    {
      id: "goalStreak", icon: "🔥", label: "Goal Streak", unit: "weeks running",
      tiers: [
        { threshold: 2, name: "Back to Back" },
        { threshold: 4, name: "Locked In" },
        { threshold: 8, name: "Unstoppable" },
        { threshold: 16, name: "Machine Mode" },
      ],
      describe: (n) => `hit your weekly goal ${fmt(n)} weeks in a row`, format: fmt,
    },
    {
      id: "exercises", icon: "🧭", label: "Exercise Variety", unit: "exercises",
      tiers: [
        { threshold: 5, name: "Sampler" },
        { threshold: 10, name: "Explorer" },
        { threshold: 20, name: "Connoisseur" },
        { threshold: 35, name: "Completionist" },
      ],
      describe: (n) => `try ${fmt(n)} different exercises`, format: fmt,
    },
    {
      id: "prs", icon: "⭐", label: "Records Beaten", unit: "PRs",
      tiers: [
        { threshold: 3, name: "Record Setter" },
        { threshold: 10, name: "Record Breaker" },
        { threshold: 25, name: "PR Hunter" },
        { threshold: 60, name: "Limit Pusher" },
      ],
      describe: (n) => `beat your own record ${fmt(n)} times`, format: fmt,
    },
  ];
}

/** Sessions where an already-tracked exercise beat its previous best est-1RM. */
export function countPrImprovements(d: Dataset): number {
  const best = new Map<string, number>();
  let improvements = 0;
  for (const w of d.workouts) {
    // Session best per exercise first, so multiple slots don't double count.
    const sessionBest = new Map<string, number>();
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!isStrengthSet(s) || !isWorkingSet(s)) continue;
        const e1 = epley1RM(s.weightKg!, s.reps!);
        if (e1 > (sessionBest.get(e.templateId) ?? 0)) sessionBest.set(e.templateId, e1);
      }
    }
    for (const [id, e1] of sessionBest) {
      const prev = best.get(id);
      if (prev !== undefined && e1 > prev) improvements += 1;
      if (prev === undefined || e1 > prev) best.set(id, e1);
    }
  }
  return improvements;
}

export function trophySummary(d: Dataset, ov: Overview, cons: Consistency): TrophySummary {
  const prImprovements = countPrImprovements(d);
  const values: Record<string, number> = {
    sessions: ov.workouts,
    volume: ov.totalVolumeKg,
    hours: ov.totalDurationSec / 3600,
    sets: ov.totalSets,
    reps: ov.totalReps,
    weeksOnGoal: cons.weeksMetTarget,
    goalStreak: cons.longestWeekStreak,
    exercises: ov.uniqueExercises,
    prs: prImprovements,
  };

  const families: BadgeFamily[] = familyDefs().map((f) => {
    const value = values[f.id] ?? 0;
    const earnedTiers = f.tiers.filter((t) => value >= t.threshold).length;
    const nextTier = f.tiers[earnedTiers];
    return {
      ...f,
      value,
      earnedTiers,
      next: nextTier
        ? {
            tier: nextTier,
            medal: MEDALS[earnedTiers],
            progress: Math.max(0, Math.min(1, value / nextTier.threshold)),
          }
        : null,
    };
  });

  let earnedBadges = 0;
  let score = 0;
  for (const f of families) {
    earnedBadges += f.earnedTiers;
    for (let i = 0; i < f.earnedTiers; i++) score += MEDAL_SCORE[MEDALS[i]];
  }

  // Hall-of-fame numbers
  let heaviest: TrophySummary["heaviest"] = null;
  let best1RM: TrophySummary["best1RM"] = null;
  for (const w of d.workouts) {
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!isStrengthSet(s) || !isWorkingSet(s)) continue;
        if (!heaviest || s.weightKg! > heaviest.weightKg) {
          heaviest = { weightKg: s.weightKg!, reps: s.reps!, title: e.title };
        }
        const e1 = epley1RM(s.weightKg!, s.reps!);
        if (!best1RM || e1 > best1RM.kg) {
          best1RM = { kg: Math.round(e1 * 10) / 10, title: e.title };
        }
      }
    }
  }

  return {
    families,
    earnedBadges,
    totalBadges: families.length * 4,
    score,
    heaviest,
    best1RM,
    prImprovements,
  };
}

// ----------------------------------------------------------------------------
// Journey — milestone timeline replayed from the workout history
// ----------------------------------------------------------------------------

export interface JourneyEvent {
  date: string; // ISO
  emoji: string;
  title: string;
  detail?: string;
  kind: "badge" | "pr" | "start" | "week";
}

export function journeyEvents(d: Dataset, target: number): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  if (d.workouts.length === 0) return events;

  const defs = familyDefs();
  const crossed = new Set<string>(); // "familyId:threshold"

  // Cumulative state, replayed workout by workout.
  let sessions = 0;
  let volume = 0;
  let seconds = 0;
  let sets = 0;
  let reps = 0;
  const exercises = new Set<string>();
  const best = new Map<string, number>();
  const weekCounts = new Map<string, number>();
  let weeksMet = 0;
  let streak = 0;
  let prevWeekKey: string | null = null;
  let prevWeekMet = false;
  let improvements = 0;

  const checkFamilies = (w: DatasetWorkoutLike) => {
    const values: Record<string, number> = {
      sessions,
      volume,
      hours: seconds / 3600,
      sets,
      reps,
      weeksOnGoal: weeksMet,
      goalStreak: streak,
      exercises: exercises.size,
      prs: improvements,
    };
    for (const f of defs) {
      for (let i = 0; i < f.tiers.length; i++) {
        const t = f.tiers[i];
        const key = `${f.id}:${t.threshold}`;
        if (!crossed.has(key) && (values[f.id] ?? 0) >= t.threshold) {
          crossed.add(key);
          events.push({
            date: w.startTime,
            emoji: f.icon,
            title: `${t.name} unlocked`,
            detail: `${capitalize(MEDALS[i])} · ${f.describe(t.threshold)}`,
            kind: "badge",
          });
        }
      }
    }
  };

  events.push({
    date: d.workouts[0].startTime,
    emoji: "🌱",
    title: "The journey begins",
    detail: d.workouts[0].title,
    kind: "start",
  });

  for (const w of d.workouts) {
    sessions += 1;
    seconds += w.durationSeconds;

    // Weekly goal bookkeeping: when a week's count reaches the target, log it.
    const wk = isoWeek(w.startTime).key;
    if (prevWeekKey !== null && wk !== prevWeekKey) {
      if (!prevWeekMet) streak = 0; // a completed week that missed the goal breaks the run
      prevWeekMet = false;
    }
    prevWeekKey = wk;
    const wkCount = (weekCounts.get(wk) ?? 0) + 1;
    weekCounts.set(wk, wkCount);
    if (wkCount === target) {
      weeksMet += 1;
      streak += 1;
      prevWeekMet = true;
      events.push({
        date: w.startTime,
        emoji: "✅",
        title: "Weekly goal hit",
        detail: `${target} sessions this week`,
        kind: "week",
      });
    }

    const sessionBest = new Map<string, { e1: number; title: string }>();
    for (const e of w.exercises) {
      exercises.add(e.templateId);
      for (const s of e.sets) {
        sets += 1;
        reps += s.reps ?? 0;
        volume += setVolumeKg(s);
        if (isStrengthSet(s) && isWorkingSet(s)) {
          const e1 = epley1RM(s.weightKg!, s.reps!);
          const cur = sessionBest.get(e.templateId);
          if (!cur || e1 > cur.e1) sessionBest.set(e.templateId, { e1, title: e.title });
        }
      }
    }
    for (const [id, { e1, title }] of sessionBest) {
      const prev = best.get(id);
      if (prev !== undefined && e1 > prev) {
        improvements += 1;
        events.push({
          date: w.startTime,
          emoji: "⭐",
          title: `New ${title} record`,
          detail: `est. 1RM ${round1kg(e1)} kg (+${round1kg(e1 - prev)})`,
          kind: "pr",
        });
      }
      if (prev === undefined || e1 > prev) best.set(id, e1);
    }

    checkFamilies(w);
  }

  // Newest first.
  return events.reverse();
}

interface DatasetWorkoutLike {
  startTime: string;
  title: string;
  durationSeconds: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round1kg(n: number): number {
  return Math.round(n * 10) / 10;
}

// ----------------------------------------------------------------------------
// Flat achievement list (kept for the insights "next badge in reach" nudge)
// ----------------------------------------------------------------------------

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  progress: number; // 0..1
}

export function achievements(d: Dataset, ov: Overview, cons: Consistency): Achievement[] {
  const summary = trophySummary(d, ov, cons);
  const out: Achievement[] = [];
  for (const f of summary.families) {
    for (let i = 0; i < f.earnedTiers; i++) {
      const t = f.tiers[i];
      out.push({
        id: `${f.id}:${t.threshold}`, emoji: f.icon, title: t.name,
        description: f.describe(t.threshold), earned: true, progress: 1,
      });
    }
    if (f.next) {
      out.push({
        id: `${f.id}:${f.next.tier.threshold}`, emoji: f.icon, title: f.next.tier.name,
        description: f.describe(f.next.tier.threshold), earned: false, progress: f.next.progress,
      });
    }
  }
  return out;
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
