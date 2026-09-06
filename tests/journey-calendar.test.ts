import assert from "node:assert/strict";
import test from "node:test";
import { buddy, bossBattle, ironMountain } from "../src/data/game";
import {
  consistency,
  journeyEvents,
  overview,
  trophySummary,
} from "../src/data/metrics";
import type { Dataset, DatasetWorkout } from "../src/data/types";
import { fixture } from "./fixture";

const NOW = "2026-09-05T12:00:00Z";
function dataset(
  entries: { id: string; at: string; volume?: number; warmup?: boolean }[],
): Dataset {
  const source = fixture(1, NOW);
  const workouts: DatasetWorkout[] = entries.map(
    ({ id, at, volume = 400, warmup = false }) => ({
      id,
      title: id,
      routineId: "routine",
      description: "",
      startTime: at,
      endTime: new Date(Date.parse(at) + 60000).toISOString(),
      durationSeconds: 60,
      exercises: [
        {
          index: 0,
          title: "Bench Press",
          templateId: "bench",
          supersetId: null,
          sets: [
            {
              index: 0,
              type: warmup ? "warmup" : "normal",
              weightKg: volume,
              reps: 1,
              durationSeconds: null,
              distanceMeters: null,
              rpe: null,
            },
          ],
        },
      ],
    }),
  );
  return {
    ...source,
    workouts,
    workoutCount: workouts.length,
    bodyMeasurements: [],
  };
}

test("consistency honors the selected Monday boundary and as-of time", () => {
  const d = dataset([
    { id: "boundary", at: "2026-08-30T23:30:00Z" },
    { id: "future", at: "2026-09-07T12:00:00Z" },
  ]);
  const utc = consistency(d, 1, "UTC", NOW);
  const oslo = consistency(d, 1, "Europe/Oslo", NOW);
  assert.equal(utc.byDay["2026-08-30"], 1);
  assert.equal(oslo.byDay["2026-08-31"], 1);
  assert.deepEqual(
    utc.weeks.map((w) => w.count),
    [1, 0],
  );
  assert.deepEqual(
    oslo.weeks.map((w) => w.count),
    [1],
  );
  assert.equal(utc.sessionsThisWeek, 0);
  assert.equal(oslo.sessionsThisWeek, 1);
  assert.equal(utc.activeDays, 1);
  assert.equal(utc.weeksOnTargetStreak, 1); // unfinished current week is allowed
});

test("empty completed weeks break both consistency and Journey streak badges", () => {
  const d = dataset([
    { id: "first", at: "2026-01-05T12:00:00Z" },
    { id: "third", at: "2026-01-19T12:00:00Z" },
  ]);
  const stats = consistency(d, 1, "Europe/Oslo", "2026-01-20T12:00:00Z");
  assert.deepEqual(
    stats.weeks.map((w) => w.count),
    [1, 0, 1],
  );
  assert.equal(stats.longestWeekStreak, 1);
  assert.equal(stats.weeksOnTargetStreak, 1);
  assert.equal(
    journeyEvents(d, 1, "Europe/Oslo").some((e) =>
      e.detail?.includes("weeks in a row"),
    ),
    false,
  );
  const consecutive = dataset([
    { id: "first", at: "2026-01-05T12:00:00Z" },
    { id: "second", at: "2026-01-12T12:00:00Z" },
  ]);
  assert.equal(
    journeyEvents(consecutive, 1, "Europe/Oslo").some((e) =>
      e.detail?.includes("2 weeks in a row"),
    ),
    true,
  );
});

test("Journey calendar grouping and source IDs survive midnight, DST and unsorted history", () => {
  const boundary = dataset([
    { id: "sunday", at: "2026-08-30T23:30:00Z" },
    { id: "monday", at: "2026-08-31T12:00:00Z", volume: 500 },
  ]);
  assert.equal(
    journeyEvents(boundary, 2, "UTC").filter((e) => e.kind === "week").length,
    0,
  );
  const events = journeyEvents(
    { ...boundary, workouts: [...boundary.workouts].reverse() },
    2,
    "Europe/Oslo",
  );
  assert.deepEqual(
    events.filter((e) => e.kind === "week").map((e) => e.workoutId),
    ["monday"],
  );
  assert.deepEqual(
    events.filter((e) => e.kind === "pr").map((e) => e.workoutId),
    ["monday"],
  );
  assert.ok(
    events.every((e) => boundary.workouts.some((w) => w.id === e.workoutId)),
  );
  const dst = dataset([
    { id: "before", at: "2026-03-23T12:00:00Z" },
    { id: "after", at: "2026-03-30T12:00:00Z" },
  ]);
  assert.equal(
    consistency(dst, 1, "Europe/Oslo", "2026-03-31T12:00:00Z")
      .longestWeekStreak,
    2,
  );
  assert.equal(
    journeyEvents(dst, 1, "Europe/Oslo").some((e) =>
      e.detail?.includes("2 weeks in a row"),
    ),
    true,
  );
});

