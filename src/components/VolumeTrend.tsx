import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Unit, WeekPoint, WorkoutPoint } from "../data/metrics";
import { KG_TO_LB } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { Card, ChartTooltip, EmptyHint } from "./ui";

type Mode = "session" | "week";

export function VolumeTrend({
  sessions,
  weeks,
}: {
  sessions: WorkoutPoint[];
  weeks: WeekPoint[];
}) {
  const { unit } = useUnit();
  const [mode, setMode] = useState<Mode>("session");
  const factor = unit === "kg" ? 1 : KG_TO_LB;

  const data =
    mode === "session"
      ? sessions.map((s) => ({ label: s.label, value: Math.round(s.volumeKg * factor) }))
      : weeks.map((w) => ({ label: w.label, value: Math.round(w.volumeKg * factor) }));

  return (
    <Card
      title={<>📈 Volume Lifted</>}
      hint={`Total weight moved per ${mode}, in ${unit}.`}
      accent={<ModeToggle mode={mode} setMode={setMode} disabled={weeks.length < 2} />}
    >
      {data.length < 2 ? (
        <SingleValue data={data} unit={unit} />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v.toLocaleString()} ${unit}`} />} />
              <Area
                type="monotone"
                dataKey="value"
                name="Volume"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#volFill)"
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

export function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
      {(["session", "week"] as const).map((m) => (
        <button
          key={m}
          disabled={disabled && m === "week"}
          onClick={() => setMode(m)}
          className={`rounded-full px-3 py-1 capitalize transition disabled:opacity-30 ${
            mode === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function SingleValue({ data, unit }: { data: { label: string; value: number }[]; unit: Unit }) {
  if (data.length === 0) {
    return <EmptyHint>No weighted sets logged yet.</EmptyHint>;
  }
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center">
      <div className="stat-value gradient-text">{data[0].value.toLocaleString()} {unit}</div>
      <p className="mt-2 text-sm text-slate-500">Your first session. One more and we'll chart the climb. 📈</p>
    </div>
  );
}
