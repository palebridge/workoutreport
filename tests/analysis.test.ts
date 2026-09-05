import assert from "node:assert/strict";
import test from "node:test";
import type { Dataset, DatasetWorkout, DatasetSet } from "../src/data/types";
import type { AnalysisContext } from "../src/data/calendar";
import {
  buildFindings,
  exerciseSeries,
  metricsFor,
  resolveEvidence,
} from "../src/data/analysis";
import { recordEvents } from "../src/data/records";
import { validateDataset } from "../src/data/validate";
import { markerPoints } from "../src/components/lab/Atlas";

const NOW = "2026-09-05T12:00:00Z";
const set = (weightKg: number, reps = 1, index = 0): DatasetSet => ({
  index,
  type: "normal",
  weightKg,
  reps,
  distanceMeters: null,
  durationSeconds: null,
  rpe: null,
});
function workout(
  id: string,
  startTime: string,
  sets = [set(50)],
): DatasetWorkout {
  return {
    id,
    title: id,
    routineId: null,
    description: "",
    startTime,
    endTime: new Date(Date.parse(startTime) + 3600000).toISOString(),
    durationSeconds: 3600,
    exercises: [
      { index: 0, title: "Lift", templateId: "lift", supersetId: null, sets },
    ],
  };
}
function dataset(workouts: DatasetWorkout[]): Dataset {
  const value = validateDataset({
    generatedAt: NOW,
    workouts,
    workoutCount: workouts.length,
    user: null,
    bodyMeasurements: [],
    templates: {
      lift: {
        id: "lift",
        title: "Lift",
        type: "weight_reps",
        primaryMuscleGroup: "chest",
        secondaryMuscleGroups: [],
        equipment: "barbell",
      },
    },
  });
  value.contentFingerprint = "a".repeat(64);
  return value;
}
const context = (
  overrides: Partial<AnalysisContext> = {},
): AnalysisContext => ({
  now: NOW,
  timezone: "UTC",
  includeWarmups: false,
  range: { start: "2026-08-01", end: "2026-09-05" },
  comparison: null,
  ...overrides,
});

