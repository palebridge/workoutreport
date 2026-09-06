// The game layer: Gym Buddy, Monthly Boss Battles, and Iron Mountain.
// Everything here is a pure, deterministic function of the dataset plus fixed
// constant pools — no server, no randomness beyond date-seeded picks.

import type { MuscleStat, Overview, TrophySummary } from "./metrics";
import { setVolumeKg } from "./metrics";
import {
  addDays,
  dayDistance,
  defaultTimezone,
  displayDay,
  localDay,
  weekStart,
} from "./calendar";
import type { Dataset } from "./types";
import { recordEvents } from "./records";

// ----------------------------------------------------------------------------
// Gym Buddy — an evolving companion computed from the training data
// ----------------------------------------------------------------------------

export type BuddyMood = "celebrating" | "pumped" | "content" | "sleepy" | "sad";

export interface BuddyState {
  /** evolution stage 1–4 */
  stage: number;
  stageName: string;
  mood: BuddyMood;
  moodLine: string;
  /** visual proportions, ~0.7–1.5 */
  armScale: number;
  legScale: number;
  torsoScale: number;
  chickenLegs: boolean;
  daysSinceWorkout: number | null;
  nextEvolution: { name: string; threshold: number; progress: number } | null;
}

const STAGES: { threshold: number; name: string }[] = [
  { threshold: 0, name: "Hatchling" },
  { threshold: 100, name: "Gym Rat" },
  { threshold: 300, name: "Silverback" },
  { threshold: 700, name: "Iron Titan" },
];

const MOOD_LINES: Record<BuddyMood, string[]> = {
  celebrating: [
    "NEW RECORD! I'm framing this one.",
    "Did you SEE that lift?! Legendary.",
    "PR day! I'm telling everyone.",
  ],
  pumped: [
    "Another session in the log. Nice work, team.",
    "Our training story has a new chapter.",
    "That session slapped. Same time next visit?",
  ],
  content: [
    "One more page in our training story.",
    "The log is looking good. See you next session.",
    "Taking a breather. Ready when you are.",
  ],
  sleepy: [
    "Getting a bit dusty over here… gym soon?",
    "*yawn* … was starting to hibernate.",
    "Our next session is still unwritten.",
  ],
  sad: [
    "I miss the gym. And you. Mostly the gym.",
    "It has been a little while. I saved your place.",
    "Remember me? Your old training partner?",
  ],
};

const CHICKEN_LEGS_LINE = "Our log has more upper-body sets so far.";

function dayOfYear(day: string): number {
  return dayDistance(`${day.slice(0, 4)}-01-01`, day) + 1;
}

