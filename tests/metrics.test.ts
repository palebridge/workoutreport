import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  dayDistance,
  daysBetween,
  inRange,
  localDay,
  precedingRange,
  weekStart,
} from "../src/data/calendar";
import type { AnalysisContext } from "../src/data/calendar";
import {
  exerciseSeries,
  muscleDistribution,
  weeklyBuckets,
} from "../src/data/analysis";
import {
  consistency,
  countPrImprovements,
  exerciseProgress,
  journeyEvents,
  overview,
  personalRecords,
  prWall,
  trophySummary,
} from "../src/data/metrics";
import { eligibleE1RM, recordEvents } from "../src/data/records";
import {
  contentHash,
  validateDataset,
  validateEnvelope,
} from "../src/data/validate";
import { decryptDataset, WrongPasswordError } from "../src/crypto/decrypt";
import { encryptText } from "../src/crypto/encrypt";
import type {
  Dataset,
  DatasetExercise,
  DatasetSet,
  DatasetWorkout,
  SourceStatus,
} from "../src/data/types";

const set = (
  index: number,
  weightKg: number | null,
  reps: number | null,
  overrides: Partial<DatasetSet> = {},
): DatasetSet => ({
  index,
  weightKg,
  reps,
  type: "normal",
  distanceMeters: null,
  durationSeconds: null,
  rpe: null,
  ...overrides,
});
const exercise = (
  index: number,
  templateId: string,
  sets: DatasetSet[],
): DatasetExercise => ({
  index,
  templateId,
  title: templateId,
  supersetId: null,
  sets,
});
const workout = (
  id: string,
  day: string,
  exercises: DatasetExercise[],
): DatasetWorkout => ({
  id,
  title: `Session ${id}`,
  routineId: "upper",
  description: "",
  startTime: `${day}T12:00:00Z`,
  endTime: `${day}T13:00:00Z`,
  durationSeconds: 3600,
  exercises,
});
const dataset = (workouts: DatasetWorkout[] = []): Dataset => ({
  generatedAt: "2026-09-05T12:00:00Z",
  user: null,
  workoutCount: workouts.length,
  workouts,
  templates: {
    bench: {
      id: "bench",
      title: "Bench",
      type: "weight_reps",
      primaryMuscleGroup: "chest",
      secondaryMuscleGroups: ["triceps", "triceps", "chest"],
      equipment: "barbell",
    },
    row: {
      id: "row",
      title: "Row",
      type: "weight_reps",
      primaryMuscleGroup: "upper_back",
      secondaryMuscleGroups: ["biceps"],
      equipment: "cable",
    },
    assisted: {
      id: "assisted",
      title: "Assisted",
      type: "reps_weighted_assistance",
      primaryMuscleGroup: "lats",
      secondaryMuscleGroups: [],
      equipment: "machine",
    },
  },
  bodyMeasurements: [],
});
const context = (
  overrides: Partial<AnalysisContext> = {},
): AnalysisContext => ({
  range: { start: "2026-08-01", end: "2026-08-31" },
  comparison: null,
  timezone: "UTC",
  now: "2026-09-05T12:00:00Z",
  includeWarmups: false,
  ...overrides,
});

test("estimated strength eligibility excludes warmups, high reps and non-resistance templates", () => {
  const template = dataset().templates.bench;
  assert.equal(eligibleE1RM(set(0, 60, 1), template), 60);
  assert.equal(eligibleE1RM(set(0, 60, 10), template), 80);
  for (const candidate of [
    set(0, 60, 11),
    set(0, 60, 0),
    set(0, 60, 2.5),
    set(0, 0, 5),
    set(0, null, 5),
    set(0, -10, 5),
    set(0, 100, 5, { type: "warmup" }),
  ])
    assert.equal(eligibleE1RM(candidate, template), null);
  assert.equal(eligibleE1RM(set(0, 60, 5), dataset().templates.assisted), null);
  assert.equal(eligibleE1RM(set(0, 60, 5)), null);
});

