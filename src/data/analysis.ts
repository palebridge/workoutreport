import type {
  Dataset,
  DatasetExercise,
  DatasetSet,
  DatasetWorkout,
} from "./types";
import {
  addDays,
  dayDistance,
  displayDay,
  inRange,
  localDay,
  weekStart,
} from "./calendar";
import type { AnalysisContext, DateRange } from "./calendar";
import { eligibleE1RM, recordEvents } from "./records";

export type Metric =
  | "e1rm"
  | "load"
  | "reps"
  | "volume"
  | "duration"
  | "distance";
export const METRICS: Record<Metric, { label: string; unit: string }> = {
  e1rm: { label: "Estimated 1RM", unit: "kg" },
  load: { label: "Top load", unit: "kg" },
  reps: { label: "Top set reps", unit: "reps" },
  volume: { label: "Load volume", unit: "kg" },
  duration: { label: "Recorded time", unit: "sec" },
  distance: { label: "Recorded distance", unit: "m" },
};
export interface EvidenceRef {
  fingerprint: string;
  workoutId: string;
  exerciseIndex?: number;
  setIndex?: number;
}
export interface ExerciseSeries {
  id: string;
  title: string;
  muscle: string;
  equipment: string;
  type: string;
  metric: Metric;
  metrics: Metric[];
  points: SeriesPoint[];
  sessions: number;
  lastPerformed: string;
}
export interface SeriesPoint {
  workoutId: string;
  date: string;
  title: string;
  value: number | null;
  sets: number;
  rpe: number | null;
  isRecord: boolean;
  evidence: EvidenceRef;
}
export interface Finding {
  id: string;
  kind: "record" | "progress" | "frequency" | "workload";
  eyebrow: string;
  title: string;
  detail: string;
  samples: number;
  evidence: EvidenceRef[];
  target: {
    mode: "lifts" | "sessions" | "patterns";
    exerciseId?: string;
    workoutId?: string;
    weekStart?: string;
  };
}
export const working = (s: DatasetSet) => s.type !== "warmup";
export const included = (s: DatasetSet, includeWarmups: boolean) =>
  includeWarmups || working(s);
export const loadVolume = (s: DatasetSet) =>
  Math.max(0, s.weightKg ?? 0) * (s.reps ?? 0);
export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    (sorted[Math.floor((sorted.length - 1) / 2)] +
      sorted[Math.ceil((sorted.length - 1) / 2)]) /
    2
  );
};
export const percentChange = (
  current: number,
  previous: number,
): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;
export function scopedWorkouts(
  dataset: Dataset,
  context: AnalysisContext,
  range = context.range,
) {
  return dataset.workouts.filter((w) =>
    inRange(w.startTime, range, context.timezone),
  );
}
export function totals(workouts: DatasetWorkout[], includeWarmups = false) {
  let sets = 0,
    reps = 0,
    volume = 0,
    rpeCount = 0;
  for (const w of workouts)
    for (const e of w.exercises)
      for (const s of e.sets) {
        if (!included(s, includeWarmups)) continue;
        sets++;
        reps += s.reps ?? 0;
        volume += loadVolume(s);
        if (s.rpe != null) rpeCount++;
      }
  return {
    sessions: workouts.length,
    sets,
    reps,
    volume,
    duration: workouts.reduce((sum, w) => sum + w.durationSeconds, 0),
    rpeCount,
  };
}
export function fingerprint(dataset: Dataset): string {
  return (
    dataset.contentFingerprint ??
    `${dataset.generatedAt}:${dataset.workoutCount}`
  );
}
export function evidence(
  dataset: Dataset,
  workoutId: string,
  exerciseIndex?: number,
  setIndex?: number,
): EvidenceRef {
  return {
    fingerprint: fingerprint(dataset),
    workoutId,
    exerciseIndex,
    setIndex,
  };
}
export function resolveEvidence(dataset: Dataset, ref: EvidenceRef) {
  if (fingerprint(dataset) !== ref.fingerprint) return null;
  const workout = dataset.workouts.find((w) => w.id === ref.workoutId);
  if (!workout) return null;
  const exercise =
    ref.exerciseIndex == null
      ? undefined
      : workout.exercises.find((e) => e.index === ref.exerciseIndex);
  if (ref.exerciseIndex != null && !exercise) return null;
  const set =
    ref.setIndex == null
      ? undefined
      : exercise?.sets.find((s) => s.index === ref.setIndex);
  if (ref.setIndex != null && !set) return null;
  return { workout, exercise, set };
}
interface DatasetIndex {
  metrics: Map<string, Metric[]>;
  records: Set<string>;
  series: Map<string, ExerciseSeries[]>;
}
const indexCache = new WeakMap<
  Dataset["workouts"],
  WeakMap<Dataset["templates"], DatasetIndex>