export function buddy(
  d: Dataset,
  ov: Overview,
  muscles: MuscleStat[],
  trophy: TrophySummary,
  timezone = defaultTimezone(),
  nowISO = new Date().toISOString(),
): BuddyState {
  // Evolution stage from trophy score.
  let stage = 1;
  for (let i = 0; i < STAGES.length; i++)
    if (trophy.score >= STAGES[i].threshold) stage = i + 1;
  const nextStage = STAGES[stage]; // undefined when maxed
  const prevThreshold = STAGES[stage - 1].threshold;
  const nextEvolution = nextStage
    ? {
        name: nextStage.name,
        threshold: nextStage.threshold,
        progress: Math.max(
          0,
          Math.min(
            1,
            (trophy.score - prevThreshold) /
              (nextStage.threshold - prevThreshold),
          ),
        ),
      }
    : null;

  // Proportions from muscle-balance shares.
  let push = 0;
  let pull = 0;
  let legs = 0;
  let total = 0;
  for (const m of muscles) {
    total += m.sets;
    if (m.category === "Push") push += m.sets;
    else if (m.category === "Pull") pull += m.sets;
    else if (m.category === "Legs") legs += m.sets;
  }
  const upper = push + pull;
  const armScale =
    total > 0 ? clamp(0.75 + (upper / total) * 1.1, 0.75, 1.5) : 1;
  const legScale = total > 0 ? clamp(0.7 + (legs / total) * 1.8, 0.7, 1.5) : 1;
  const chickenLegs = total > 0 && legs < upper / 2 && ov.workouts >= 3;
  const torsoScale = clamp(
    0.8 + Math.log10(Math.max(ov.totalVolumeKg, 1)) / 10,
    0.8,
    1.4,
  );

  // Mood.
  const today = localDay(nowISO, timezone);
  const history = d.workouts
    .filter((w) => Date.parse(w.startTime) <= Date.parse(nowISO))
    .sort(
      (a, b) =>
        Date.parse(a.startTime) - Date.parse(b.startTime) ||
        a.id.localeCompare(b.id),
    );
  const lastWorkout = history[history.length - 1];
  const daysSince = lastWorkout
    ? dayDistance(localDay(lastWorkout.startTime, timezone), today)
    : null;
  const lastWorkoutHadPr = lastSessionBeatARecord(d, lastWorkout?.id);
  let mood: BuddyMood;
  if (daysSince === null) mood = "sleepy";
  else if (daysSince <= 1 && lastWorkoutHadPr) mood = "celebrating";
  else if (daysSince <= 1) mood = "pumped";
  else if (daysSince <= 3) mood = "content";
  else if (daysSince <= 6) mood = "sleepy";
  else mood = "sad";

  const pool = MOOD_LINES[mood];
  let moodLine = pool[dayOfYear(today) % pool.length];
  if (chickenLegs && (mood === "content" || mood === "pumped")) {
    moodLine = `${moodLine} ${CHICKEN_LEGS_LINE}`;
  }

  return {
    stage,
    stageName: STAGES[stage - 1].name,
    mood,
    moodLine,
    armScale,
    legScale,
    torsoScale,
    chickenLegs,
    daysSinceWorkout: daysSince,
    nextEvolution,
  };
}

/** Did the most recent workout beat any previous est-1RM best? */
function lastSessionBeatARecord(
  d: Dataset,
  workoutId: string | undefined,
): boolean {
  return workoutId !== undefined && critSessionIds(d).has(workoutId);
}

// ----------------------------------------------------------------------------
// Monthly Boss Battle
// ----------------------------------------------------------------------------

interface BossDef {
  emoji: string;
  name: string;
  /** rendered as: "<name>, the <X>-Tonne <epithet>" */
  epithet: string;
  flavor: string;
}

const BOSSES: BossDef[] = [
  {
    emoji: "🗿",
    name: "Gronk",
    epithet: "Granite Golem",
    flavor: "It doesn't move. It waits to be out-lifted.",
  },
  {
    emoji: "🐉",
    name: "Ferrum",
    epithet: "Rust Dragon",
    flavor: "Feeds on skipped sessions. Starve it.",
  },
  {
    emoji: "🦣",
    name: "Tonnage",
    epithet: "Woolly Mammoth",
    flavor: "Extinct everywhere except your gym.",
  },
  {
    emoji: "🦑",
    name: "Kraken",
    epithet: "Kilogram Kraken",
    flavor: "Every tentacle is another set you owe.",
  },
  {
    emoji: "🦖",
    name: "Rex",
    epithet: "Plateausaurus",
    flavor: "Fears nothing but progressive overload.",
  },
  {
    emoji: "👹",
    name: "Oni",
    epithet: "Iron Ogre",
    flavor: "Guards the rack. Rude about it.",
  },
  {
    emoji: "🤖",
    name: "K-2000",
    epithet: "Chrome Crusher",
    flavor: "Calculates your defeat. Recalculate it.",
  },
  {
    emoji: "🐻",
    name: "Ursa",
    epithet: "Barbell Bear",
    flavor: "Hibernation is not an option for either of you.",
  },
  {
    emoji: "🧊",
    name: "Glacius",
    epithet: "Frozen Colossus",
    flavor: "Melts one rep at a time.",
  },
  {
    emoji: "🌋",
    name: "Magmar",
    epithet: "Molten Behemoth",
    flavor: "Forged in the fires of leg day.",
  },
  {
    emoji: "⚙️",
    name: "Gearlord",
    epithet: "Machine Overlord",
    flavor: "It has read your program. Surprise it.",
  },
  {
    emoji: "🐘",
    name: "Jumbo",
    epithet: "Unliftable Elephant",
    flavor: "Nothing is unliftable. Prove it.",
  },
];

