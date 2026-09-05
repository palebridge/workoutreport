import assert from "node:assert/strict";
import test from "node:test";
import {
  availableScenarioWeeks,
  duplicateScenarioSession,
  duplicateScenarioSet,
  editScenarioSet,
  isEditableScenarioSet,
  removeScenarioSession,
  removeScenarioSet,
  scenarioResult,
  seedScenario,
} from "../src/data/scenario";
import type {
  Dataset,
  DatasetExercise,
  DatasetSet,
  DatasetWorkout,
} from "../src/data/types";

const NOW = "2026-09-05T12:00:00Z";
const WEEK = "2026-08-24";
const set = (index = 0, overrides: Partial<DatasetSet> = {}): DatasetSet => ({
  index,
  type: "normal",
  weightKg: 50,
  reps: 8,
  distanceMeters: null,
  durationSeconds: null,
  rpe: 8,
  ...overrides,
});
const exercise = (
  index = 0,
  templateId = "bench",
  sets = [set()],
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
  overrides: Partial<DatasetWorkout> = {},
): DatasetWorkout => ({
  id,
  title: "Upper body",
  routineId: "upper",
  description: "",
  startTime: `${day}T12:00:00Z`,
  endTime: `${day}T12:20:00Z`,
  durationSeconds: 1200,
  exercises: [
    exercise(0, "bench", [set(0, { type: "warmup", weightKg: 20 }), set(1)]),
  ],
  ...overrides,
});
const dataset = (workouts = [workout("source", WEEK)]): Dataset => ({
  generatedAt: NOW,
  contentFingerprint: "fixture-v1",
  workoutCount: workouts.length,
  user: null,
  workouts,
  bodyMeasurements: [],
  templates: {
    bench: {
      id: "bench",
      title: "Bench",
      type: "weight_reps",
      primaryMuscleGroup: "chest",
      secondaryMuscleGroups: ["triceps"],
      equipment: "barbell",
    },
    run: {
      id: "run",
      title: "Run",
      type: "distance_duration",
      primaryMuscleGroup: "quadriceps",
      secondaryMuscleGroups: [],
      equipment: "none",
    },
  },
});

test("completed source weeks are unique, latest first, and use local calendar boundaries", () => {
  const data = dataset([
    workout("a", "2026-08-03"),
    workout("b", "2026-08-24"),
    workout("c", "2026-08-28"),
    workout("d", "2026-08-31"),
    workout("future", "2026-09-07"),
  ]);
  assert.deepEqual(availableScenarioWeeks(data, NOW, "UTC"), [
    "2026-08-24",
    "2026-08-03",
  ]);
  const boundary = dataset([
    workout("late", "2026-08-30", { startTime: "2026-08-30T23:30:00Z" }),
  ]);
  assert.deepEqual(availableScenarioWeeks(boundary, NOW, "Europe/Oslo"), []);
  assert.equal(
    seedScenario(boundary, "2026-08-31", "Europe/Oslo").sessions[0].day,
    "2026-08-31",
  );
});

test("a source week resets with exact copied values and no source aliases", () => {
  const data = dataset();
  const original = JSON.stringify(data);
  const draft = seedScenario(data, WEEK, "UTC"),
    session = draft.sessions[0];
  assert.notEqual(session.workout, data.workouts[0]);
  assert.notEqual(
    session.workout.exercises[0].sets[0],
    data.workouts[0].exercises[0].sets[0],
  );
  const edited = editScenarioSet(draft, session.id, 0, 1, {
    weightKg: 60,
    reps: 10,
  });
  assert.equal(edited.sessions[0].workout.exercises[0].sets[1].weightKg, 60);
  assert.equal(draft.sessions[0].workout.exercises[0].sets[1].weightKg, 50);
  assert.equal(JSON.stringify(data), original);
  assert.deepEqual(seedScenario(data, WEEK, "UTC"), draft);
});

