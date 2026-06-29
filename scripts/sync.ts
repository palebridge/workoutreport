// Pull the full workout history from Hevy, normalize it, resolve the exercise
// templates actually used (for muscle-group mapping), and write a single
// plaintext snapshot to data/dataset.json. The encrypt step turns that into the
// public, password-protected blob.
//
// Usage: HEVY_API_KEY=... npm run sync

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HevyClient } from "./hevy.ts";
import type {
  BodyMeasurement,
  Dataset,
  DatasetExercise,
  DatasetWorkout,
  TemplateMeta,
} from "../src/data/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../data/dataset.json");

async function main() {
  const apiKey = process.env.HEVY_API_KEY?.trim();
  if (!apiKey) {
    console.error("✗ HEVY_API_KEY is not set. Add it to .env or your shell.");
    process.exit(1);
  }

  const client = new HevyClient(apiKey);

  console.log("→ Fetching workouts…");
  const rawWorkouts = await client.allWorkouts();
  console.log(`  got ${rawWorkouts.length} workout(s)`);

  const workouts: DatasetWorkout[] = rawWorkouts
    .map((w): DatasetWorkout => {
      const exercises: DatasetExercise[] = (w.exercises ?? []).map((e) => ({
        index: e.index,
        title: e.title,
        templateId: e.exercise_template_id,
        supersetId: e.superset_id ?? null,
        sets: (e.sets ?? []).map((s) => ({
          index: s.index,
          type: s.type,
          weightKg: s.weight_kg,
          reps: s.reps,
          distanceMeters: s.distance_meters,
          durationSeconds: s.duration_seconds,
          rpe: s.rpe,
        })),
      }));
      return {
        id: w.id,
        title: w.title,
        routineId: w.routine_id ?? null,
        description: w.description ?? "",
        startTime: w.start_time,
        endTime: w.end_time,
        durationSeconds: Math.max(
          0,
          Math.round((Date.parse(w.end_time) - Date.parse(w.start_time)) / 1000),
        ),
        exercises,
      };
    })
    // Oldest first makes downstream time-series logic simpler.
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  // Resolve only the templates we actually reference.
  const ids = new Set<string>();
  for (const w of workouts) for (const e of w.exercises) ids.add(e.templateId);
  console.log(`→ Resolving ${ids.size} exercise template(s)…`);

  const templates: Record<string, TemplateMeta> = {};
  for (const id of ids) {
    const t = await client.exerciseTemplate(id);
    if (t) {
      templates[id] = {
        id: t.id,
        title: t.title,
        type: t.type,
        primaryMuscleGroup: t.primary_muscle_group ?? null,
        secondaryMuscleGroups: t.secondary_muscle_groups ?? [],
        equipment: t.equipment ?? null,
      };
    }
  }

  console.log("→ Fetching user info & body measurements…");
  const user = await client.userInfo();
  const rawMeasurements = await client.allBodyMeasurements();
  const bodyMeasurements: BodyMeasurement[] = rawMeasurements
    .map((m) => ({
      date: m.date,
      weightKg: (m.weight_kg as number | null) ?? null,
      fatPercent: (m.fat_percent as number | null) ?? null,
    }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    user,
    workoutCount: workouts.length,
    workouts,
    templates,
    bodyMeasurements,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(dataset), "utf8");
  console.log(`✓ Wrote ${OUT}`);
  console.log(
    `  ${workouts.length} workouts · ${Object.keys(templates).length} templates · ${bodyMeasurements.length} measurements`,
  );
}

main().catch((err) => {
  console.error("✗ Sync failed:", err);
  process.exit(1);
});
