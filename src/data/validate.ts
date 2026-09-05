import type {
  Dataset,
  DatasetV2,
  EncryptedPayload,
  SourceStatus,
} from "./types";

type Obj = Record<string, unknown>;
function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid ${label}.`);
  return value as Obj;
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}.`);
  return value;
}
function id(value: unknown, label: string): string {
  const text = string(value, label);
  if (!text.trim()) throw new Error(`Invalid ${label}.`);
  return text;
}
function date(value: unknown, label: string): string {
  const text = string(value, label);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`Invalid ${label}.`);
  return text;
}
function number(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    throw new Error(`Invalid ${label}.`);
  return value;
}
function integer(value: unknown, label: string): number {
  const n = number(value, label);
  if (!Number.isInteger(n)) throw new Error(`Invalid ${label}.`);
  return n;
}
function nullable(value: unknown, label: string, minimum = 0): number | null {
  return value == null ? null : number(value, label, minimum);
}
function nullableString(value: unknown, label: string): string | null {
  return value == null ? null : string(value, label);
}
function unique(values: (string | number)[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}.`);
}

/** Normalizes legacy JSON and validates every field used by analytical code. */
export function validateDataset(value: unknown): Dataset {
  const d = object(value, "dataset");
  if (d.schemaVersion !== undefined && d.schemaVersion !== 2)
    throw new Error("This dataset version is not supported. Update the site.");
  const workouts = list(d.workouts, "workouts")
    .map((value) => {
      const w = object(value, "workout");
      const exercises = list(w.exercises, "exercises").map((value) => {
        const e = object(value, "exercise");
        const sets = list(e.sets, "sets").map((value) => {
          const s = object(value, "set");
          const reps = nullable(s.reps, "reps");
          if (reps != null && !Number.isInteger(reps))
            throw new Error("Invalid reps.");
          const rpe = nullable(s.rpe, "RPE");
          if (rpe != null && rpe > 10) throw new Error("Invalid RPE.");
          return {
            index: integer(s.index, "set index"),
            type: id(s.type, "set type"),
            weightKg: nullable(s.weightKg, "weight", -Infinity),
            reps,
            distanceMeters: nullable(s.distanceMeters, "distance"),
            durationSeconds: nullable(s.durationSeconds, "duration"),
            rpe,
            customMetric: nullable(s.customMetric, "custom metric", -Infinity),
          };
        });
        unique(
          sets.map((s) => s.index),
          "set indices",
        );
        return {
          index: integer(e.index, "exercise index"),
          title: string(e.title, "exercise title"),
          templateId: id(e.templateId, "template ID"),
          supersetId:
            e.supersetId == null ? null : integer(e.supersetId, "superset ID"),
          notes: e.notes == null ? "" : string(e.notes, "exercise notes"),
          sets,
        };
      });
      unique(
        exercises.map((e) => e.index),
        "exercise indices",
      );
      const startTime = date(w.startTime, "start time"),
        endTime = date(w.endTime, "end time");
      if (Date.parse(endTime) < Date.parse(startTime))
        throw new Error("Workout ends before it starts.");
      return {
        id: id(w.id, "workout ID"),
        title: string(w.title, "workout title"),
        routineId: nullableString(w.routineId, "routine ID"),
        description:
          w.description == null ? "" : string(w.description, "description"),
        startTime,
        endTime,
        durationSeconds: Math.round(
          (Date.parse(endTime) - Date.parse(startTime)) / 1000,
        ),
        exercises,
        ...(w.createdAt == null
          ? {}
          : { createdAt: date(w.createdAt, "created time") }),
        ...(w.updatedAt == null
          ? {}
          : { updatedAt: date(w.updatedAt, "updated time") }),
      };
    })
    .sort(
      (a, b) =>
        Date.parse(a.startTime) - Date.parse(b.startTime) ||
        a.id.localeCompare(b.id),
    );
  unique(
    workouts.map((w) => w.id),
    "workout IDs",
  );
  if (integer(d.workoutCount, "workout count") !== workouts.length)
    throw new Error("Workout count does not match the snapshot.");
  const templates = Object.fromEntries(
    Object.entries(object(d.templates, "templates")).map(([key, value]) => {
      const t = object(value, "template");
      if (id(t.id, "template ID") !== key)
        throw new Error("Template ID mismatch.");
      return [
        key,
        {
          id: key,
          title: string(t.title, "template title"),
          type: id(t.type, "template type"),
          primaryMuscleGroup: nullableString(
            t.primaryMuscleGroup,
            "primary muscle",
          ),
          secondaryMuscleGroups: list(
            t.secondaryMuscleGroups,
            "secondary muscles",
          ).map((m) => string(m, "muscle")),
          equipment: nullableString(t.equipment, "equipment"),
        },
      ];
    }),
  );
  const measurements = list(d.bodyMeasurements, "body measurements")
    .map((value) => {
      const m = object(value, "measurement"),
        fat = nullable(m.fatPercent, "body fat");
      if (fat != null && fat > 100)
        throw new Error("Invalid body fat percentage.");
      return {
        date: date(m.date, "measurement date"),
        weightKg: nullable(m.weightKg, "body weight"),
        fatPercent: fat,
      };
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const u = d.user == null ? null : object(d.user, "user");
  const unknown = (received: number): SourceStatus => ({
    status: "unknown",
    received,
  });
  let sources: DatasetV2["sources"] = {
    workouts: unknown(workouts.length),
    templates: unknown(Object.keys(templates).length),
    user: unknown(u ? 1 : 0),
    bodyMeasurements: unknown(measurements.length),
  };
  if (d.sources !== undefined) {
    const sourceObject = object(d.sources, "sources");
    sources = Object.fromEntries(
      Object.keys(sources).map((key) => {
        const s = object(sourceObject[key], "source status");
        if (
          !["available", "empty", "partial", "unavailable", "unknown"].includes(
            String(s.status),
          )
        )
          throw new Error("Invalid source status.");
        return [
          key,
          {
            status: s.status,
            received: integer(s.received, "received count"),
            ...(s.expected == null
              ? {}
              : { expected: integer(s.expected, "expected count") }),
          },
        ];
      }),
    ) as DatasetV2["sources"];
  }
  if (
    d.schemaVersion === 2 &&
    (typeof d.contentFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(d.contentFingerprint))
  )
    throw new Error("Invalid content fingerprint.");
  return {
    generatedAt: date(d.generatedAt, "sync time"),
    workouts,
    workoutCount: workouts.length,
    templates,
    bodyMeasurements: measurements,
    user: u
      ? {
          id: id(u.id, "user ID"),
          name: string(u.name, "user name"),
          url: string(u.url, "user URL"),
        }
      : null,
    sources,
    ...(d.schemaVersion === 2
      ? {
          schemaVersion: 2 as const,
          contentFingerprint: d.contentFingerprint as string,
        }
      : {}),
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export async function contentHash(dataset: Dataset): Promise<string> {
  const {
    generatedAt: _time,
    contentFingerprint: _fingerprint,
    schemaVersion: _version,
    ...content
  } = dataset;
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(content)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function validateEnvelope(value: unknown): EncryptedPayload {
  const p = object(value, "encrypted payload");
  if (p.v !== 1 || p.kdf !== "PBKDF2-SHA256")
    throw new Error("Unsupported encrypted payload format.");
  const iterations = integer(p.iterations, "KDF iterations");
  if (iterations < 100_000 || iterations > 2_000_000)
    throw new Error("Unsupported KDF parameters.");
  const base64 = (value: unknown, size?: number) => {
    const text = string(value, "base64");
    if (
      !text.length ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        text,
      )
    )
      throw new Error("Malformed encrypted payload.");
    const length = atob(text).length;
    if (
      (size !== undefined && length !== size) ||
      (size === undefined && length < 16)
    )
      throw new Error("Malformed encrypted payload.");
    return text;
  };
  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: base64(p.salt, 16),
    iv: base64(p.iv, 12),
    ciphertext: base64(p.ciphertext),
  };
}