test("session and set changes produce exact counts, repetitions, volume and direct muscle maps", () => {
  const data = dataset(),
    draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  const copied = duplicateScenarioSession(draft, id, "copy-1");
  const extra = duplicateScenarioSet(copied, "copy-1", 0, 1);
  const edited = editScenarioSet(extra, "copy-1", 0, 2, {
    weightKg: 60,
    reps: 10,
  });
  const result = scenarioResult(data, edited, "UTC");
  assert.deepEqual(result.baseline, {
    sessions: 1,
    sets: 1,
    reps: 8,
    volume: 400,
  });
  assert.deepEqual(result.scenario, {
    sessions: 2,
    sets: 3,
    reps: 26,
    volume: 1400,
  });
  assert.deepEqual(result.delta, {
    sessions: 1,
    sets: 2,
    reps: 18,
    volume: 1000,
  });
  assert.deepEqual(result.percent, {
    sessions: 100,
    sets: 200,
    reps: 225,
    volume: 250,
  });
  assert.deepEqual(result.baselineMuscles, { chest: 1 });
  assert.deepEqual(result.scenarioMuscles, { chest: 3 });
  assert.equal(edited.sessions[0].workout.exercises[0].sets.length, 2);
  assert.deepEqual(
    edited.sessions[1].workout.exercises[0].sets.map((item) => item.index),
    [0, 1, 2],
  );
  assert.equal(
    scenarioResult(data, removeScenarioSet(edited, "copy-1", 0, 2), "UTC")
      .scenario.volume,
    800,
  );
  assert.equal(
    scenarioResult(data, removeScenarioSession(edited, "copy-1"), "UTC")
      .scenario.volume,
    400,
  );
});

test("warmups and duration/distance entries cannot be edited, duplicated or removed as sets", () => {
  const cardio = set(0, {
    weightKg: null,
    reps: null,
    distanceMeters: 3000,
    durationSeconds: 900,
  });
  const data = dataset([
    workout("source", WEEK, {
      exercises: [
        exercise(0, "bench", [set(0, { type: "warmup" }), set(1)]),
        exercise(1, "run", [cardio]),
      ],
    }),
  ]);
  const draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  assert.equal(isEditableScenarioSet(cardio), false);
  for (const [exerciseIndex, setIndex] of [
    [0, 0],
    [1, 0],
  ]) {
    assert.equal(
      editScenarioSet(draft, id, exerciseIndex, setIndex, { reps: 12 }),
      draft,
    );
    assert.equal(
      duplicateScenarioSet(draft, id, exerciseIndex, setIndex),
      draft,
    );
    assert.equal(removeScenarioSet(draft, id, exerciseIndex, setIndex), draft);
  }
  const changed = duplicateScenarioSet(draft, id, 0, 1);
  assert.deepEqual(
    changed.sessions[0].workout.exercises[0].sets[0],
    draft.sessions[0].workout.exercises[0].sets[0],
  );
  assert.deepEqual(changed.sessions[0].workout.exercises[1].sets[0], cardio);
});

test("zero baselines and empty scenarios never create Infinity or NaN", () => {
  const data = dataset([]),
    draft = seedScenario(data, WEEK, "UTC");
  const result = scenarioResult(data, draft, "UTC");
  assert.deepEqual(result.baseline, {
    sessions: 0,
    sets: 0,
    reps: 0,
    volume: 0,
  });
  assert.deepEqual(result.percent, {
    sessions: null,
    sets: null,
    reps: null,
    volume: null,
  });
  assert.equal(result.timeEstimate.seconds, 0);
  assert.equal(result.timeEstimate.minSeconds, 0);
  assert.equal(result.timeEstimate.maxSeconds, 0);
  assert.deepEqual(availableScenarioWeeks(data, NOW, "UTC"), []);
  const zeroLoadData = dataset([
    workout("zero", WEEK, {
      exercises: [exercise(0, "bench", [set(0, { weightKg: 0 })])],
    }),
  ]);
  const zeroDraft = seedScenario(zeroLoadData, WEEK, "UTC");
  const increased = editScenarioSet(zeroDraft, zeroDraft.sessions[0].id, 0, 0, {
    weightKg: 50,
  });
  assert.equal(
    scenarioResult(zeroLoadData, increased, "UTC").percent.volume,
    null,
  );
  assert.equal(
    scenarioResult(zeroLoadData, increased, "UTC").delta.volume,
    400,
  );
});

test("source fingerprint changes mark drafts stale while an unchanged snapshot stays current", () => {
  const data = dataset(),
    draft = seedScenario(data, WEEK, "UTC");
  assert.equal(
    scenarioResult(
      { ...data, generatedAt: "2026-09-06T00:00:00Z" },
      draft,
      "UTC",
    ).stale,
    false,
  );
  const changed = scenarioResult(
    { ...data, contentFingerprint: "fixture-v2" },
    draft,
    "UTC",
  );
  assert.equal(changed.stale, true);
  assert.equal(changed.timeEstimate.seconds, null);
  assert.equal(changed.timeEstimate.minSeconds, null);
  assert.equal(changed.timeEstimate.maxSeconds, null);
});

