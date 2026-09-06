// Read-only Hevy API client. Fail closed for core data and report optional-source coverage.
import type { SourceStatus } from "../src/data/types.ts";

const BASE = "https://api.hevyapp.com/v1";

export interface RawSet {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  custom_metric: number | null;
}
export interface RawExercise {
  index: number;
  title: string;
  notes: string;
  exercise_template_id: string;
  superset_id: number | null;
  sets: RawSet[];
}
export interface RawWorkout {
  id: string;
  title: string;
  routine_id: string | null;
  description: string;
  start_time: string;
  end_time: string;
  updated_at?: string;
  created_at?: string;
  exercises: RawExercise[];
}
export interface RawTemplate {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string | null;
  secondary_muscle_groups: string[];
  equipment: string | null;
  is_custom: boolean;
}
export interface RawUserInfo {
  data: { id: string; name: string; url: string };
}
export interface RawBodyMeasurement {
  date: string;
  weight_kg: number | null;
  fat_percent: number | null;
}
export interface SourceResult<T> {
  data: T;
  source: SourceStatus;
}
export interface HevyOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  timeoutMs?: number;
}
export class SnapshotConsistencyError extends Error {}
export class HevyDataError extends Error {}
export class HevyHttpError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`Hevy HTTP ${status} for ${path}.`);
  }
}

