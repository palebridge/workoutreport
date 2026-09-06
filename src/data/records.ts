import type { Dataset, DatasetSet, TemplateMeta } from "./types";

export function eligibleE1RM(
  set: DatasetSet,
  template?: TemplateMeta,
): number | null {
  if (
    template?.type !== "weight_reps" ||
    set.type === "warmup" ||
    !Number.isFinite(set.weightKg) ||
    set.weightKg == null ||
    set.weightKg <= 0 ||
    set.reps == null ||
    !Number.isInteger(set.reps) ||
    set.reps < 1 ||
    set.reps > 10
  )
    return null;
  return set.reps === 1 ? set.weightKg : set.weightKg * (1 + set.reps / 30);
}
export interface RecordEvent {
  workoutId: string;
  templateId: string;
  exerciseIndex: number;
  setIndex: number;
  title: string;
  date: string;
  value: number;
  previous: number | null;
  weightKg: number;
  reps: number;
}
// The published dataset is immutable. A metadata-only refresh keeps these identities.
const recordCache = new WeakMap<
  Dataset["workouts"],
  WeakMap<Dataset["templates"], readonly RecordEvent[]>
>();

/** One event per exercise and session, including separately identifiable baselines. */
export function recordEvents(dataset: Dataset): readonly RecordEvent[] {
  let byTemplates = recordCache.get(dataset.workouts);
  if (!byTemplates) {
    byTemplates = new WeakMap();
    recordCache.set(dataset.workouts, byTemplates);
  }
  const cached = byTemplates.get(dataset.templates);
  if (cached) return cached;
  const best = new Map<string, number>();
  const events: RecordEvent[] = [];
  for (const workout of [...dataset.workouts].sort(
    (a, b) =>
      Date.parse(a.startTime) - Date.parse(b.startTime) ||
      a.id.localeCompare(b.id),
  )) {
    const session = new Map<string, RecordEvent>();
    for (const exercise of workout.exercises)
      for (const set of exercise.sets) {
        const value = eligibleE1RM(set, dataset.templates[exercise.templateId]);
        if (
          value == null ||
          value <= (session.get(exercise.templateId)?.value ?? 0)
        )
          continue;
        session.set(exercise.templateId, {
          workoutId: workout.id,
          templateId: exercise.templateId,
          exerciseIndex: exercise.index,
          setIndex: set.index,
          title: exercise.title,
          date: workout.startTime,
          value,
          previous: best.get(exercise.templateId) ?? null,
          weightKg: set.weightKg!,
          reps: set.reps!,
        });
      }
    for (const [id, event] of session) {
      if (event.previous === null || event.value > event.previous + 1e-9) {
        events.push(event);
        best.set(id, event.value);
      }
    }
  }
  const result = Object.freeze(events.map((event) => Object.freeze(event)));
  byTemplates.set(dataset.templates, result);
  return result;
}
