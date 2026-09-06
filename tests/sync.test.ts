import assert from "node:assert/strict";
import test from "node:test";
import {
  HevyClient,
  HevyDataError,
  HevyHttpError,
  SnapshotConsistencyError,
} from "../scripts/hevy.ts";
import type { RawWorkout } from "../scripts/hevy.ts";
import {
  fetchConsistentWorkouts,
  normalizeWorkouts,
  syncDataset,
} from "../scripts/sync.ts";
import { encryptDataset } from "../scripts/encrypt.ts";
import { decryptDataset } from "../src/crypto/decrypt.ts";
import { contentHash, validateDataset } from "../src/data/validate.ts";

function workout(id = "w1"): RawWorkout {
  return {
    id,
    title: "Private fixture sentinel",
    routine_id: null,
    description: "Fixture description",
    start_time: "2026-08-01T10:00:00Z",
    end_time: "2026-08-01T11:00:00Z",
    created_at: "2026-08-01T11:00:00Z",
    updated_at: "2026-08-02T11:00:00Z",
    exercises: [
      {
        index: 0,
        title: "Assisted exercise",
        notes: "Fixture notes",
        exercise_template_id: "t1",
        superset_id: null,
        sets: [
          {
            index: 0,
            type: "normal",
            weight_kg: -10,
            reps: 8,
            distance_meters: null,
            duration_seconds: null,
            rpe: null,
            custom_metric: 2,
          },
        ],
      },
    ],
  };
}
function page(workouts: unknown[], number = 1, pages = 1) {
  return { page: number, page_count: pages, workouts };
}
function queued(...responses: unknown[]) {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    assert.ok(responses.length, "Unexpected additional API call");
    const response = responses.shift();
    return response instanceof Response
      ? response
      : new Response(JSON.stringify(response), { status: 200 });
  }) as typeof fetch;
  return {
    client: new HevyClient("fixture-key", { fetch: fetcher, attempts: 1 }),
    calls,
  };
}
const count = (workout_count: number) => ({ workout_count });

