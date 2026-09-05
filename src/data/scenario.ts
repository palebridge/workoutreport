import {
  fingerprint,
  median,
  percentChange,
  routineKey,
  totals,
  working,
} from "./analysis";
import { addDays, localDay, weekStart as startOfWeek } from "./calendar";
import type {
  Dataset,
  DatasetSet,
  DatasetWorkout,
  TemplateMeta,
} from "./types";

export interface ScenarioSession {
  id: string;
  sourceWorkoutId: string;
  /** Calendar day in the scenario's selected timezone; copied timestamps remain provenance. */
  day: string;
  workout: DatasetWorkout;
}
export interface ScenarioDraft {
  sourceFingerprint: string;
  weekStart: string;
  timezone: string;
  /** Only recorded external-resistance templates may have their sets changed. */
  editableTemplateIds: string[];
  sessions: ScenarioSession[];
}
export interface ScenarioTotals {
  sessions: number;
  sets: number;
  reps: number;
  volume: number;
}
export interface ScenarioResult {
  /** The UI must reset a stale draft before displaying its results. */
  stale: boolean;
  baseline: ScenarioTotals;
  scenario: ScenarioTotals;
  delta: ScenarioTotals;
  percent: Record<keyof ScenarioTotals, number | null>;
  baselineMuscles: Record<string, number>;
  scenarioMuscles: Record<string, number>;
  timeEstimate: {
    seconds: number | null;
    /** Observed historical rate bounds, not a prediction interval. */
    minSeconds: number | null;
    maxSeconds: number | null;
    /** Distinct historical sessions, never the number of scenario duplicates. */
    samples: number;
    coveredSessions: number;
    totalSessions: number;
  };
}

const cloneWorkout = (workout: DatasetWorkout): DatasetWorkout => ({
  ...workout,
  exercises: workout.exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  })),
});

export function availableScenarioWeeks(
  dataset: Dataset,
  now: string,
  timezone: string,
): string[] {
  const currentWeek = startOfWeek(localDay(now, timezone));
  return [
    ...new Set(
      dataset.workouts.map((workout) =>
        startOfWeek(localDay(workout.startTime, timezone)),
      ),
    ),
  ]
    .filter((week) => week < currentWeek)
    .sort()
    .reverse();
}

/** Calling again with the same source week is the reset operation. */
export function seedScenario(
  dataset: Dataset,
  weekStart: string,
  timezone: string,
): ScenarioDraft {
  const start = startOfWeek(weekStart),
    end = addDays(start, 6);
  const sessions = dataset.workouts
    .filter((workout) => {
      const day = localDay(workout.startTime, timezone);
      return day >= start && day <= end;
    })
    .sort(
      (a, b) =>
        Date.parse(a.startTime) - Date.parse(b.startTime) ||
        a.id.localeCompare(b.id),
    )
    .map((workout) => ({
      id: `scenario:${workout.id}`,
      sourceWorkoutId: workout.id,
      day: localDay(workout.startTime, timezone),
      workout: cloneWorkout(workout),
    }));
  const editableTemplateIds = Object.entries(dataset.templates)
    .filter(([, template]) => template.type === "weight_reps")
    .map(([id]) => id)
    .sort();
  return {
    sourceFingerprint: fingerprint(dataset),
    weekStart: start,
    timezone,
    editableTemplateIds,
    sessions,
  };
}

function workload(workouts: DatasetWorkout[]): ScenarioTotals {
  const { sessions, sets, reps, volume } = totals(workouts);
  return { sessions, sets, reps, volume };
}

function directMuscleSets(
  dataset: Dataset,
  workouts: DatasetWorkout[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const workout of workouts)
    for (const exercise of workout.exercises) {
      const count = exercise.sets.filter(working).length;
      if (!count) continue;
      const muscle =
        dataset.templates[exercise.templateId]?.primaryMuscleGroup ||
        "unclassified";
      counts[muscle] = (counts[muscle] ?? 0) + count;
    }
  return counts;
}