test("time requires three distinct sessions matching routine AND ordered exercise signature", () => {
  const source = workout("source", WEEK);
  const first = workout("history-1", "2026-08-10", { durationSeconds: 900 });
  const second = workout("history-2", "2026-08-17", { durationSeconds: 1800 });
  const data = dataset([source, first, second]),
    draft = seedScenario(data, WEEK, "UTC");
  const edited = duplicateScenarioSet(draft, draft.sessions[0].id, 0, 1);
  assert.deepEqual(scenarioResult(data, edited, "UTC").timeEstimate, {
    seconds: 1800,
    minSeconds: 1350,
    maxSeconds: 2700,
    samples: 3,
    coveredSessions: 1,
    totalSessions: 1,
  });
  const repeated = duplicateScenarioSession(
    edited,
    edited.sessions[0].id,
    "another",
  );
  assert.deepEqual(scenarioResult(data, repeated, "UTC").timeEstimate, {
    seconds: 3600,
    minSeconds: 2700,
    maxSeconds: 5400,
    samples: 3,
    coveredSessions: 2,
    totalSessions: 2,
  });
  for (const mismatched of [
    { ...second, routineId: "other" },
    { ...second, exercises: [exercise(0, "row")] },
    { ...second, exercises: [exercise(0, "bench"), exercise(1, "row")] },
    { ...second, id: first.id },
    { ...second, durationSeconds: 0 },
  ])
    assert.equal(
      scenarioResult(dataset([source, first, mismatched]), draft, "UTC")
        .timeEstimate.seconds,
      null,
    );
});

test("time never mixes reordered signatures or presents a partial total for sparse history", () => {
  const ordered = [exercise(0, "bench"), exercise(1, "row")];
  const reordered = [exercise(0, "row"), exercise(1, "bench")];
  const data = dataset([
    workout("source", WEEK, { exercises: ordered }),
    workout("old-1", "2026-08-10", { exercises: ordered }),
    workout("old-2", "2026-08-17", { exercises: reordered }),
  ]);
  const draft = seedScenario(data, WEEK, "UTC");
  assert.equal(scenarioResult(data, draft, "UTC").timeEstimate.seconds, null);
  const eligible = dataset([
    workout("source", WEEK),
    workout("old-1", "2026-08-10"),
    workout("old-2", "2026-08-17"),
    workout("sparse", "2026-08-25", {
      routineId: "lower",
      exercises: [exercise(0, "squat")],
    }),
  ]);
  const result = scenarioResult(
    eligible,
    seedScenario(eligible, WEEK, "UTC"),
    "UTC",
  );
  assert.deepEqual(result.timeEstimate, {
    seconds: null,
    minSeconds: null,
    maxSeconds: null,
    samples: 3,
    coveredSessions: 1,
    totalSessions: 2,
  });
  assert.deepEqual(result.scenarioMuscles, { chest: 1, unclassified: 1 });
});

test("unknown targets and invalid edits leave drafts unchanged; duplicate IDs are rejected", () => {
  const data = dataset(),
    draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  assert.equal(removeScenarioSession(draft, "missing"), draft);
  assert.equal(duplicateScenarioSession(draft, "missing", "new"), draft);
  assert.equal(removeScenarioSet(draft, id, 999, 0), draft);
  assert.equal(removeScenarioSet(draft, id, 0, 999), draft);
  for (const values of [
    { weightKg: -1 },
    { weightKg: Infinity },
    { reps: NaN },
    { reps: 2.5 },
    { reps: 0 },
  ])
    assert.equal(editScenarioSet(draft, id, 0, 1, values), draft);
  assert.throws(() => duplicateScenarioSession(draft, id, id), /unique/);
  assert.throws(() => duplicateScenarioSession(draft, id, " "), /unique/);
});