>();
const SERIES_CACHE_LIMIT = 24;
/** Index each immutable workout/template snapshot once, including metadata-only refreshes. */
function datasetIndex(dataset: Dataset): DatasetIndex {
  let byTemplates = indexCache.get(dataset.workouts);
  if (!byTemplates) {
    byTemplates = new WeakMap();
    indexCache.set(dataset.workouts, byTemplates);
  }
  const cached = byTemplates.get(dataset.templates);
  if (cached) return cached;
  const flags = new Map<string, Set<Metric>>();
  for (const w of dataset.workouts)
    for (const e of w.exercises) {
      let available = flags.get(e.templateId);
      if (!available) {
        available = new Set();
        flags.set(e.templateId, available);
      }
      const template = dataset.templates[e.templateId];
      for (const s of e.sets) {
        if (eligibleE1RM(s, template) != null) available.add("e1rm");
        if (s.weightKg != null) available.add("load");
        if (s.reps != null) available.add("reps");
        if (
          template?.type === "weight_reps" &&
          s.weightKg != null &&
          s.reps != null
        )
          available.add("volume");
        if (s.durationSeconds != null) available.add("duration");
        if (s.distanceMeters != null) available.add("distance");
      }
    }
  const order: Metric[] = [
    "e1rm",
    "load",
    "reps",
    "volume",
    "duration",
    "distance",
  ];
  const metrics = new Map<string, Metric[]>();
  for (const [id, available] of flags) {
    const supported = order.filter((metric) => available.has(metric));
    metrics.set(id, supported.length ? supported : ["reps"]);
  }
  const index: DatasetIndex = {
    metrics,
    series: new Map(),
    records: new Set(
      recordEvents(dataset)
        .filter((e) => e.previous !== null)
        .map((e) => `${e.workoutId}:${e.templateId}`),
    ),
  };
  byTemplates.set(dataset.templates, index);
  return index;
}
export function metricsFor(dataset: Dataset, id: string): Metric[] {
  return datasetIndex(dataset).metrics.get(id) ?? ["reps"];
}
function metricObservation(
  exercises: DatasetExercise[],
  dataset: Dataset,
  metric: Metric,
  includeWarmups: boolean,
) {
  let value: number | null = null;
  let exerciseIndex: number | undefined, setIndex: number | undefined;
  for (const e of exercises)
    for (const s of e.sets) {
      if (!included(s, includeWarmups)) continue;
      const candidate =
        metric === "e1rm"
          ? eligibleE1RM(s, dataset.templates[e.templateId])
          : metric === "volume"
            ? s.weightKg != null && s.reps != null
              ? loadVolume(s)
              : null
            : metric === "load"
              ? s.weightKg
              : metric === "reps"
                ? s.reps
                : metric === "duration"
                  ? s.durationSeconds
                  : s.distanceMeters;
      if (candidate == null) continue;
      if (metric === "volume") value = (value ?? 0) + candidate;
      else if (value == null || candidate > value) {
        value = candidate;
        exerciseIndex = e.index;
        setIndex = s.index;
      }
    }
  // Aggregate volume cites the workout; maximum metrics cite their actual contributing set.
  return { value, exerciseIndex, setIndex };
}
export function sessionMetric(
  exercises: DatasetExercise[],
  dataset: Dataset,
  metric: Metric,
  includeWarmups: boolean,
): number | null {
  return metricObservation(exercises, dataset, metric, includeWarmups).value;
}
export function exerciseSeries(
  dataset: Dataset,
  context: AnalysisContext,
  selectedMetric?: Metric,
  range = context.range,
): ExerciseSeries[] {
  const index = datasetIndex(dataset);
  // now/comparison do not affect this selector; the explicit date window does.
  const cacheKey = JSON.stringify([
    fingerprint(dataset),
    range.start,
    range.end,
    context.timezone,
    context.includeWarmups,
    selectedMetric ?? null,
  ]);
  const cached = index.series.get(cacheKey);
  if (cached) {
    index.series.delete(cacheKey);
    index.series.set(cacheKey, cached);
    return cached;
  }
  const workouts = scopedWorkouts(dataset, context, range);
  const map = new Map<string, ExerciseSeries>();
  const records = index.records;
  for (const w of workouts) {
    const ids = new Set(w.exercises.map((e) => e.templateId));
    for (const id of ids) {
      const exercises = w.exercises.filter((e) => e.templateId === id);
      let series = map.get(id);
      if (!series) {
        const metrics = metricsFor(dataset, id);
        const template = dataset.templates[id];
        series = {
          id,
          title: exercises[0].title,
          muscle: template?.primaryMuscleGroup ?? "unclassified",
          equipment: template?.equipment ?? "unknown",
          type: template?.type ?? "unknown",
          metric:
            selectedMetric && metrics.includes(selectedMetric)
              ? selectedMetric
              : metrics[0],
          metrics,
          points: [],
          sessions: 0,
          lastPerformed: w.startTime,
        };
        map.set(id, series);
      }
      const sets = exercises
        .flatMap((e) => e.sets)
        .filter((s) => included(s, context.includeWarmups));
      const observation = metricObservation(
        exercises,
        dataset,
        series.metric,
        context.includeWarmups,
      );
      series.points.push({
        workoutId: w.id,
        date: localDay(w.startTime, context.timezone),
        title: w.title,
        value: observation.value,
        sets: sets.length,
        rpe: median(sets.flatMap((s) => (s.rpe == null ? [] : [s.rpe]))),
        isRecord: series.metric === "e1rm" && records.has(`${w.id}:${id}`),
        evidence: evidence(
          dataset,
          w.id,
          observation.exerciseIndex,
          observation.setIndex,
        ),
      });
      series.sessions++;
      series.lastPerformed = w.startTime;
    }
  }
  const result = [...map.values()].sort(
    (a, b) =>
      b.sessions - a.sessions ||
      Date.parse(b.lastPerformed) - Date.parse(a.lastPerformed),
  );
  index.series.set(cacheKey, result);
  if (index.series.size > SERIES_CACHE_LIMIT)
    index.series.delete(index.series.keys().next().value!);
  return result;
}
export interface WeekBucket {
  start: string;
  label: string;
  sessions: number;
  sets: number;
  volume: number;
  duration: number;
  workoutIds: string[];
  partial: boolean;
}
export function weeklyBuckets(
  dataset: Dataset,
  context: AnalysisContext,
): WeekBucket[] {
  const map = new Map<string, WeekBucket>();
  for (
    let start = weekStart(context.range.start);
    start <= context.range.end;
    start = addDays(start, 7)
  ) {
    map.set(start, {
      start,
      label: displayDay(start),
      sessions: 0,
      sets: 0,
      volume: 0,
      duration: 0,
      workoutIds: [],
      partial:
        start < context.range.start || addDays(start, 6) > context.range.end,
    });
  }
  for (const w of scopedWorkouts(dataset, context)) {
    const row = map.get(weekStart(localDay(w.startTime, context.timezone)))!;
    const t = totals([w], context.includeWarmups);
    row.sessions++;
    row.sets += t.sets;
    row.volume += t.volume;
    row.duration += t.duration;
    row.workoutIds.push(w.id);
  }
  return [...map.values()];
}
export interface MuscleRow {
  muscle: string;
  primary: number;
  secondary: number;
  weeks: Record<string, number>;
  workoutIds: string[];
}
export function muscleDistribution(
  dataset: Dataset,
  context: AnalysisContext,
): { rows: MuscleRow[]; classified: number; total: number } {
  const map = new Map<string, MuscleRow>();
  let total = 0,
    classified = 0;
  const get = (muscle: string) => {
    let row = map.get(muscle);
    if (!row) {
      row = { muscle, primary: 0, secondary: 0, weeks: {}, workoutIds: [] };
      map.set(muscle, row);
    }
    return row;
  };
  for (const w of scopedWorkouts(dataset, context))
    for (const e of w.exercises) {
      const count = e.sets.filter(working).length;
      total += count;
      const template = dataset.templates[e.templateId];
      if (!template?.primaryMuscleGroup) continue;
      classified += count;
      const row = get(template.primaryMuscleGroup);
      row.primary += count;
      const week = weekStart(localDay(w.startTime, context.timezone));
      row.weeks[week] = (row.weeks[week] ?? 0) + count;
      if (!row.workoutIds.includes(w.id)) row.workoutIds.push(w.id);
      for (const muscle of new Set(
        template.secondaryMuscleGroups.filter(
          (m) => m !== template.primaryMuscleGroup,
        ),
      ))
        get(muscle).secondary += count;
    }
  return {
    rows: [...map.values()].sort(
      (a, b) => b.primary - a.primary || a.muscle.localeCompare(b.muscle),
    ),
    total,
    classified,
  };
}
export function routineKey(w: DatasetWorkout): string {
  return w.routineId
    ? `routine:${w.routineId}`
    : `exercises:${w.exercises.map((e) => e.templateId).join("|")}`;
}
export function compareSessions(
  a: DatasetWorkout,
  b: DatasetWorkout,
  includeWarmups: boolean,
) {
  const slots = (w: DatasetWorkout) => {
    const count = new Map<string, number>();
    return w.exercises.map((e) => {
      const n = count.get(e.templateId) ?? 0;
      count.set(e.templateId, n + 1);
      return { key: `${e.templateId}:${n}`, e };
    });
  };
  const left = slots(a),
    right = slots(b);
  return [...new Set([...left, ...right].map((s) => s.key))].map((key) => {
    const before = left.find((s) => s.key === key)?.e,
      after = right.find((s) => s.key === key)?.e;
    const summarize = (e?: DatasetExercise) => {
      const sets = e?.sets.filter((s) => included(s, includeWarmups)) ?? [];
      return {
        sets: sets.length,
        reps: sets.reduce((n, s) => n + (s.reps ?? 0), 0),
        volume: sets.reduce((n, s) => n + loadVolume(s), 0),
      };
    };
    const old = summarize(before),
      current = summarize(after);
    return {
      key,
      title: (after ?? before)!.title,
      before: old,
      after: current,
      delta: current.volume - old.volume,
      status: !before ? "Added" : !after ? "Removed" : "Matched",
    };
  });
}
export function buildFindings(
  dataset: Dataset,
  context: AnalysisContext,
  series: ExerciseSeries[],
): Finding[] {
  const current = scopedWorkouts(dataset, context);
  if (!current.length) return [];
  const findings: Finding[] = [];
  const records = recordEvents(dataset).filter(
    (e) =>
      e.previous !== null && inRange(e.date, context.range, context.timezone),
  );
  if (records.length) {
    const latest = records[records.length - 1];
    findings.push({
      id: "records",
      kind: "record",
      eyebrow: "A new benchmark",
      title: `${records.length} record${records.length === 1 ? "" : "s"} moved forward.`,
      detail: `${latest.title} set a new estimated-strength best on ${displayDay(localDay(latest.date, context.timezone))}.`,
      samples: records.length,
      evidence: records.map((r) =>
        evidence(dataset, r.workoutId, r.exerciseIndex, r.setIndex),
      ),
      target: {
        mode: "lifts",
        exerciseId: latest.templateId,
        workoutId: latest.workoutId,
      },
    });
  }
  if (context.comparison) {
    const prior = exerciseSeries(
      dataset,
      context,
      undefined,
      context.comparison,
    );
    const changes = series
      .flatMap((s) => {
        if (s.metric !== "e1rm") return [];
        const before = prior.find((p) => p.id === s.id);
        const nowPoints = s.points.filter((p) => p.value != null);
        const oldPoints = before?.points.filter((p) => p.value != null) ?? [];
        const nowValues = nowPoints.map((p) => p.value!);
        const oldValues = oldPoints.map((p) => p.value!);
        if (nowValues.length < 3 || oldValues.length < 3) return [];
        const delta = percentChange(median(nowValues)!, median(oldValues)!);
        return delta != null && delta > 0.05
          ? [{ s, nowPoints, oldPoints, delta }]
          : [];
      })
      .sort((a, b) => b.delta - a.delta);
    if (changes[0]) {
      const { s, nowPoints, oldPoints, delta } = changes[0];
      findings.push({
        id: "progress",
        kind: "progress",
        eyebrow: "Repeated progress",
        title: `${s.title}: +${delta.toFixed(1)}%.`,
        detail: `Median estimated strength across ${nowPoints.length} eligible sessions versus ${oldPoints.length} in the previous period.`,
        samples: nowPoints.length + oldPoints.length,
        evidence: [...nowPoints, ...oldPoints].map((p) => p.evidence),
        target: { mode: "lifts", exerciseId: s.id },
      });
    }
    const old = scopedWorkouts(dataset, context, context.comparison);
    const firstDay = dataset.workouts[0]
      ? localDay(dataset.workouts[0].startTime, context.timezone)
      : context.range.start;
    if (old.length && firstDay <= context.comparison.start) {
      const diff = current.length - old.length;
      findings.push({
        id: "frequency",
        kind: "frequency",
        eyebrow: "Your training rhythm",
        title:
          diff === 0
            ? "The rhythm is holding."
            : `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} session${Math.abs(diff) === 1 ? "" : "s"}.`,
        detail: `${current.length} sessions compared with ${old.length} over the preceding ${dayDistance(context.range.start, context.range.end) + 1} days.`,
        samples: current.length + old.length,
        evidence: [...current, ...old].map((w) => evidence(dataset, w.id)),
        target: { mode: "patterns" },
      });
    }
  }
  if (findings.length < 3) {
    const t = totals(current, context.includeWarmups);
    findings.push({
      id: "workload",
      kind: "workload",
      eyebrow: "The work behind the numbers",
      title: `${t.sets} ${context.includeWarmups ? "logged" : "working"} sets, one training story.`,
      detail: `Explore how the work is distributed across ${series.length} exercises and ${current.length} sessions.`,
      samples: current.length,
      evidence: current.map((w) => evidence(dataset, w.id)),
      target: { mode: "patterns" },
    });
  }
  return findings.slice(0, 3);
}
export function rangeLabel(range: DateRange): string {
  return `${displayDay(range.start, { day: "numeric", month: "short", ...(range.start.slice(0, 4) !== range.end.slice(0, 4) ? { year: "numeric" as const } : {}) })} — ${displayDay(range.end, { day: "numeric", month: "short", year: "numeric" })}`;
}