function estimateTime(
  dataset: Dataset,
  sessions: ScenarioSession[],
): ScenarioResult["timeEstimate"] {
  const samples = new Set<string>();
  let seconds = 0,
    minSeconds = 0,
    maxSeconds = 0,
    coveredSessions = 0;
  for (const session of sessions) {
    const workout = session.workout;
    const signature = JSON.stringify(
      workout.exercises.map((exercise) => exercise.templateId),
    );
    const key = routineKey(workout);
    const matches = new Map<string, { secondsPerSet: number }>();
    for (const candidate of dataset.workouts) {
      if (
        routineKey(candidate) !== key ||
        JSON.stringify(
          candidate.exercises.map((exercise) => exercise.templateId),
        ) !== signature
      )
        continue;
      // Full recorded duration includes warmups and every other logged set.
      const sets = totals([candidate], true).sets;
      if (
        sets <= 0 ||
        !Number.isFinite(candidate.durationSeconds) ||
        candidate.durationSeconds <= 0
      )
        continue;
      matches.set(candidate.id, {
        secondsPerSet: candidate.durationSeconds / sets,
      });
    }
    const proposedSets = totals([workout], true).sets;
    if (matches.size < 3 || proposedSets <= 0) continue;
    coveredSessions++;
    for (const id of matches.keys()) samples.add(id);
    const rates = [...matches.values()].map((match) => match.secondsPerSet);
    seconds += median(rates)! * proposedSets;
    minSeconds += Math.min(...rates) * proposedSets;
    maxSeconds += Math.max(...rates) * proposedSets;
  }
  const complete = coveredSessions === sessions.length;
  return {
    seconds: complete ? Math.round(seconds) : null,
    minSeconds: complete ? Math.round(minSeconds) : null,
    maxSeconds: complete ? Math.round(maxSeconds) : null,
    samples: samples.size,
    coveredSessions,
    totalSessions: sessions.length,
  };
}

/** Exact copied workload, plus a separately labelled rough historical time estimate. */
export function scenarioResult(
  dataset: Dataset,
  draft: ScenarioDraft,
  timezone: string,
): ScenarioResult {
  const original = seedScenario(
    dataset,
    draft.weekStart,
    timezone,
  ).sessions.map((session) => session.workout);
  const proposed = draft.sessions.map((session) => session.workout);
  const baseline = workload(original),
    scenario = workload(proposed);
  const stale =
    draft.sourceFingerprint !== fingerprint(dataset) ||
    draft.timezone !== timezone;
  const timeEstimate = estimateTime(dataset, draft.sessions);
  if (stale)
    timeEstimate.seconds =
      timeEstimate.minSeconds =
      timeEstimate.maxSeconds =
        null;
  return {
    stale,
    baseline,
    scenario,
    delta: {
      sessions: scenario.sessions - baseline.sessions,
      sets: scenario.sets - baseline.sets,
      reps: scenario.reps - baseline.reps,
      volume: scenario.volume - baseline.volume,
    },
    percent: {
      sessions: percentChange(scenario.sessions, baseline.sessions),
      sets: percentChange(scenario.sets, baseline.sets),
      reps: percentChange(scenario.reps, baseline.reps),
      volume: percentChange(scenario.volume, baseline.volume),
    },
    baselineMuscles: directMuscleSets(dataset, original),
    scenarioMuscles: directMuscleSets(dataset, proposed),
    timeEstimate,
  };
}

export function duplicateScenarioSession(
  draft: ScenarioDraft,
  sessionId: string,
  newId: string,
): ScenarioDraft {
  const position = draft.sessions.findIndex(
    (session) => session.id === sessionId,
  );
  if (position < 0) return draft;
  if (!newId.trim() || draft.sessions.some((session) => session.id === newId))
    throw new Error("Scenario session IDs must be non-empty and unique.");
  const source = draft.sessions[position];
  const copy = { ...source, id: newId, workout: cloneWorkout(source.workout) };
  return {
    ...draft,
    sessions: [
      ...draft.sessions.slice(0, position + 1),
      copy,
      ...draft.sessions.slice(position + 1),
    ],
  };
}