test("timestamp offsets cannot reverse validation or record chronology", () => {
  const data = dataset([
    workout("earlier", "2026-09-01T12:00:00+02:00", [set(50)]),
    workout("later", "2026-09-01T10:30:00Z", [set(60)]),
  ]);
  assert.deepEqual(
    data.workouts.map((w) => w.id),
    ["earlier", "later"],
  );
  assert.deepEqual(
    recordEvents(data).map((event) => [
      event.workoutId,
      event.previous,
      event.value,
    ]),
    [
      ["earlier", null, 50],
      ["later", 50, 60],
    ],
  );
  const unsorted = { ...data, workouts: [...data.workouts].reverse() };
  assert.deepEqual(
    recordEvents(unsorted).map((event) => event.workoutId),
    ["earlier", "later"],
  );
});
test("measurement dates also sort by their actual instants", () => {
  const data = dataset([]);
  const parsed = validateDataset({
    ...data,
    bodyMeasurements: [
      { date: "2026-09-01T12:00:00+02:00", weightKg: 80, fatPercent: null },
      { date: "2026-09-01T10:30:00Z", weightKg: 81, fatPercent: null },
    ],
  });
  assert.deepEqual(
    parsed.bodyMeasurements.map((m) => m.weightKg),
    [80, 81],
  );
});
test("maximum evidence resolves the contributing repeated exercise and set", () => {
  const w = workout("repeat", "2026-09-01T12:00:00Z", [set(50)]);
  w.exercises.push({
    ...w.exercises[0],
    index: 1,
    sets: [set(90, 1, 0), set(100, 1, 1)],
  });
  const data = dataset([w]),
    point = exerciseSeries(data, context())[0].points[0];
  assert.equal(point.value, 100);
  assert.equal(point.evidence.exerciseIndex, 1);
  assert.equal(point.evidence.setIndex, 1);
  assert.equal(resolveEvidence(data, point.evidence)?.set?.weightKg, 100);
  const aggregate = exerciseSeries(data, context(), "volume")[0].points[0];
  assert.equal(aggregate.value, 240);
  assert.equal(aggregate.evidence.exerciseIndex, undefined);
  assert.equal(resolveEvidence(data, aggregate.evidence)?.workout.id, "repeat");
});
test("findings count and cite only observations included in their medians", () => {
  const workouts = [
    ...[1, 2, 3].map((day) =>
      workout(`old-${day}`, `2026-08-0${day}T12:00:00Z`, [set(50)]),
    ),
    workout("old-ineligible", "2026-08-04T12:00:00Z", [set(50, 30)]),
    ...[8, 9, 10].map((day) =>
      workout(
        `new-${day}`,
        `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
        [set(60)],
      ),
    ),
    workout("new-ineligible", "2026-08-11T12:00:00Z", [set(60, 30)]),
  ];
  const data = dataset(workouts),
    ctx = context({
      range: { start: "2026-08-08", end: "2026-08-14" },
      comparison: { start: "2026-08-01", end: "2026-08-07" },
    });
  const finding = buildFindings(data, ctx, exerciseSeries(data, ctx)).find(
    (f) => f.kind === "progress",
  );
  assert.ok(finding);
  assert.equal(finding.samples, 6);
  assert.match(finding.detail, /across 3 eligible sessions versus 3/);
  assert.equal(finding.evidence.length, 6);
  assert.ok(
    finding.evidence.every((ref) => !ref.workoutId.includes("ineligible")),
  );
});
test("metadata and minute-only changes reuse immutable indexes and series", () => {
  const data = dataset([workout("one", "2026-09-01T12:00:00Z")]),
    ctx = context();
  const series = exerciseSeries(data, ctx),
    events = recordEvents(data),
    metrics = metricsFor(data, "lift");
  const refreshed = { ...data, generatedAt: "2026-09-05T13:00:00Z" };
  assert.equal(recordEvents(refreshed), events);
  assert.equal(metricsFor(refreshed, "lift"), metrics);
  assert.equal(
    exerciseSeries(refreshed, { ...ctx, now: "2026-09-05T13:00:00Z" }),
    series,
  );
  assert.notEqual(
    exerciseSeries(data, { ...ctx, includeWarmups: true }),
    series,
  );
  assert.notEqual(
    exerciseSeries(data, { ...ctx, timezone: "Europe/Oslo" }),
    series,
  );
  assert.notEqual(exerciseSeries(data, ctx, "load"), series);
});
test("new workout or template identities invalidate their indexes", () => {
  const data = dataset([workout("one", "2026-09-01T12:00:00Z")]),
    oldEvents = recordEvents(data);
  const edited = {
    ...data,
    workouts: [
      ...data.workouts,
      workout("two", "2026-09-02T12:00:00Z", [set(70)]),
    ],
  };
  assert.notEqual(recordEvents(edited), oldEvents);
  assert.equal(recordEvents(edited).length, 2);
  const reclassified = {
    ...data,
    templates: { lift: { ...data.templates.lift, type: "duration" } },
  };
  assert.deepEqual(recordEvents(reclassified), []);
  assert.ok(!metricsFor(reclassified, "lift").includes("e1rm"));
});
test("series cache evicts old filter combinations instead of growing indefinitely", () => {
  const data = dataset([workout("one", "2026-09-01T12:00:00Z")]),
    initial = context(),
    first = exerciseSeries(data, initial);
  for (let day = 1; day <= 25; day++) {
    exerciseSeries(
      data,
      context({
        range: {
          start: `2026-08-${String(day).padStart(2, "0")}`,
          end: "2026-09-04",
        },
      }),
    );
  }
  assert.notEqual(exerciseSeries(data, initial), first);
});
test("long charts sample interaction markers without changing source points", () => {
  const data = dataset(
    Array.from({ length: 100 }, (_, index) =>
      workout(
        `w-${index}`,
        new Date(
          Date.parse("2026-05-01T12:00:00Z") + index * 86400000,
        ).toISOString(),
        [set(index === 11 ? 1 : index === 87 ? 1000 : 50)],
      ),
    ),
  );
  const points = exerciseSeries(
    data,
    context({ range: { start: "2026-05-01", end: "2026-09-05" } }),
  )[0].points;
  const original = [...points],
    markers = markerPoints(points);
  assert.equal(points.length, 100);
  assert.deepEqual(points, original);
  assert.ok(markers.length >= 40 && markers.length <= 44);
  assert.ok(markers.includes(points[0]) && markers.includes(points[99]));
  assert.ok(markers.includes(points[11]) && markers.includes(points[87]));
  assert.deepEqual(markerPoints(points.slice(0, 20)), points.slice(0, 20));
});
