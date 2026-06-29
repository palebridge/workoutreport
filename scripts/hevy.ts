// Minimal typed client for the Hevy public API (https://api.hevyapp.com/docs/).
// Read-only: paginates workouts, resolves referenced exercise templates, and
// pulls user info + body measurements. Auth is the `api-key` header.

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
  updated_at: string;
  created_at: string;
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
  weight_kg?: number | null;
  fat_percent?: number | null;
  [k: string]: unknown;
}

export class HevyClient {
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("HEVY_API_KEY is required");
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    // Retry transient failures with a short exponential backoff.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { "api-key": this.apiKey, accept: "application/json" } });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status} for ${path}`);
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} for ${path}: ${body.slice(0, 200)}`);
        }
        return (await res.json()) as T;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) await sleep(500 * 2 ** attempt);
      }
    }
    throw lastErr;
  }

  async workoutCount(): Promise<number> {
    const r = await this.get<{ workout_count: number }>("/workouts/count");
    return r.workout_count;
  }

  /** Pull every workout, paging through the full history. */
  async allWorkouts(pageSize = 10): Promise<RawWorkout[]> {
    const out: RawWorkout[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const r = await this.get<{ page: number; page_count: number; workouts: RawWorkout[] }>(
        "/workouts",
        { page, pageSize },
      );
      out.push(...r.workouts);
      pageCount = r.page_count;
      page += 1;
    } while (page <= pageCount);
    return out;
  }

  async exerciseTemplate(id: string): Promise<RawTemplate | null> {
    try {
      return await this.get<RawTemplate>(`/exercise_templates/${encodeURIComponent(id)}`);
    } catch {
      // A template may be unavailable (deleted custom exercise); skip gracefully.
      return null;
    }
  }

  async userInfo(): Promise<RawUserInfo["data"] | null> {
    try {
      const r = await this.get<RawUserInfo>("/user/info");
      return r.data;
    } catch {
      return null;
    }
  }

  async allBodyMeasurements(pageSize = 50): Promise<RawBodyMeasurement[]> {
    const out: RawBodyMeasurement[] = [];
    let page = 1;
    let pageCount = 1;
    try {
      do {
        const r = await this.get<{ page: number; page_count: number; body_measurements: RawBodyMeasurement[] }>(
          "/body_measurements",
          { page, pageSize },
        );
        out.push(...(r.body_measurements ?? []));
        pageCount = r.page_count;
        page += 1;
      } while (page <= pageCount);
    } catch {
      // Endpoint may be empty/unavailable; not critical.
    }
    return out;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