test("a complete snapshot reconciles counts across all pages", async () => {
  const { client, calls } = queued(
    count(2),
    page([workout()], 1, 2),
    page([workout("w2")], 2, 2),
    count(2),
  );
  assert.equal((await fetchConsistentWorkouts(client)).length, 2);
  assert.equal(calls.length, 4);
});
test("a genuinely empty account is a valid complete snapshot", async () => {
  const { client } = queued(count(0), page([], 1, 0), count(0));
  assert.deepEqual(await fetchConsistentWorkouts(client), []);
});
test("count reconciliation restarts once from page one", async () => {
  const { client, calls } = queued(
    count(2),
    page([workout()]),
    count(2),
    count(1),
    page([workout()]),
    count(1),
  );
  assert.equal((await fetchConsistentWorkouts(client)).length, 1);
  assert.equal(calls.length, 6);
});
test("a count change during pagination triggers a complete retry", async () => {
  const { client } = queued(
    count(1),
    page([workout()]),
    count(2),
    count(2),
    page([workout(), workout("w2")]),
    count(2),
  );
  assert.equal((await fetchConsistentWorkouts(client)).length, 2);
});
test("page metadata changes trigger a complete retry", async () => {
  const { client } = queued(
    count(2),
    page([workout()], 1, 2),
    page([workout("w2")], 2, 3),
    count(2),
    page([workout(), workout("w2")]),
    count(2),
  );
  assert.equal((await fetchConsistentWorkouts(client)).length, 2);
});
test("persistent duplicate IDs fail after exactly one complete retry", async () => {
  const { client, calls } = queued(
    count(2),
    page([workout(), workout()]),
    count(2),
    count(2),
    page([workout(), workout()]),
    count(2),
  );
  await assert.rejects(
    fetchConsistentWorkouts(client),
    SnapshotConsistencyError,
  );
  assert.equal(calls.length, 6);
});
test("persistent missing records fail rather than publishing an incomplete archive", async () => {
  const { client } = queued(
    count(2),
    page([workout()]),
    count(2),
    count(2),
    page([workout()]),
    count(2),
  );
  await assert.rejects(
    fetchConsistentWorkouts(client),
    /after one complete retry/,
  );
});
test("invalid nested data fails without being normalized to zero", async () => {
  const invalid = workout();
  invalid.exercises[0].sets[0].reps = 1.5;
  const { client, calls } = queued(count(1), page([invalid]));
  await assert.rejects(fetchConsistentWorkouts(client), HevyDataError);
  assert.equal(calls.length, 2);
});
test("HTTP errors do not include response bodies", async () => {
  const { client } = queued(
    new Response("PRIVATE_RESPONSE_SENTINEL", { status: 401 }),
  );
  await assert.rejects(
    client.workoutCount(),
    (error) =>
      error instanceof HevyHttpError &&
      error.status === 401 &&
      !error.message.includes("PRIVATE_RESPONSE_SENTINEL"),
  );
});
test("transient errors retry and keep request timeouts enabled", async () => {
  let calls = 0,
    pauses = 0;
  const client = new HevyClient("fixture-key", {
    attempts: 2,
    sleep: async () => {
      pauses++;
    },
    fetch: (async (_input, init) => {
      assert.ok(init?.signal);
      calls++;
      return calls === 1
        ? new Response("", { status: 503 })
        : new Response(JSON.stringify(count(0)));
    }) as typeof fetch,
  });
  assert.equal(await client.workoutCount(), 0);
  assert.equal(calls, 2);
  assert.equal(pauses, 1);
});
test("optional measurement failures retain an explicitly partial validated prefix", async () => {
  const { client } = queued(
    {
      page: 1,
      page_count: 2,
      body_measurements: [{ date: "2026-08-01", weight_kg: 80 }],
    },
    new Response("", { status: 503 }),
  );
  const result = await client.allBodyMeasurements();
  assert.deepEqual(result.source, { status: "partial", received: 1 });
  assert.equal(result.data[0].fat_percent, null);
});
test("optional measurement first-page failure is unavailable and a real empty list is empty", async () => {
  const unavailable = queued(new Response("", { status: 404 })).client;
  const empty = queued({
    page: 1,
    page_count: 0,
    body_measurements: [],
  }).client;
  assert.equal(
    (await unavailable.allBodyMeasurements()).source.status,
    "unavailable",
  );
  assert.equal((await empty.allBodyMeasurements()).source.status, "empty");
});
test("malformed measurement pages never partly enter a series", async () => {
  const { client } = queued({
    page: 1,
    page_count: 1,
    body_measurements: [
      { date: "2026-08-01", weight_kg: 80 },
      { date: "invalid", weight_kg: 81 },
    ],
  });
  assert.deepEqual(await client.allBodyMeasurements(), {
    data: [],
    source: { status: "unavailable", received: 0 },
  });
});
test("optional template failure has explicit coverage", async () => {
  const { client } = queued(new Response("", { status: 404 }));
  assert.deepEqual(await client.exerciseTemplate("t1"), {
    data: null,
    source: { status: "unavailable", received: 0, expected: 1 },
  });
});
test("sync preserves source notes and timestamps and emits stable content identity", async () => {
  const client = {
    workoutCount: async () => 1,
    allWorkouts: async () => [workout()],
    exerciseTemplate: async () => ({
      data: null,
      source: { status: "unavailable" as const, received: 0 },
    }),
    userInfo: async () => ({
      data: null,
      source: { status: "unavailable" as const, received: 0 },
    }),
    allBodyMeasurements: async () => ({
      data: [],
      source: { status: "empty" as const, received: 0 },
    }),
  };
  const first = await syncDataset(client, new Date("2026-09-01T10:00:00Z"));
  const next = await syncDataset(client, new Date("2026-09-02T10:00:00Z"));
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.contentFingerprint, next.contentFingerprint);
  assert.deepEqual(first.sources.templates, {
    status: "unavailable",
    received: 0,
    expected: 1,
  });
  assert.equal(first.workouts[0].exercises[0].notes, "Fixture notes");
  assert.equal(first.workouts[0].exercises[0].sets[0].customMetric, 2);
  assert.equal(first.workouts[0].updatedAt, workout().updated_at);
});
test("legacy input upgrades through encrypted roundtrip without readable fixture data", async () => {
  const legacy = validateDataset({
    generatedAt: "2026-09-01T00:00:00Z",
    workouts: normalizeWorkouts([workout()]),
    workoutCount: 1,
    templates: {},
    user: null,
    bodyMeasurements: [],
  });
  const payload = await encryptDataset(legacy, "fixture-password");
  assert.ok(!JSON.stringify(payload).includes("Private fixture sentinel"));
  const decoded = await decryptDataset(payload, "fixture-password");
  assert.equal(decoded.schemaVersion, 2);
  assert.equal(decoded.workouts[0].title, "Private fixture sentinel");
  assert.equal(decoded.sources?.workouts.status, "unknown");
  assert.equal(decoded.contentFingerprint, await contentHash(decoded));
  await assert.rejects(decryptDataset(payload, "incorrect-password"));
});
test("encryption rejects a stale claimed fingerprint", async () => {
  const legacy = validateDataset({
    generatedAt: "2026-09-01T00:00:00Z",
    workouts: [],
    workoutCount: 0,
    templates: {},
    user: null,
    bodyMeasurements: [],
  });
  await assert.rejects(
    encryptDataset(
      { ...legacy, schemaVersion: 2, contentFingerprint: "0".repeat(64) },
      "fixture-password",
    ),
    /fingerprint does not match/,
  );
});
