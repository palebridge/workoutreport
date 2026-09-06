// Sync a complete, validated snapshot; only the separate encrypt step publishes data.
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HevyClient, SnapshotConsistencyError } from "./hevy.ts";
import type { RawWorkout } from "./hevy.ts";
import { contentHash, validateDataset } from "../src/data/validate.ts";
import type {
  Dataset,
  DatasetV2,
  DatasetWorkout,
  TemplateMeta,
} from "../src/data/types.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type WorkoutClient = Pick<HevyClient, "workoutCount" | "allWorkouts">;
type SyncClient = WorkoutClient &
  Pick<HevyClient, "exerciseTemplate" | "userInfo" | "allBodyMeasurements">;

/** Retry one complete snapshot when pagination/counts reveal a concurrent edit. */
export async function fetchConsistentWorkouts(
  client: WorkoutClient,
): Promise<RawWorkout[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const before = await client.workoutCount();
      const workouts = await client.allWorkouts();
      const after = await client.workoutCount();
      if (
        before !== after ||
        workouts.length !== after ||
        new Set(workouts.map((w) => w.id)).size !== workouts.length
      ) {
        throw new SnapshotConsistencyError(
          "Hevy workout counts or IDs changed during synchronization.",
        );
      }
      return workouts;
    } catch (error) {
      if (!(error instanceof SnapshotConsistencyError)) throw error;
      if (attempt === 1)
        throw new SnapshotConsistencyError(
          "Hevy snapshot remained inconsistent after one complete retry. Previous published data is unchanged.",
        );
    }
  }
  throw new SnapshotConsistencyError(
    "Could not obtain a complete Hevy snapshot.",
  );
}

export function normalizeWorkouts(raw: RawWorkout[]): DatasetWorkout[] {
  return raw.map((w) => ({
    id: w.id,
    title: w.title,
    routineId: w.routine_id,
    description: w.description,
    startTime: w.start_time,
    endTime: w.end_time,
    durationSeconds: Math.round(
      (Date.parse(w.end_time) - Date.parse(w.start_time)) / 1000,
    ),
    ...(w.created_at === undefined ? {} : { createdAt: w.created_at }),
    ...(w.updated_at === undefined ? {} : { updatedAt: w.updated_at }),
    exercises: w.exercises.map((e) => ({
      index: e.index,
      title: e.title,
      templateId: e.exercise_template_id,
      supersetId: e.superset_id,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        index: s.index,
        type: s.type,
        weightKg: s.weight_kg,
        reps: s.reps,
        distanceMeters: s.distance_meters,
        durationSeconds: s.duration_seconds,
        rpe: s.rpe,
        customMetric: s.custom_metric,
      })),
    })),
  }));
}

export async function syncDataset(
  client: SyncClient,
  now = new Date(),
): Promise<DatasetV2> {
  const workouts = normalizeWorkouts(await fetchConsistentWorkouts(client));
  // Check core records before spending requests on optional sources.
  const core: Dataset = validateDataset({
    generatedAt: now.toISOString(),
    workouts,
    workoutCount: workouts.length,
    templates: {},
    user: null,
    bodyMeasurements: [],
  });
  const ids = [
    ...new Set(
      core.workouts.flatMap((w) => w.exercises.map((e) => e.templateId)),
    ),
  ].sort();
  const templates: Record<string, TemplateMeta> = {};
  for (const id of ids) {
    const { data: t } = await client.exerciseTemplate(id);
    if (t)
      templates[id] = {
        id: t.id,
        title: t.title,
        type: t.type,
        primaryMuscleGroup: t.primary_muscle_group,
        secondaryMuscleGroups: t.secondary_muscle_groups,
        equipment: t.equipment,
      };
  }
  const [user, measurements] = await Promise.all([
    client.userInfo(),
    client.allBodyMeasurements(),
  ]);
  const resolved = Object.keys(templates).length;
  const normalized = validateDataset({
    ...core,
    user: user.data,
    templates,
    bodyMeasurements: measurements.data.map((m) => ({
      date: m.date,
      weightKg: m.weight_kg,
      fatPercent: m.fat_percent,
    })),
    sources: {
      workouts: {
        status: workouts.length ? "available" : "empty",
        received: workouts.length,
        expected: workouts.length,
      },
      templates: {
        status: !ids.length
          ? "empty"
          : resolved === ids.length
            ? "available"
            : resolved
              ? "partial"
              : "unavailable",
        received: resolved,
        expected: ids.length,
      },
      user: user.source,
      bodyMeasurements: measurements.source,
    },
  });
  return {
    ...normalized,
    schemaVersion: 2,
    contentFingerprint: await contentHash(normalized),
    sources: normalized.sources!,
  };
}

/** Node 22 loads local .env values without overriding existing CI environment values. */
export function loadLocalEnv(path = resolve(ROOT, ".env")): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
}
export async function writeJsonAtomically(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
async function main(): Promise<void> {
  loadLocalEnv();
  const apiKey = process.env.HEVY_API_KEY?.trim();
  if (!apiKey)
    throw new Error("HEVY_API_KEY is not set. Add it to .env or your shell.");
  const dataset = await syncDataset(new HevyClient(apiKey));
  await writeJsonAtomically(resolve(ROOT, "data/dataset.json"), dataset);
  console.log(
    `Synced ${dataset.workoutCount} workouts, ${Object.keys(dataset.templates).length} templates and ${dataset.bodyMeasurements.length} measurements.`,
  );
  for (const [source, coverage] of Object.entries(dataset.sources)) {
    if (coverage.status === "partial" || coverage.status === "unavailable")
      console.warn(`${source}: ${coverage.status}.`);
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Sync failed.");
    process.exitCode = 1;
  });
}