export interface BossLogEntry {
  workoutId: string;
  date: string;
  label: string;
  damage: number;
  crit: boolean;
}

export interface BossState {
  emoji: string;
  displayName: string;
  flavor: string;
  monthLabel: string;
  hp: number;
  hpLeft: number;
  damage: number;
  slain: boolean;
  daysLeft: number;
  log: BossLogEntry[];
}

export interface BossShelfEntry {
  monthLabel: string;
  emoji: string;
  name: string;
  slain: boolean;
}

export interface BossReport {
  current: BossState | null;
  shelf: BossShelfEntry[];
}

export function bossBattle(
  d: Dataset,
  timezone = defaultTimezone(),
  nowISO = new Date().toISOString(),
): BossReport {
  const workouts = d.workouts
    .filter((w) => Date.parse(w.startTime) <= Date.parse(nowISO))
    .sort(
      (a, b) =>
        Date.parse(a.startTime) - Date.parse(b.startTime) ||
        a.id.localeCompare(b.id),
    );
  if (workouts.length === 0) return { current: null, shelf: [] };

  const crits = critSessionIds(d);
  const today = localDay(nowISO, timezone);
  const firstDay = localDay(workouts[0].startTime, timezone);
  const firstWeek = weekStart(firstDay);
  const weekVol = new Map<string, number>();
  for (const w of workouts) {
    const week = weekStart(localDay(w.startTime, timezone));
    weekVol.set(week, (weekVol.get(week) ?? 0) + workoutVolume(w));
  }

  // Include every calendar week since the first session. Missing weeks are
  // zero-volume observations, rather than skipped entries in the HP baseline.
  const weeks: { start: string; volume: number }[] = [];
  const currentWeek = weekStart(today);
  for (let week = firstWeek; week <= currentWeek; week = addDays(week, 7)) {
    weeks.push({ start: week, volume: weekVol.get(week) ?? 0 });
  }

  const shelf: BossShelfEntry[] = [];
  let current: BossState | null = null;
  for (let monthStart = `${firstDay.slice(0, 7)}-01`; monthStart <= today; ) {
    const y = Number(monthStart.slice(0, 4));
    const m = Number(monthStart.slice(5, 7)) - 1;
    const nextMonth = new Date(Date.UTC(y, m + 1, 1, 12))
      .toISOString()
      .slice(0, 10);
    const daysInMonth = dayDistance(monthStart, nextMonth);
    const isCurrent = monthStart.slice(0, 7) === today.slice(0, 7);

    const baselineWeeks = weeks
      .filter((w) => addDays(w.start, 7) <= monthStart)
      .slice(-4);
    // Keep the tutorial fallback to the first training week's logged volume.
    const baseline = baselineWeeks.length
      ? baselineWeeks.reduce((sum, w) => sum + w.volume, 0) /
        baselineWeeks.length
      : (weekVol.get(firstWeek) ?? 0);
    const isJoinMonth = monthStart.slice(0, 7) === firstDay.slice(0, 7);
    const effectiveDays = isJoinMonth
      ? dayDistance(firstDay, nextMonth)
      : daysInMonth;
    const hp = Math.max(
      2000,
      Math.round((((baseline * effectiveDays) / 7) * 1.05) / 500) * 500,
    );

    const monthWorkouts = workouts.filter((w) => {
      const day = localDay(w.startTime, timezone);
      return day >= monthStart && day < nextMonth;
    });
    // Damage keeps full precision so a rounded display cannot defeat a boss.
    const damage = monthWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0);
    const slain = damage >= hp;
    const def = BOSSES[(y * 12 + m) % BOSSES.length];
    const tonnes = hp / 1000;
    const tonneStr =
      tonnes >= 10 ? String(Math.round(tonnes)) : tonnes.toFixed(1);

    if (isCurrent) {
      current = {
        emoji: def.emoji,
        displayName: `${def.name}, the ${tonneStr}-Tonne ${def.epithet}`,
        flavor: def.flavor,
        monthLabel: displayDay(monthStart, { month: "long", year: "numeric" }),
        hp,
        hpLeft: Math.max(0, hp - damage),
        damage,
        slain,
        daysLeft: dayDistance(today, nextMonth),
        log: monthWorkouts
          .map((w) => ({
            workoutId: w.id,
            date: w.startTime,
            label: displayDay(localDay(w.startTime, timezone)),
            damage: workoutVolume(w),
            crit: crits.has(w.id),
          }))
          .reverse(),
      };
    } else {
      shelf.push({
        monthLabel: displayDay(monthStart, { month: "short", year: "2-digit" }),
        emoji: def.emoji,
        name: def.name,
        slain,
      });
    }
    monthStart = nextMonth;
  }
  return { current, shelf };
}

