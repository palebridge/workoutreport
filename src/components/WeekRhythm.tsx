import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WeekdayCount } from "../data/metrics";
import { Card, ChartTooltip, EmptyHint } from "./ui";

/** Which days of the week training actually happens on. */
export function WeekRhythm({ rhythm }: { rhythm: WeekdayCount[] }) {
  const total = rhythm.reduce((s, r) => s + r.count, 0);
  const top = rhythm.reduce((m, r) => (r.count > m.count ? r : m), rhythm[0]);

  return (
    <Card
      title={<>🎵 Week Rhythm</>}
      hint={
        total > 0 && top.count > 0
          ? `Your sessions by weekday — ${top.day} is your day so far.`
          : "Your sessions by weekday."
      }
    >
      {total === 0 ? (
        <EmptyHint>Once you log a few sessions, your weekly pattern shows up here.</EmptyHint>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rhythm} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={<ChartTooltip formatter={(v: number) => `${v} session${v === 1 ? "" : "s"}`} />}
              />
              <Bar dataKey="count" name="Sessions" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
