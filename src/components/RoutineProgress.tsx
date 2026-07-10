import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RoutineSeries } from "../data/metrics";
import { KG_TO_LB } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { Card, ChartTooltip, EmptyHint, Pill } from "./ui";

/** Pick a workout routine and watch its total lift develop run over run. */
export function RoutineProgress({ routines }: { routines: RoutineSeries[] }) {
  const { unit } = useUnit();
  const [selected, setSelected] = useState<string>(routines[0]?.key ?? "");

  // Fall back to the top routine if a range filter removed the selection.
  const routine = routines.find((r) => r.key === selected) ?? routines[0];
  const factor = unit === "kg" ? 1 : KG_TO_LB;

  const data = useMemo(
    () =>
      (routine?.points ?? []).map((p) => ({
        label: p.label,
        value: Math.round(p.volumeKg * factor),
        durationMin: p.durationMin,
        sets: p.sets,
      })),
    [routine, factor],
  );

  if (!routine) {
    return (
      <Card title={<>🔁 Routine Progress</>}>
        <EmptyHint>Log a workout from a routine to track it here.</EmptyHint>
      </Card>
    );
  }

  const first = data[0];
  const last = data[data.length - 1];
  const best = Math.max(...data.map((p) => p.value));
  const deltaPct =
    data.length > 1 && first.value > 0
      ? Math.round(((last.value - first.value) / first.value) * 100)
      : null;

  return (
    <Card
      title={<>🔁 Routine Progress</>}
      hint="Pick a workout and see your total lift each time you've run it."
      accent={
        <select
          value={routine.key}
          onChange={(e) => setSelected(e.target.value)}
          className="max-w-[220px] truncate rounded-xl border border-white/10 bg-ink-900/70 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-glow-violet/50"
        >
          {routines.map((r) => (
            <option key={r.key} value={r.key}>
              {r.title} (×{r.timesPerformed})
            </option>
          ))}
        </select>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill>
          {routine.timesPerformed} run{routine.timesPerformed > 1 ? "s" : ""}
        </Pill>
        <Pill className="!text-emerald-300">
          best {best.toLocaleString()} {unit}
        </Pill>
        {deltaPct != null && (
          <Pill className={deltaPct >= 0 ? "!text-emerald-300" : "!text-amber-300"}>
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct}% since first run
          </Pill>
        )}
      </div>

      {data.length < 2 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
          <div className="stat-value gradient-text">
            {last.value.toLocaleString()} {unit}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            You've run this once. Run it again and the line starts climbing. 📈
          </p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="routineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v: number, name: string) =>
                      name === "Total lift" ? `${v.toLocaleString()} ${unit}` : v
                    }
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Total lift"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#routineFill)"
                dot={{ r: 4, fill: "#059669", stroke: "#10131b", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "#10131b", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
