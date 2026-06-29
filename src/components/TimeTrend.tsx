import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Overview, WeekPoint, WorkoutPoint } from "../data/metrics";
import { fmtDuration } from "../data/metrics";
import { Card, ChartTooltip, EmptyHint } from "./ui";
import { ModeToggle } from "./VolumeTrend";

type Mode = "session" | "week";

export function TimeTrend({
  sessions,
  weeks,
  ov,
}: {
  sessions: WorkoutPoint[];
  weeks: WeekPoint[];
  ov: Overview;
}) {
  const [mode, setMode] = useState<Mode>("session");

  const data =
    mode === "session"
      ? sessions.map((s) => ({ label: s.label, value: s.durationMin }))
      : weeks.map((w) => ({ label: w.label, value: w.durationMin }));

  return (
    <Card
      title={<>⏱️ Time in the Gym</>}
      hint={`Minutes logged per ${mode}. Average session ${fmtDuration(ov.avgDurationSec)}.`}
      accent={<ModeToggle mode={mode} setMode={setMode} disabled={weeks.length < 2} />}
    >
      {data.length === 0 ? (
        <EmptyHint>No sessions logged yet.</EmptyHint>
      ) : data.length < 2 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center">
          <div className="stat-value gradient-text">{fmtDuration(ov.totalDurationSec)}</div>
          <p className="mt-2 text-sm text-slate-500">Logged so far. Keep showing up. ⏱️</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="timeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={40} unit="m" />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={<ChartTooltip formatter={(v: number) => `${v} min`} />}
              />
              <Bar dataKey="value" name="Duration" fill="url(#timeFill)" radius={[6, 6, 0, 0]} maxBarSize={46} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
