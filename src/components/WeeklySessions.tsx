import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeekSessions } from "../data/metrics";
import { Card, ChartTooltip, EmptyHint } from "./ui";

/** Sessions per week against the weekly goal — the trend view of consistency. */
export function WeeklySessions({ weeks, target }: { weeks: WeekSessions[]; target: number }) {
  // Bound the window so a long history stays readable.
  const data = weeks.slice(-16);

  return (
    <Card
      title={<>📊 Sessions per Week</>}
      hint={`Green weeks hit your goal of ${target}. The line is the goal.`}
    >
      {data.length === 0 ? (
        <EmptyHint>Your week-by-week session count lands here.</EmptyHint>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
                domain={[0, (dataMax: number) => Math.max(dataMax, target + 1)]}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={<ChartTooltip formatter={(v: number) => `${v} session${v === 1 ? "" : "s"}`} />}
              />
              <ReferenceLine
                y={target}
                stroke="#64748b"
                strokeWidth={1}
                label={{ value: `goal ${target}`, position: "insideTopRight", fill: "#64748b", fontSize: 10 }}
              />
              <Bar dataKey="count" name="Sessions" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {data.map((w, i) => (
                  <Cell key={i} fill={w.onTarget ? "#059669" : "#8b5cf6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