test("the baseline and tied sessions never become improvements across records, progress and Journey", () => {
  const data = dataset([
    workout("baseline", "2026-08-01", [
      exercise(0, "bench", [
        set(0, 300, 5, { type: "warmup" }),
        set(1, 60, 5),
        set(2, 100, 11),
      ]),
    ]),
    workout("improved", "2026-08-08", [
      exercise(0, "bench", [set(0, 65, 5)]),
      exercise(1, "bench", [set(0, 70, 5)]),
    ]),
    workout("tie", "2026-08-15", [exercise(0, "bench", [set(0, 70, 5)])]),
    workout("improved-again", "2026-08-22", [
      exercise(0, "bench", [set(0, 80, 5)]),
      exercise(1, "row", [set(0, 40, 5)]),
    ]),
  ]);
  const events = recordEvents(data),
    improvements = events.filter((event) => event.previous !== null);
  assert.deepEqual(
    improvements.map((event) => event.workoutId),
    ["improved", "improved-again"],
  );
  assert.equal(events.filter((event) => event.previous === null).length, 2);
  assert.equal(improvements[0].exerciseIndex, 1);
  assert.equal(countPrImprovements(data), 2);
  assert.equal(
    prWall(data).find((row) => row.templateId === "bench")?.timesImproved,
    2,
  );
  assert.equal(
    personalRecords(data).find((row) => row.templateId === "bench")?.best1RMKg,
    80 * (1 + 5 / 30),
  );
  assert.deepEqual(
    exerciseProgress(data, "bench").map((point) => point.isPR),
    [false, true, false, true],
  );
  assert.deepEqual(
    exerciseSeries(data, context())
      .find((series) => series.id === "bench")
      ?.points.map((point) => point.isRecord),
    [false, true, false, true],
  );
  assert.equal(
    journeyEvents(data, 3).filter((event) => event.kind === "pr").length,
    2,
  );
  assert.equal(
    trophySummary(data, overview(data), consistency(data, 3)).prImprovements,
    2,
  );
});

test("a later record outside the visible date range does not rewrite the earlier chart", () => {
  const data = dataset([
    workout("first", "2026-07-01", [exercise(0, "bench", [set(0, 50, 5)])]),
    workout("visible", "2026-08-01", [exercise(0, "bench", [set(0, 60, 5)])]),
    workout("later", "2026-09-01", [exercise(0, "bench", [set(0, 80, 5)])]),
  ]);
  const points = exerciseSeries(data, context()).find(
    (series) => series.id === "bench",
  )!.points;
  assert.equal(points.length, 1);
  assert.equal(points[0].workoutId, "visible");
  assert.equal(points[0].isRecord, true);
  assert.equal(points[0].value, 60 * (1 + 5 / 30));
});

test("primary muscle sets are counted once and repeated secondary tags do not inflate coverage", () => {
  const data = dataset([
    workout("one", "2026-08-03", [
      exercise(0, "bench", [set(0, 20, 8, { type: "warmup" }), set(1, 60, 8)]),
      exercise(1, "bench", [set(0, 60, 8)]),
      exercise(2, "unknown", [set(0, null, null, { durationSeconds: 45 })]),
    ]),
  ]);
  const distribution = muscleDistribution(data, context());
  assert.equal(distribution.total, 3);
  assert.equal(distribution.classified, 2);
  assert.equal(
    distribution.rows.find((row) => row.muscle === "chest")?.primary,
    2,
  );
  assert.equal(
    distribution.rows.find((row) => row.muscle === "chest")?.secondary,
    0,
  );
  assert.equal(
    distribution.rows.find((row) => row.muscle === "triceps")?.secondary,
    2,
  );
  assert.deepEqual(
    distribution.rows.find((row) => row.muscle === "chest")?.workoutIds,
    ["one"],
  );
});

test("leap-day and year boundaries retain equal, adjacent calendar comparison lengths", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  const range = { start: "2024-03-01", end: "2024-03-28" };
  const previous = precedingRange(range);
  assert.deepEqual(previous, { start: "2024-02-02", end: "2024-02-29" });
  assert.equal(daysBetween(range).length, daysBetween(previous).length);
  assert.equal(addDays(previous.end, 1), range.start);
  assert.equal(weekStart("2026-01-01"), "2025-12-29");
  assert.deepEqual(daysBetween({ start: "2024-02-28", end: "2024-03-01" }), [
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
  ]);
});

test("spring DST ranges use local inclusive dates instead of fixed 24-hour durations", () => {
  const range = { start: "2026-03-29", end: "2026-03-29" };
  assert.equal(inRange("2026-03-28T23:00:00Z", range, "Europe/Oslo"), true);
  assert.equal(inRange("2026-03-29T21:59:59Z", range, "Europe/Oslo"), true);
  assert.equal(inRange("2026-03-29T22:00:00Z", range, "Europe/Oslo"), false);
  assert.equal(localDay("2026-03-28T23:30:00Z", "Europe/Oslo"), "2026-03-29");
  assert.equal(localDay("2026-03-28T23:30:00Z", "UTC"), "2026-03-28");
  assert.equal(dayDistance("2026-03-28", "2026-03-30"), 2);
  assert.equal(
    daysBetween({ start: "2026-03-28", end: "2026-03-30" }).length,
    3,
  );
});

test("the repeated autumn hour counts two distinct workouts on one local calendar day", () => {
  const first = workout("first", "2026-10-25", []),
    second = workout("second", "2026-10-25", []);
  first.startTime = "2026-10-25T00:30:00Z";
  second.startTime = "2026-10-25T01:30:00Z";
  assert.equal(localDay(first.startTime, "Europe/Oslo"), "2026-10-25");
  assert.equal(localDay(second.startTime, "Europe/Oslo"), "2026-10-25");
  const rows = weeklyBuckets(
    dataset([first, second]),
    context({
      range: { start: "2026-10-19", end: "2026-10-25" },
      timezone: "Europe/Oslo",
    }),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessions, 2);
  assert.equal(rows[0].partial, false);
});

