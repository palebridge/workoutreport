// Shared shapes for the normalized dataset produced by scripts/sync.ts and
// consumed by the dashboard. Everything here is plain JSON-serializable.

export interface DatasetSet {
  index: number;
  /** "normal" | "warmup" | "dropset" | "failure" | ... */
  type: string;
  weightKg: number | null;
  reps: number | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

export interface DatasetExercise {
  index: number;
  title: string;
  templateId: string;
  supersetId: number | null;
  sets: DatasetSet[];
}

export interface DatasetWorkout {
  id: string;
  title: string;
  routineId: string | null;
  description: string;
  /** ISO 8601 */
  startTime: string;
  /** ISO 8601 */
  endTime: string;
  /** Convenience: endTime - startTime, in seconds. */
  durationSeconds: number;
  exercises: DatasetExercise[];
}

export interface TemplateMeta {
  id: string;
  title: string;
  /** "weight_reps" | "reps_only" | "duration" | "distance" | ... */
  type: string;
  primaryMuscleGroup: string | null;
  secondaryMuscleGroups: string[];
  equipment: string | null;
}

export interface UserMeta {
  id: string;
  name: string;
  url: string;
}

export interface BodyMeasurement {
  date: string;
  weightKg: number | null;
  fatPercent: number | null;
}

export interface Dataset {
  /** ISO timestamp of when this snapshot was synced. */
  generatedAt: string;
  user: UserMeta | null;
  workoutCount: number;
  workouts: DatasetWorkout[];
  /** templateId -> metadata, only for templates referenced by workouts. */
  templates: Record<string, TemplateMeta>;
  bodyMeasurements: BodyMeasurement[];
}

/** Shape of the encrypted blob shipped to the browser. All fields base64. */
export interface EncryptedPayload {
  v: 1;
  /** PBKDF2 parameters. */
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}
