import { motion } from "framer-motion";
import type { Consistency, Overview } from "../data/metrics";
import { fmtDuration, fmtWeight } from "../data/metrics";
import type { UserMeta } from "../data/types";
import { useUnit } from "../hooks/useUnit";

export function Hero({
  user,
  ov,
  cons,
  generatedAt,
}: {
  user: UserMeta | null;
  ov: Overview;
  cons: Consistency;
  generatedAt: string;
}) {
  const { unit } = useUnit();
  const name = user?.name ?? "athlete";

  const headline =
    ov.workouts <= 1
      ? "The journey begins. 🌱"
      : cons.sessionsThisWeek >= cons.target
        ? "Weekly goal smashed. 💪"
        : cons.weeksOnTargetStreak >= 2
          ? `${cons.weeksOnTargetStreak} weeks on target and counting. 🔥`
          : "Every session counts. Let's go. 💪";

  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-glow-violet/15 via-glow-indigo/5 to-glow-cyan/10 p-6 shadow-card sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:32px_32px] opacity-40" />
      <div className="relative flex flex-col gap-1">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-glow-violet/80">
          Workout Report
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Hey <span className="gradient-text">{name}</span> 👋
        </h1>
        <p className="mt-1 text-slate-300">{headline}</p>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          <HeroStat label="Training for" value={`${ov.daysTraining} ${plural(ov.daysTraining, "day")}`} />
          <HeroStat label="Total time" value={fmtDuration(ov.totalDurationSec)} />
          <HeroStat label="Volume lifted" value={fmtWeight(ov.totalVolumeKg, unit)} />
          <HeroStat label="This week" value={`${cons.sessionsThisWeek} / ${cons.target}`} />
        </div>
      </div>

      <p className="relative mt-6 text-xs text-slate-500">
        Last synced {new Date(generatedAt).toLocaleString()}
      </p>
    </motion.header>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="font-display text-xl font-semibold text-white sm:text-2xl">{value}</div>
    </div>
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
