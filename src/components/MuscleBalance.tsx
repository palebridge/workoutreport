import { useState } from "react";
import {
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CategorySplit, MuscleStat, Unit } from "../data/metrics";
import { KG_TO_LB } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { Card, ChartTooltip, EmptyHint, Pill } from "./ui";

type Metric = "sets" | "volume";

export function MuscleBalance({
  stats,
  split,
}: {
  stats: MuscleStat[];
  split: CategorySplit[];
}) {
  const { unit } = useUnit();
  const [metric, setMetric] = useState<Metric>("sets");

  if (stats.length === 0) {
    return (
      <Card title={<>🧬 Muscle Balance</>} hint="Which muscle groups you're hitting">
        <EmptyHint>Log a workout with weights to see your muscle balance light up.</EmptyHint>
      </Card>
    );
  }

  const value = (s: MuscleStat) => (metric === "sets" ? s.sets : toUnitVol(s.volumeKg, unit));
  const radarData = stats.slice(0, 9).map((s) => ({ label: s.label, value: value(s), category: s.category }));
  const most = stats[0];
  const least = stats[stats.length - 1];

  return (
    <Card
      title={<>🧬 Muscle Balance</>}
      hint="Weighted sets per muscle group — primary movers count full, assisting muscles count half."
      accent={
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
          {(["sets", "volume"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                metric === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Radar (or bar fallback when too few muscles for a meaningful shape) */}
        <div className="h-[300px]">
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar
                  name={metric === "sets" ? "Weighted sets" : `Volume (${unit})`}
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="#8b5cf6"
                  fillOpacity={0.18}
                  isAnimationActive
                />
                <Tooltip content={<ChartTooltip formatter={(v: number) => round(v)} />} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <BarFallback stats={stats} metric={metric} unit={unit} />
          )}
        </div>

        {/* Push/Pull/Legs donut + callouts */}
        <div className="flex flex-col">
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={split}
                  dataKey="sets"
                  nameKey="category"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="#10131b"
                  strokeWidth={2}
                >
                  {split.map((s) => (
                    <Cell key={s.category} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip formatter={(v: number) => `${round(v)} sets`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs uppercase tracking-wider text-slate-500">Split</span>
              <span className="text-sm font-medium text-slate-300">Push·Pull·Legs</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {split.map((s) => (
              <span key={s.category} className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.category} · {round(s.sets)}
              </span>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-white/5 pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Most trained</span>
              <Pill className="!text-emerald-300">{most.label}</Pill>
            </div>
            {least.muscle !== most.muscle && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Needs love</span>
                <Pill className="!text-amber-300">{least.label}</Pill>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BarFallback({ stats, metric, unit }: { stats: MuscleStat[]; metric: Metric; unit: Unit }) {
  const value = (s: MuscleStat) => (metric === "sets" ? s.sets : toUnitVol(s.volumeKg, unit));
  const max = Math.max(...stats.map(value), 1);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      {stats.map((s) => (
        <div key={s.muscle}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-300">{s.label}</span>
            <span className="text-slate-500">{round(value(s))}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full"
              style={{ width: `${(value(s) / max) * 100}%`, background: "#8b5cf6" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function toUnitVol(kg: number, unit: Unit): number {
  return Math.round(unit === "kg" ? kg : kg * KG_TO_LB);
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