test("adding one working set adds one share of complete duration while warmups stay fixed", () => {
  const data = dataset([
    workout("source", WEEK),
    workout("old-1", "2026-08-10"),
    workout("old-2", "2026-08-17"),
  ]);
  const draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  const before = scenarioResult(data, draft, "UTC");
  const extra = duplicateScenarioSet(draft, id, 0, 1);
  const after = scenarioResult(data, extra, "UTC");
  assert.equal(before.timeEstimate.seconds, 1200);
  assert.equal(after.timeEstimate.seconds, 1800);
  assert.equal(after.timeEstimate.seconds! - before.timeEstimate.seconds!, 600);
  assert.equal(after.scenario.sets - before.scenario.sets, 1);
  assert.equal(
    extra.sessions[0].workout.exercises[0].sets.filter(
      (item) => item.type === "warmup",
    ).length,
    1,
  );
  const onlyWarmup = removeScenarioSet(draft, id, 0, 1);
  assert.equal(
    scenarioResult(data, onlyWarmup, "UTC").timeEstimate.seconds,
    600,
  );
});

test("time bounds scale historical per-all-set rates, including preserved duration entries", () => {
  const entries = (warmups: number) => [
    exercise(0, "bench", [
      ...Array.from({ length: warmups }, (_, index) =>
        set(index, { type: "warmup" }),
      ),
      set(warmups),
    ]),
    exercise(1, "run", [
      set(0, { weightKg: null, reps: null, durationSeconds: 600 }),
    ]),
  ];
  const data = dataset([
    workout("source", WEEK, { exercises: entries(1), durationSeconds: 1800 }),
    workout("old-1", "2026-08-10", {
      exercises: entries(2),
      durationSeconds: 2000,
    }),
    workout("old-2", "2026-08-17", {
      exercises: entries(3),
      durationSeconds: 4000,
    }),
  ]);
  const draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  const result = scenarioResult(
    data,
    duplicateScenarioSet(draft, id, 0, 1),
    "UTC",
  );
  // Historical rates: 600, 500, 800 seconds per logged set; four proposed sets.
  assert.deepEqual(result.timeEstimate, {
    seconds: 2400,
    minSeconds: 2000,
    maxSeconds: 3200,
    samples: 3,
    coveredSessions: 1,
    totalSessions: 1,
  });
});

test("positive assistance and bodyweight values cannot bypass the seeded template allowlist", () => {
  const data = dataset([
    workout("source", WEEK, {
      exercises: [
        exercise(0, "assisted"),
        exercise(1, "bodyweight"),
        exercise(2, "unknown"),
        exercise(3, "bench"),
      ],
    }),
  ]);
  data.templates.assisted = {
    ...data.templates.bench,
    id: "assisted",
    type: "reps_weighted_assistance",
  };
  data.templates.bodyweight = {
    ...data.templates.bench,
    id: "bodyweight",
    type: "reps_only",
  };
  const draft = seedScenario(data, WEEK, "UTC"),
    id = draft.sessions[0].id;
  assert.deepEqual(draft.editableTemplateIds, ["bench"]);
  assert.equal(isEditableScenarioSet(set(), data.templates.assisted), false);
  assert.equal(isEditableScenarioSet(set(), data.templates.bodyweight), false);
  assert.equal(isEditableScenarioSet(set(), data.templates.bench), true);
  for (const index of [0, 1, 2]) {
    assert.equal(editScenarioSet(draft, id, index, 0, { weightKg: 60 }), draft);
    assert.equal(duplicateScenarioSet(draft, id, index, 0), draft);
    assert.equal(removeScenarioSet(draft, id, index, 0), draft);
  }
  assert.notEqual(editScenarioSet(draft, id, 3, 0, { weightKg: 60 }), draft);
});

test("timezone changes invalidate the original week and suppress every time estimate", () => {
  const data = dataset([
    workout("source", "2026-08-30", { startTime: "2026-08-30T23:30:00Z" }),
    workout("old-1", "2026-08-10"),
    workout("old-2", "2026-08-17"),
  ]);
  const draft = seedScenario(data, WEEK, "UTC");
  assert.equal(draft.timezone, "UTC");
  assert.equal(scenarioResult(data, draft, "UTC").stale, false);
  const changed = scenarioResult(data, draft, "Europe/Oslo");
  assert.equal(changed.stale, true);
  assert.equal(changed.timeEstimate.seconds, null);
  assert.equal(changed.timeEstimate.minSeconds, null);
  assert.equal(changed.timeEstimate.maxSeconds, null);
  const reset = seedScenario(data, WEEK, "Europe/Oslo");
  assert.equal(reset.timezone, "Europe/Oslo");
  assert.equal(reset.sessions.length, 0);
  assert.equal(scenarioResult(data, reset, "Europe/Oslo").stale, false);
});
