import type { Dataset, DatasetWorkout, TemplateMeta } from "../src/data/types";
import { addDays, localDay, weekStart } from "../src/data/calendar";

/** Entirely synthetic training history. Never imported by production code. */
export function fixture(weeks = 18, now = new Date().toISOString()): Dataset {
  const definitions = [
    ["bench", "Bench Press", "chest", "barbell", "weight_reps", "triceps"],
    [
      "row",
      "Seated Cable Row",
      "upper_back",
      "machine",
      "weight_reps",
      "biceps",
    ],
    ["squat", "Back Squat", "quadriceps", "barbell", "weight_reps", "glutes"],
    [
      "rdl",
      "Romanian Deadlift",
      "hamstrings",
      "barbell",
      "weight_reps",
      "glutes",
    ],
    [
      "press",
      "Overhead Press",
      "shoulders",
      "dumbbell",
      "weight_reps",
      "triceps",
    ],
    ["pulldown", "Lat Pulldown", "lats", "machine", "weight_reps", "biceps"],
    [
      "curl",
      "Incline Dumbbell Curl",
      "biceps",
      "dumbbell",
      "weight_reps",
      "forearms",
    ],
    ["plank", "Plank", "abdominals", "none", "duration", ""],
  ];
  const templates: Record<string, TemplateMeta> = Object.fromEntries(
    definitions.map(([id, title, muscle, equipment, type, secondary]) => [
      id,
      {
        id,
        title,
        type,
        primaryMuscleGroup: muscle,
        secondaryMuscleGroups: secondary ? [secondary] : [],
        equipment,
      },
    ]),
  );
  const end = localDay(now, "UTC"),
    start = addDays(weekStart(end), -(weeks - 1) * 7);
  const workouts: DatasetWorkout[] = [];
  for (let week = 0; week < weeks; week++)
    for (let visit = 0; visit < 3; visit++) {
      if (week === 4 || (week === 9 && visit === 1)) continue;
      const day = addDays(start, week * 7 + [0, 2, 4][visit]);
      if (day > end) continue;
      const ids =
        visit === 0
          ? ["bench", "row", "press", "curl"]
          : visit === 1
            ? ["squat", "rdl", "plank"]
            : ["bench", "pulldown", "press", "curl"];
      const startTime = `${day}T16:30:00Z`;
      const duration = (48 + ((week * 7 + visit) % 17)) * 60;
      workouts.push({
        id: `synthetic-${week}-${visit}`,
        title: ["Upper · Push & Pull", "Lower · Strength", "Upper · Volume"][
          visit
        ],
        routineId: `routine-${visit}`,
        startTime,
        endTime: new Date(
          Date.parse(startTime) + duration * 1000,
        ).toISOString(),
        durationSeconds: duration,
        description: "Synthetic development workout.",
        exercises: ids.map((id, index) => {
          const t = templates[id];
          const base =
            (
              {
                bench: 45,
                row: 38,
                squat: 60,
                rdl: 55,
                press: 16,
                pulldown: 40,
                curl: 9,
              } as Record<string, number>
            )[id] ?? 0;
          const load =
            Math.round(
              (base +
                week * (id === "curl" ? 0.3 : id === "press" ? 0.5 : 1.25) +
                (week % 5 === 0 ? -2 : 0)) *
                2,
            ) / 2;
          return {
            index,
            title: t.title,
            templateId: id,
            supersetId: null,
            notes: index === 0 ? "Smooth reps. Controlled lowering." : "",
            sets: Array.from({ length: id === "plank" ? 3 : 4 }, (_, j) => ({
              index: j,
              type: j === 0 && id !== "plank" ? "warmup" : "normal",
              weightKg: id === "plank" ? null : j === 0 ? load * 0.5 : load,
              reps: id === "plank" ? null : j === 0 ? 10 : 8 + ((week + j) % 2),
              durationSeconds: id === "plank" ? 45 + week * 2 : null,
              distanceMeters: null,
              rpe:
                id === "plank" || week < 6 || j === 0
                  ? null
                  : 7 + (j % 3) * 0.5,
            })),
          };
        }),
      });
    }
  return {
    generatedAt: now,
    user: { id: "synthetic-athlete", name: "Alex", url: "" },
    workouts,
    workoutCount: workouts.length,
    templates,
    bodyMeasurements: Array.from({ length: weeks }, (_, i) => ({
      date: `${addDays(start, i * 7)}T08:00:00Z`,
      weightKg: 76 + i * 0.08,
      fatPercent: null,
    })),
    sources: {
      workouts: {
        status: "available",
        received: workouts.length,
        expected: workouts.length,
      },
      templates: {
        status: "available",
        received: definitions.length,
        expected: definitions.length,
      },
      user: { status: "available", received: 1 },
      bodyMeasurements: { status: "available", received: weeks },
    },
  };
}
