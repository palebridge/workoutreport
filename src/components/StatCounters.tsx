import type { ReactNode } from "react";
import type { Consistency, Overview } from "../data/metrics";
import { KG_TO_LB } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { AnimatedNumber, Card } from "./ui";

export function StatCounters({ ov, cons }: { ov: Overview; cons: Consistency }) {
  const { unit } = useUnit();
  const factor = unit === "kg" ? 1 : KG_TO_LB;

  const stats: {
    label: string;
    value: number;
    format?: (v: number) => string;
    accent: string;
    icon: ReactNode;
  }[] = [
    {
      label: "Workouts",
      value: ov.workouts,
      accent: "from-glow-violet/30 to-glow-indigo/10",
      icon: "🏋️",
    },
    {
      label: `Volume (${unit})`,
      value: ov.totalVolumeKg * factor,
      format: (v) => compact(v),
      accent: "from-glow-emerald/30 to-glow-cyan/10",
      icon: "⚖️",
    },
    {
      label: "Total sets",
      value: ov.totalSets,
      accent: "from-glow-cyan/30 to-glow-indigo/10",
      icon: "📦",
    },
    {
      label: "Total reps",
      value: ov.totalReps,
      accent: "from-glow-amber/30 to-glow-rose/10",
      icon: "🔁",
    },
    {
      label: "Exercises",
      value: ov.uniqueExercises,
      accent: "from-glow-pink/30 to-glow-violet/10",
      icon: "🎯",
    },
    {
      label: "Longest streak",
      value: cons.longestStreak,
      format: (v) => `${Math.round(v)}d`,
      accent: "from-glow-rose/30 to-glow-amber/10",
      icon: "🔥",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <Card key={s.label} className="!p-4">
          <div
            className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.accent} text-lg`}
          >
            {s.icon}
          </div>
          <div className="stat-value !text-2xl sm:!text-3xl">
            <AnimatedNumber value={s.value} format={s.format ?? ((v) => Math.round(v).toLocaleString())} />
          </div>
          <div className="mt-0.5 text-xs uppercase tracking-wider text-slate-400">{s.label}</div>
        </Card>
      ))}
    </div>
  );
}

function compact(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`;
  return Math.round(v).toLocaleString();
}