test("weekly charts preserve missing weeks and identify clipped range endpoints", () => {
  const data = dataset([
    workout("one", "2026-08-05", []),
    workout("outside", "2026-08-25", []),
  ]);
  const rows = weeklyBuckets(
    data,
    context({ range: { start: "2026-08-05", end: "2026-08-18" } }),
  );
  assert.deepEqual(
    rows.map((row) => [row.start, row.sessions, row.partial]),
    [
      ["2026-08-03", 1, true],
      ["2026-08-10", 0, false],
      ["2026-08-17", 0, true],
    ],
  );
});

test("source status distinguishes missing, unavailable, empty and partial optional data", () => {
  const raw = dataset();
  const legacy = validateDataset(raw);
  assert.equal(legacy.sources?.bodyMeasurements.status, "unknown");
  const source = (
    status: SourceStatus["status"],
    received: number,
  ): SourceStatus => ({ status, received });
  const current = validateDataset({
    ...raw,
    sources: {
      workouts: source("empty", 0),
      templates: source("available", 3),
      user: source("unavailable", 0),
      bodyMeasurements: source("partial", 1),
    },
    bodyMeasurements: [{ date: "2026-08-01", weightKg: 80, fatPercent: null }],
  });
  assert.equal(current.sources?.workouts.status, "empty");
  assert.equal(current.sources?.user.status, "unavailable");
  assert.equal(current.sources?.bodyMeasurements.status, "partial");
  assert.equal(current.sources?.bodyMeasurements.received, 1);
  assert.equal(current.bodyMeasurements[0].fatPercent, null);
  assert.throws(
    () =>
      validateDataset({
        ...current,
        sources: {
          ...current.sources,
          user: { status: "invented", received: 0 },
        },
      }),
    /source status/,
  );
  assert.throws(
    () =>
      validateDataset({
        ...current,
        sources: {
          ...current.sources,
          user: { status: "unavailable", received: -1 },
        },
      }),
    /received count/,
  );
});

test("malformed nested data is rejected before it can become analytical zeros or duplicate evidence", () => {
  const data = dataset([
    workout("one", "2026-08-01", [exercise(0, "bench", [set(0, 60, 8)])]),
  ]);
  const corrupt = (edit: (copy: Dataset) => void) => {
    const copy = structuredClone(data);
    edit(copy);
    return copy;
  };
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workoutCount = 2;
        }),
      ),
    /count/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workouts[0].exercises[0].sets[0].reps = 1.5;
        }),
      ),
    /reps/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workouts[0].exercises[0].sets[0].rpe = 11;
        }),
      ),
    /RPE/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workouts[0].exercises[0].sets.push(set(0, 70, 5));
        }),
      ),
    /Duplicate set/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workouts[0].exercises.push(exercise(0, "row", []));
        }),
      ),
    /Duplicate exercise/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.workouts[0].endTime = "2026-07-31T00:00:00Z";
        }),
      ),
    /ends before/,
  );
  assert.throws(
    () =>
      validateDataset(
        corrupt((copy) => {
          copy.bodyMeasurements.push({
            date: "2026-08-01",
            weightKg: 80,
            fatPercent: 101,
          });
        }),
      ),
    /body fat/,
  );
});

test("validated v2 ciphertext roundtrips with optional coverage and authenticated malformed data is distinct", async () => {
  const source = validateDataset(
    dataset([
      workout("one", "2026-08-01", [exercise(0, "bench", [set(0, 60, 8)])]),
    ]),
  );
  source.schemaVersion = 2;
  source.contentFingerprint = await contentHash(source);
  const payload = await encryptText(
    JSON.stringify(source),
    "verification-fixture-password",
  );
  const restored = await decryptDataset(
    payload,
    "verification-fixture-password",
  );
  assert.deepEqual(restored, source);
  assert.equal(restored.sources?.bodyMeasurements.status, "unknown");
  const invalid = await encryptText(
    JSON.stringify({ ...source, workoutCount: 99 }),
    "verification-fixture-password",
  );
  await assert.rejects(
    decryptDataset(invalid, "verification-fixture-password"),
    (error) =>
      error instanceof Error &&
      !(error instanceof WrongPasswordError) &&
      /count/.test(error.message),
  );
  for (const malformed of [
    { ...payload, iterations: 1 },
    { ...payload, iterations: 2_000_001 },
    { ...payload, iv: payload.salt },
    { ...payload, salt: "%%%" },
    { ...payload, ciphertext: "YQ==" },
    { ...payload, v: 2 },
  ]) {
    assert.throws(() => validateEnvelope(malformed));
  }
});