test("boss month membership and logs use the selected timezone", () => {
  const d = dataset([{ id: "boundary", at: "2026-08-31T23:30:00Z" }]);
  const utc = bossBattle(d, "UTC", "2026-09-02T12:00:00Z");
  const oslo = bossBattle(d, "Europe/Oslo", "2026-09-02T12:00:00Z");
  assert.equal(utc.current?.damage, 0);
  assert.equal(utc.shelf.length, 1);
  assert.equal(oslo.current?.damage, 400);
  assert.equal(oslo.shelf.length, 0);
  assert.equal(oslo.current?.log[0].workoutId, "boundary");
  assert.equal(oslo.current?.log[0].label, "1 Sept");
  assert.equal(oslo.current?.daysLeft, 29);
});

test("boss baselines include empty weeks instead of reviving old active weeks", () => {
  const d = dataset([
    { id: "old", at: "2026-01-05T12:00:00Z", volume: 8000 },
    { id: "recent", at: "2026-02-23T12:00:00Z", volume: 4000 },
  ]);
  // The last four fully completed weeks before March have zero logged volume.
  assert.equal(bossBattle(d, "UTC", "2026-03-05T12:00:00Z").current?.hp, 2000);
});

test("boss damage and mountain thresholds retain logged warmups and fractional precision", () => {
  const d = dataset([
    { id: "almost", at: "2026-09-30T12:00:00Z", volume: 1999.6, warmup: true },
  ]);
  const boss = bossBattle(d, "UTC", "2026-09-30T20:00:00Z").current!;
  assert.equal(boss.hp, 2000);
  assert.equal(boss.damage, 1999.6);
  assert.equal(boss.log[0].damage, 1999.6);
  assert.equal(boss.slain, false);
  assert.ok(Math.abs(boss.hpLeft - 0.4) < 1e-9);
  assert.equal(boss.log[0].crit, false);
  const mountain = ironMountain(
    dataset([
      { id: "almost", at: "2026-09-01T12:00:00Z", volume: 999.6, warmup: true },
    ]),
  );
  assert.equal(mountain.totalKg, 999.6);
  assert.equal(mountain.waypoints[0].reached, false);
  assert.equal(mountain.waypoints[0].reachedDate, null);
});

test("buddy counts local calendar days and repeats a date-seeded line", () => {
  const d = dataset([{ id: "recent", at: "2026-09-01T23:30:00Z" }]);
  const now = "2026-09-02T00:30:00Z";
  const ov = overview(d);
  const trophy = trophySummary(d, ov, consistency(d, 1, "UTC", now));
  const utc = buddy(d, ov, [], trophy, "UTC", now);
  const oslo = buddy(d, ov, [], trophy, "Europe/Oslo", now);
  assert.equal(utc.daysSinceWorkout, 1);
  assert.equal(oslo.daysSinceWorkout, 0);
  assert.notEqual(oslo.mood, "celebrating");
  assert.deepEqual(buddy(d, ov, [], trophy, "Europe/Oslo", now), oslo);
});

test("empty and entirely future datasets have no current boss or completed sessions", () => {
  for (const d of [
    dataset([]),
    dataset([{ id: "future", at: "2026-10-01T12:00:00Z" }]),
  ]) {
    assert.deepEqual(bossBattle(d, "UTC", NOW), { current: null, shelf: [] });
    const stats = consistency(d, 1, "UTC", NOW);
    assert.equal(stats.totalWeeks, 0);
    assert.equal(stats.avgPerWeek, 0);
    assert.equal(stats.activeDays, 0);
  }
});