type Obj = Record<string, unknown>;
function record(value: unknown, label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HevyDataError(`Invalid Hevy ${label}.`);
  return value as Obj;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new HevyDataError(`Invalid Hevy ${label}.`);
  return value;
}
function text(value: unknown, label: string, nonempty = false): string {
  if (typeof value !== "string" || (nonempty && !value.trim()))
    throw new HevyDataError(`Invalid Hevy ${label}.`);
  return value;
}
function nullableText(value: unknown, label: string): string | null {
  return value == null ? null : text(value, label);
}
function number(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    throw new HevyDataError(`Invalid Hevy ${label}.`);
  return value;
}
function integer(value: unknown, label: string): number {
  const n = number(value, label);
  if (!Number.isSafeInteger(n))
    throw new HevyDataError(`Invalid Hevy ${label}.`);
  return n;
}
function nullableNumber(
  value: unknown,
  label: string,
  minimum = 0,
): number | null {
  return value == null ? null : number(value, label, minimum);
}
function timestamp(value: unknown, label: string): string {
  const s = text(value, label);
  if (!Number.isFinite(Date.parse(s)))
    throw new HevyDataError(`Invalid Hevy ${label}.`);
  return s;
}
function unique(values: (string | number)[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new HevyDataError(`Duplicate Hevy ${label}.`);
}
function parseWorkout(value: unknown): RawWorkout {
  const w = record(value, "workout");
  const exercises = array(w.exercises, "exercises").map((value) => {
    const e = record(value, "exercise");
    const sets = array(e.sets, "sets").map((value) => {
      const s = record(value, "set");
      const reps = s.reps == null ? null : integer(s.reps, "reps");
      const rpe = nullableNumber(s.rpe, "RPE");
      if (rpe != null && rpe > 10) throw new HevyDataError("Invalid Hevy RPE.");
      return {
        index: integer(s.index, "set index"),
        type: text(s.type, "set type", true),
        weight_kg: nullableNumber(s.weight_kg, "weight", -Infinity),
        reps,
        distance_meters: nullableNumber(s.distance_meters, "distance"),
        duration_seconds: nullableNumber(s.duration_seconds, "duration"),
        rpe,
        custom_metric: nullableNumber(
          s.custom_metric,
          "custom metric",
          -Infinity,
        ),
      };
    });
    unique(
      sets.map((s) => s.index),
      "set indices",
    );
    return {
      index: integer(e.index, "exercise index"),
      title: text(e.title, "exercise title"),
      notes: e.notes == null ? "" : text(e.notes, "exercise notes"),
      exercise_template_id: text(e.exercise_template_id, "template ID", true),
      superset_id:
        e.superset_id == null ? null : integer(e.superset_id, "superset ID"),
      sets,
    };
  });
  unique(
    exercises.map((e) => e.index),
    "exercise indices",
  );
  const start = timestamp(w.start_time, "start time"),
    end = timestamp(w.end_time, "end time");
  if (Date.parse(end) < Date.parse(start))
    throw new HevyDataError("Hevy workout ends before it starts.");
  return {
    id: text(w.id, "workout ID", true),
    title: text(w.title, "workout title"),
    routine_id: nullableText(w.routine_id, "routine ID"),
    description:
      w.description == null ? "" : text(w.description, "description"),
    start_time: start,
    end_time: end,
    exercises,
    ...(w.created_at == null
      ? {}
      : { created_at: timestamp(w.created_at, "created time") }),
    ...(w.updated_at == null
      ? {}
      : { updated_at: timestamp(w.updated_at, "updated time") }),
  };
}
function parseTemplate(value: unknown, expectedId: string): RawTemplate {
  const t = record(value, "template"),
    id = text(t.id, "template ID", true);
  if (id !== expectedId) throw new HevyDataError("Hevy template ID mismatch.");
  return {
    id,
    title: text(t.title, "template title"),
    type: text(t.type, "template type", true),
    primary_muscle_group: nullableText(
      t.primary_muscle_group,
      "primary muscle",
    ),
    secondary_muscle_groups:
      t.secondary_muscle_groups == null
        ? []
        : array(t.secondary_muscle_groups, "secondary muscles").map((m) =>
            text(m, "muscle"),
          ),
    equipment: nullableText(t.equipment, "equipment"),
    is_custom: t.is_custom === true,
  };
}
function parseMeasurement(value: unknown): RawBodyMeasurement {
  const m = record(value, "body measurement"),
    fat = nullableNumber(m.fat_percent, "body fat");
  if (fat != null && fat > 100)
    throw new HevyDataError("Invalid Hevy body fat.");
  return {
    date: timestamp(m.date, "measurement date"),
    weight_kg: nullableNumber(m.weight_kg, "body weight"),
    fat_percent: fat,
  };
}
function pageData(
  value: unknown,
  requested: number,
  key: string,
  expectedPages?: number,
) {
  const p = record(value, "page");
  const page = integer(p.page, "page number"),
    pages = integer(p.page_count, "page count");
  const items = array(p[key], key);
  if (
    page !== requested ||
    pages > 100_000 ||
    (expectedPages !== undefined && pages !== expectedPages) ||
    (pages === 0 ? requested !== 1 || items.length !== 0 : pages < requested) ||
    (requested < pages && items.length === 0)
  ) {
    throw new SnapshotConsistencyError(
      "Hevy pagination changed or was incomplete.",
    );
  }
  return { pages, items };
}

export class HevyClient {
  private readonly fetcher: typeof fetch;
  private readonly pause: (ms: number) => Promise<void>;
  private readonly attempts: number;
  private readonly timeoutMs: number;
  constructor(
    private readonly apiKey: string,
    options: HevyOptions = {},
  ) {
    if (!apiKey.trim()) throw new Error("HEVY_API_KEY is required.");
    this.fetcher = options.fetch ?? fetch;
    this.pause =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.attempts = options.attempts ?? 6;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }
  private async get(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<unknown> {
    const url = new URL(BASE + path);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, String(value));
    let lastError: Error = new Error(`Hevy request failed for ${path}.`);
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      try {
        const response = await this.fetcher(url, {
          headers: { "api-key": this.apiKey, accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) throw new HevyHttpError(response.status, path);
        try {
          return await response.json();
        } catch {
          throw new HevyDataError(`Invalid Hevy JSON for ${path}.`);
        }
      } catch (error) {
        if (
          error instanceof HevyDataError ||
          (error instanceof HevyHttpError &&
            error.status !== 429 &&
            error.status < 500)
        )
          throw error;
        lastError =
          error instanceof HevyHttpError
            ? error
            : new Error(`Hevy request failed for ${path}.`);
        if (attempt + 1 < this.attempts) await this.pause(2_000 * 2 ** attempt);
      }
    }
    throw lastError;
  }
  async workoutCount(): Promise<number> {
    return integer(
      record(await this.get("/workouts/count"), "workout count").workout_count,
      "workout count",
    );
  }
  async allWorkouts(pageSize = 10): Promise<RawWorkout[]> {
    const out: RawWorkout[] = [];
    let pages: number | undefined;
    for (let page = 1; pages === undefined || page <= pages; page++) {
      const result = pageData(
        await this.get("/workouts", { page, pageSize }),
        page,
        "workouts",
        pages,
      );
      pages = result.pages;
      out.push(...result.items.map(parseWorkout));
    }
    return out;
  }
  async exerciseTemplate(
    id: string,
  ): Promise<SourceResult<RawTemplate | null>> {
    try {
      return {
        data: parseTemplate(
          await this.get(`/exercise_templates/${encodeURIComponent(id)}`),
          id,
        ),
        source: { status: "available", received: 1, expected: 1 },
      };
    } catch {
      return {
        data: null,
        source: { status: "unavailable", received: 0, expected: 1 },
      };
    }
  }
  async userInfo(): Promise<SourceResult<RawUserInfo["data"] | null>> {
    try {
      const response = record(await this.get("/user/info"), "user response");
      if (response.data === null)
        return { data: null, source: { status: "empty", received: 0 } };
      const u = record(response.data, "user");
      return {
        data: {
          id: text(u.id, "user ID", true),
          name: text(u.name, "user name"),
          url: text(u.url, "user URL"),
        },
        source: { status: "available", received: 1 },
      };
    } catch {
      return { data: null, source: { status: "unavailable", received: 0 } };
    }
  }
  async allBodyMeasurements(
    pageSize = 50,
  ): Promise<SourceResult<RawBodyMeasurement[]>> {
    const out: RawBodyMeasurement[] = [];
    let pages: number | undefined;
    try {
      for (let page = 1; pages === undefined || page <= pages; page++) {
        const result = pageData(
          await this.get("/body_measurements", { page, pageSize }),
          page,
          "body_measurements",
          pages,
        );
        pages = result.pages;
        // Parse the complete page before adding it; malformed pages never partly enter the series.
        out.push(...result.items.map(parseMeasurement));
      }
      return {
        data: out,
        source: {
          status: out.length ? "available" : "empty",
          received: out.length,
        },
      };
    } catch {
      return {
        data: out,
        source: {
          status: out.length ? "partial" : "unavailable",
          received: out.length,
        },
      };
    }
  }
}