// ----------------------------------------------------------------------------
// Iron Mountain — lifetime tonnage as an ascent
// ----------------------------------------------------------------------------

export interface Waypoint {
  name: string;
  kg: number;
  reached: boolean;
  reachedDate: string | null;
}

export interface MountainState {
  totalKg: number;
  waypoints: Waypoint[];
  /** index of the highest reached waypoint, -1 if none */
  lastReachedIndex: number;
  nextName: string | null;
  kgToNext: number;
  /** 0..1 between last reached waypoint (or 0 kg) and the next one */
  progressToNext: number;
  pctToSummit: number;
}

const WAYPOINTS: { name: string; kg: number }[] = [
  { name: "Base Camp", kg: 1_000 },
  { name: "Foothills", kg: 5_000 },
  { name: "Boulder Field", kg: 10_000 },
  { name: "Pine Ridge", kg: 25_000 },
  { name: "The Wall", kg: 50_000 },
  { name: "Cloud Line", kg: 100_000 },
  { name: "Ice Fields", kg: 250_000 },
  { name: "Death Zone", kg: 500_000 },
  { name: "The Summit", kg: 1_000_000 },
];

export function ironMountain(d: Dataset): MountainState {
  // Replay to find when each waypoint was crossed.
  const reachedDates: (string | null)[] = WAYPOINTS.map(() => null);
  let cum = 0;
  for (const w of d.workouts) {
    cum += workoutVolume(w);
    for (let i = 0; i < WAYPOINTS.length; i++) {
      if (reachedDates[i] === null && cum >= WAYPOINTS[i].kg)
        reachedDates[i] = w.startTime;
    }
  }
  const totalKg = cum;

  let lastReachedIndex = -1;
  for (let i = 0; i < WAYPOINTS.length; i++)
    if (totalKg >= WAYPOINTS[i].kg) lastReachedIndex = i;

  const next = WAYPOINTS[lastReachedIndex + 1] ?? null;
  const prevKg = lastReachedIndex >= 0 ? WAYPOINTS[lastReachedIndex].kg : 0;
  const progressToNext = next
    ? Math.max(0, Math.min(1, (totalKg - prevKg) / (next.kg - prevKg)))
    : 1;

  return {
    totalKg,
    waypoints: WAYPOINTS.map((w, i) => ({
      name: w.name,
      kg: w.kg,
      reached: totalKg >= w.kg,
      reachedDate: reachedDates[i],
    })),
    lastReachedIndex,
    nextName: next?.name ?? null,
    kgToNext: next ? Math.max(0, next.kg - totalKg) : 0,
    progressToNext,
    pctToSummit: Math.min(1, totalKg / WAYPOINTS[WAYPOINTS.length - 1].kg),
  };
}

// ----------------------------------------------------------------------------
// shared helpers
// ----------------------------------------------------------------------------

function workoutVolume(w: Dataset["workouts"][number]): number {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) v += setVolumeKg(s);
  return v;
}

/** Workout ids where an eligible previous est-1RM best was beaten. */
function critSessionIds(d: Dataset): Set<string> {
  return new Set(
    recordEvents(d)
      .filter((e) => e.previous !== null)
      .map((e) => e.workoutId),
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
