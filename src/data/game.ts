// The game layer: Gym Buddy, Monthly Boss Battles, and Iron Mountain.
// Everything here is a pure, deterministic function of the dataset plus fixed
// constant pools — no server, no randomness beyond date-seeded picks.

import type { MuscleStat, Overview, TrophySummary } from "./metrics";
import {
  epley1RM,
  isStrengthSet,
  isWorkingSet,
  isoWeek,
  setVolumeKg,
  shortDate,
} from "./metrics";
import type { Dataset } from "./types";

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
    "We trained today. I feel HUGE.",
    "Post-workout glow. Look at us.",
    "That session slapped. Same time next visit?",
  ],
  content: [
    "Nicely recovered. Ready when you are.",
    "Muscles rebuilding… growth in progress.",
    "Rest is part of the program. We're on track.",
  ],
  sleepy: [
    "Getting a bit dusty over here… gym soon?",
    "*yawn* … was starting to hibernate.",
    "My gains are going quiet. Wake them up?",
  ],
  sad: [
    "I miss the gym. And you. Mostly the gym.",
    "A week off?! My biceps are deflating…",
    "Remember me? Your old training partner?",
  ],
};

const CHICKEN_LEGS_LINE = "…also, can we talk about leg day?";

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
}

export function buddy(
  d: Dataset,
  ov: Overview,
  muscles: MuscleStat[],
  trophy: TrophySummary,
): BuddyState {
  // Evolution stage from trophy score.
  let stage = 1;
  for (let i = 0; i < STAGES.length; i++) if (trophy.score >= STAGES[i].threshold) stage = i + 1;
  const nextStage = STAGES[stage]; // undefined when maxed
  const prevThreshold = STAGES[stage - 1].threshold;
  const nextEvolution = nextStage
    ? {
        name: nextStage.name,
        threshold: nextStage.threshold,
        progress: Math.max(
          0,
          Math.min(1, (trophy.score - prevThreshold) / (nextStage.threshold - prevThreshold)),
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
  const armScale = total > 0 ? clamp(0.75 + (upper / total) * 1.1, 0.75, 1.5) : 1;
  const legScale = total > 0 ? clamp(0.7 + (legs / total) * 1.8, 0.7, 1.5) : 1;
  const chickenLegs = total > 0 && legs < upper / 2 && ov.workouts >= 3;
  const torsoScale = clamp(0.8 + Math.log10(Math.max(ov.totalVolumeKg, 1)) / 10, 0.8, 1.4);

  // Mood.
  const now = new Date();
  let daysSince: number | null = null;
  if (ov.lastWorkout) {
    daysSince = Math.max(0, Math.floor((now.getTime() - Date.parse(ov.lastWorkout)) / 86400000));
  }
  const lastWorkoutHadPr = lastSessionBeatARecord(d);
  let mood: BuddyMood;
  if (daysSince === null) mood = "sleepy";
  else if (daysSince <= 1 && lastWorkoutHadPr) mood = "celebrating";
  else if (daysSince <= 1) mood = "pumped";
  else if (daysSince <= 3) mood = "content";
  else if (daysSince <= 6) mood = "sleepy";
  else mood = "sad";

  const pool = MOOD_LINES[mood];
  let moodLine = pool[dayOfYear(now) % pool.length];
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
function lastSessionBeatARecord(d: Dataset): boolean {
  if (d.workouts.length < 2) return d.workouts.length === 1; // first workout = all PRs
  const critSessions = critSessionIds(d);
  return critSessions.has(d.workouts[d.workouts.length - 1].id);
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
  { emoji: "🗿", name: "Gronk", epithet: "Granite Golem", flavor: "It doesn't move. It waits to be out-lifted." },
  { emoji: "🐉", name: "Ferrum", epithet: "Rust Dragon", flavor: "Feeds on skipped sessions. Starve it." },
  { emoji: "🦣", name: "Tonnage", epithet: "Woolly Mammoth", flavor: "Extinct everywhere except your gym." },
  { emoji: "🦑", name: "Kraken", epithet: "Kilogram Kraken", flavor: "Every tentacle is another set you owe." },
  { emoji: "🦖", name: "Rex", epithet: "Plateausaurus", flavor: "Fears nothing but progressive overload." },
  { emoji: "👹", name: "Oni", epithet: "Iron Ogre", flavor: "Guards the rack. Rude about it." },
  { emoji: "🤖", name: "K-2000", epithet: "Chrome Crusher", flavor: "Calculates your defeat. Recalculate it." },
  { emoji: "🐻", name: "Ursa", epithet: "Barbell Bear", flavor: "Hibernation is not an option for either of you." },
  { emoji: "🧊", name: "Glacius", epithet: "Frozen Colossus", flavor: "Melts one rep at a time." },
  { emoji: "🌋", name: "Magmar", epithet: "Molten Behemoth", flavor: "Forged in the fires of leg day." },
  { emoji: "⚙️", name: "Gearlord", epithet: "Machine Overlord", flavor: "It has read your program. Surprise it." },
  { emoji: "🐘", name: "Jumbo", epithet: "Unliftable Elephant", flavor: "Nothing is unliftable. Prove it." },
];

export interface BossLogEntry {
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

export function bossBattle(d: Dataset): BossReport {
  if (d.workouts.length === 0) return { current: null, shelf: [] };

  const crits = critSessionIds(d);
  const now = new Date();
  const first = new Date(d.workouts[0].startTime);

  // Weekly volume by ISO week (for HP baselines).
  const weekVol = new Map<string, { start: Date; volume: number }>();
  for (const w of d.workouts) {
    const { key, weekStart } = isoWeek(w.startTime);
    const cur = weekVol.get(key) ?? { start: weekStart, volume: 0 };
    cur.volume += workoutVolume(w);
    weekVol.set(key, cur);
  }
  const weeks = [...weekVol.values()].sort((a, b) => a.start.getTime() - b.start.getTime());

  const shelf: BossShelfEntry[] = [];
  let current: BossState | null = null;

  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  while (cursor <= now) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1);
    const nextMonth = new Date(y, m + 1, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const isCurrent = y === now.getFullYear() && m === now.getMonth();

    // Baseline: avg of up to 4 weeks fully completed before the month starts;
    // early on (no completed weeks yet) fall back to the first training week.
    // That fallback stabilizes once the first week completes — acceptable for
    // the opening weeks of a brand-new log.
    const completed = weeks.filter(
      (w) => w.start.getTime() + 7 * 86400000 <= monthStart.getTime(),
    );
    const baselineWeeks = completed.slice(-4);
    const baseline =
      baselineWeeks.length > 0
        ? baselineWeeks.reduce((s, w) => s + w.volume, 0) / baselineWeeks.length
        : weeks[0]?.volume ?? 0;

    // First calendar month is prorated from the join date (tutorial boss).
    const isJoinMonth = y === first.getFullYear() && m === first.getMonth();
    const effectiveDays = isJoinMonth ? daysInMonth - first.getDate() + 1 : daysInMonth;

    let hp = Math.round(((baseline * effectiveDays) / 7) * 1.05 / 500) * 500;
    hp = Math.max(hp, 2000);

    // Damage = this month's session volumes.
    const monthWorkouts = d.workouts.filter((w) => {
      const t = Date.parse(w.startTime);
      return t >= monthStart.getTime() && t < nextMonth.getTime();
    });
    const damage = Math.round(monthWorkouts.reduce((s, w) => s + workoutVolume(w), 0));
    const slain = damage >= hp;

    const def = BOSSES[(y * 12 + m) % BOSSES.length];
    const tonnes = hp / 1000;
    const tonneStr = tonnes >= 10 ? String(Math.round(tonnes)) : tonnes.toFixed(1);
    const monthLabel = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    if (isCurrent) {
      const log: BossLogEntry[] = monthWorkouts
        .map((w) => ({
          date: w.startTime,
          label: shortDate(w.startTime),
          damage: Math.round(workoutVolume(w)),
          crit: crits.has(w.id),
        }))
        .reverse();
      current = {
        emoji: def.emoji,
        displayName: `${def.name}, the ${tonneStr}-Tonne ${def.epithet}`,
        flavor: def.flavor,
        monthLabel,
        hp,
        hpLeft: Math.max(0, hp - damage),
        damage,
        slain,
        daysLeft: daysInMonth - now.getDate() + 1,
        log,
      };
    } else {
      shelf.push({
        monthLabel: monthStart.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        emoji: def.emoji,
        name: def.name,
        slain,
      });
    }

    cursor.setMonth(cursor.getMonth() + 1);
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
      if (reachedDates[i] === null && cum >= WAYPOINTS[i].kg) reachedDates[i] = w.startTime;
    }
  }
  const totalKg = Math.round(cum);

  let lastReachedIndex = -1;
  for (let i = 0; i < WAYPOINTS.length; i++) if (totalKg >= WAYPOINTS[i].kg) lastReachedIndex = i;

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

/** Workout ids where a previous est-1RM best was beaten (or the first workout). */
function critSessionIds(d: Dataset): Set<string> {
  const best = new Map<string, number>();
  const crits = new Set<string>();
  for (const w of d.workouts) {
    const sessionBest = new Map<string, number>();
    for (const e of w.exercises) {
      for (const s of e.sets) {
        if (!isStrengthSet(s) || !isWorkingSet(s)) continue;
        const e1 = epley1RM(s.weightKg!, s.reps!);
        if (e1 > (sessionBest.get(e.templateId) ?? 0)) sessionBest.set(e.templateId, e1);
      }
    }
    for (const [id, e1] of sessionBest) {
      const prev = best.get(id);
      if (prev !== undefined && e1 > prev) crits.add(w.id);
      if (prev === undefined || e1 > prev) best.set(id, e1);
    }
  }
  return crits;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
