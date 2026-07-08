import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtWeight, shortDate } from "../data/metrics";
import type { BodyMeasurement } from "../data/types";
import { useUnit } from "../hooks/useUnit";
import { Card, ChartTooltip, Pill } from "./ui";
import { KG_TO_LB } from "../data/metrics";

/** Body-weight trend from Hevy's measurements log. Hidden until data exists. */
export function BodyMeasurements({ measurements }: { measurements: BodyMeasurement[] }) {
  const { unit } = useUnit();
  const weighins = measurements.filter((m) => m.weightKg != null);
  if (weighins.length === 0) return null;

  const factor = unit === "kg" ? 1 : KG_TO_LB;
  const data = weighins.map((m) => ({
    label: shortDate(m.date),
    value: Math.round((m.weightKg as number) * factor * 10) / 10,
  }));
  const latest = weighins[weighins.length - 1];
  const first = weighins[0];
  const deltaKg = (latest.weightKg as number) - (first.weightKg as number);

  return (
    <Card
      title={<>⚖️ Body Weight</>}
      hint="From your Hevy measurements log."
      accent={
        <div className="flex gap-2">
          <Pill>{fmtWeight(latest.weightKg as number, unit, 1)}</Pill>
          {weighins.length > 1 && (
            <Pill className={deltaKg <= 0 ? "!text-emerald-300" : "!text-amber-300"}>
              {deltaKg > 0 ? "+" : ""}
              {fmtWeight(deltaKg, unit, 1)} total
            </Pill>
          )}
        </div>
      }
    >
      {data.length < 2 ? (
        <p className="text-sm text-slate-500">
          One weigh-in logged. Add more in Hevy to see the trend.
        </p>
      ) : (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v} ${unit}`} />} />
              <Line
                type="monotone"
                dataKey="value"
                name="Body weight"
                stroke="#0891b2"
                strokeWidth={2}
                dot={{ r: 4, fill: "#0891b2", stroke: "#10131b", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "#10131b", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