export function removeScenarioSession(
  draft: ScenarioDraft,
  sessionId: string,
): ScenarioDraft {
  if (!draft.sessions.some((session) => session.id === sessionId)) return draft;
  return {
    ...draft,
    sessions: draft.sessions.filter((session) => session.id !== sessionId),
  };
}

/** Optional metadata checks the UI's template; mutations also enforce the seeded allowlist. */
export function isEditableScenarioSet(
  set: DatasetSet,
  template?: TemplateMeta,
): boolean {
  return (
    (!template || template.type === "weight_reps") &&
    working(set) &&
    set.weightKg != null &&
    Number.isFinite(set.weightKg) &&
    set.weightKg >= 0 &&
    set.reps != null &&
    Number.isInteger(set.reps) &&
    set.reps >= 0 &&
    set.durationSeconds == null &&
    set.distanceMeters == null
  );
}

function changeSets(
  draft: ScenarioDraft,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  change: (sets: DatasetSet[], position: number) => DatasetSet[],
): ScenarioDraft {
  const sessionPosition = draft.sessions.findIndex(
    (session) => session.id === sessionId,
  );
  if (sessionPosition < 0) return draft;
  const session = draft.sessions[sessionPosition];
  const exercisePosition = session.workout.exercises.findIndex(
    (exercise) => exercise.index === exerciseIndex,
  );
  if (exercisePosition < 0) return draft;
  const exercise = session.workout.exercises[exercisePosition];
  if (!draft.editableTemplateIds.includes(exercise.templateId)) return draft;
  const position = exercise.sets.findIndex((set) => set.index === setIndex);
  if (position < 0 || !isEditableScenarioSet(exercise.sets[position]))
    return draft;
  const exercises = session.workout.exercises.map((item, index) =>
    index === exercisePosition
      ? {
          ...item,
          sets: change(item.sets, position).map((set, index) => ({
            ...set,
            index,
          })),
        }
      : item,
  );
  return {
    ...draft,
    sessions: draft.sessions.map((item, index) =>
      index === sessionPosition
        ? { ...item, workout: { ...item.workout, exercises } }
        : item,
    ),
  };
}

export function duplicateScenarioSet(
  draft: ScenarioDraft,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
): ScenarioDraft {
  return changeSets(
    draft,
    sessionId,
    exerciseIndex,
    setIndex,
    (sets, position) => [
      ...sets.slice(0, position + 1),
      { ...sets[position] },
      ...sets.slice(position + 1),
    ],
  );
}

export function removeScenarioSet(
  draft: ScenarioDraft,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
): ScenarioDraft {
  return changeSets(
    draft,
    sessionId,
    exerciseIndex,
    setIndex,
    (sets, position) => sets.filter((_, index) => index !== position),
  );
}

export function editScenarioSet(
  draft: ScenarioDraft,
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  values: { weightKg?: number; reps?: number },
): ScenarioDraft {
  if (
    values.weightKg != null &&
    (!Number.isFinite(values.weightKg) || values.weightKg < 0)
  )
    return draft;
  if (
    values.reps != null &&
    (!Number.isInteger(values.reps) || values.reps < 1)
  )
    return draft;
  const changes = {
    ...(values.weightKg != null ? { weightKg: values.weightKg } : {}),
    ...(values.reps != null ? { reps: values.reps } : {}),
  };
  if (!Object.keys(changes).length) return draft;
  return changeSets(
    draft,
    sessionId,
    exerciseIndex,
    setIndex,
    (sets, position) =>
      sets.map((set, index) =>
        index === position ? { ...set, ...changes } : set,
      ),
  );
}
