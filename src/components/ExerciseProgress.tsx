import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { exerciseProgress, fmtWeight, KG_TO_LB } from "../data/metrics";
import type { ExerciseSummary } from "../data/metrics";
import type { Dataset } from "../data/types";
import { useUnit } from "../hooks/useUnit";
import { Card, ChartTooltip, Pill } from "./ui";

type Metric = "est1RMKg" | "topWeightKg" | "volumeKg";
const METRIC_LABEL: Record<Metric, string> = {
  est1RMKg: "Est. 1RM",
  topWeightKg: "Top weight",
  volumeKg: "Volume",
};

export function ExerciseProgress({
  dataset,
  summaries,
}: {
  dataset: Dataset;
  summaries: ExerciseSummary[];
}) {
  const { unit } = useUnit();
  const [selected, setSelected] = useState<string>(summaries[0]?.templateId ?? "");
  const [metric, setMetric] = useState<Metric>("est1RMKg");

  // If a range filter removed the selected exercise, fall back to the top one.
  const summary = summaries.find((s) => s.templateId === selected) ?? summaries[0];
  const effectiveId = summary?.templateId ?? "";
  const points = useMemo(() => exerciseProgress(dataset, effectiveId), [dataset, effectiveId]);

  const isWeight = metric !== "volumeKg";
  const factor = isWeight && unit === "lb" ? KG_TO_LB : metric === "volumeKg" && unit === "lb" ? KG_TO_LB : 1;
  const chartData = points.map((p) => ({
    label: p.label,
    value: Math.round(p[metric] * factor * 10) / 10,
    isPR: p.isPR,
  }));
  const prPoints = chartData.filter((d) => d.isPR);

  // Change in the selected metric from the first session that recorded it to
  // the most recent one. Computed on raw kg — a ratio is unit-independent.
  const recorded = points.filter((p) => p[metric] > 0);
  const deltaPct =
    recorded.length >= 2
      ? Math.round(
          ((recorded[recorded.length - 1][metric] - recorded[0][metric]) / recorded[0][metric]) * 100,
        )
      : null;

  if (!summary) {
    return (
      <Card title={<>🎯 Exercise Progress</>}>
        <p className="text-sm text-slate-500">Log an exercise to track its progression.</p>
      </Card>
    );
  }

  return (
    <Card
      title={<>🎯 Exercise Progress</>}
      hint="Pick a lift to see how it's trending. PRs are marked with a ⭐."
      accent={
        <select
          value={effectiveId}
          onChange={(e) => setSelected(e.target.value)}
          className="max-w-[200px] truncate rounded-xl border border-white/10 bg-ink-900/70 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-glow-violet/50"
        >
          {summaries.map((s) => (
            <option key={s.templateId} value={s.templateId}>
              {s.title}
            </option>
          ))}
        </select>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill>{summary.sessions} session{summary.sessions > 1 ? "s" : ""}</Pill>
        <Pill>Best {fmtWeight(summary.bestWeightKg, unit, 1)}</Pill>
        <Pill className="!text-emerald-300">Est. 1RM {fmtWeight(summary.best1RMKg, unit, 1)}</Pill>
        {summary.template?.primaryMuscleGroup && (
          <Pill className="!text-cyan-300 capitalize">
            {summary.template.primaryMuscleGroup.replace(/_/g, " ")}
          </Pill>
        )}
        {deltaPct != null && (
          <Pill
            className={deltaPct >= 0 ? "!text-emerald-300" : "!text-amber-300"}
            title={`${METRIC_LABEL[metric]} since your first session with this lift`}
          >
            {deltaPct >= 0 ? "▲" : "▼"} {deltaPct >= 0 ? "+" : ""}
            {deltaPct}% since first session
          </Pill>
        )}
        <div className="ml-auto inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-2.5 py-1 transition ${
                metric === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
          <div className="stat-value gradient-text">
            {metric === "volumeKg"
              ? `${chartData[0]?.value.toLocaleString() ?? 0} ${unit}`
              : fmtWeight(summary[metric === "est1RMKg" ? "best1RMKg" : "bestWeightKg"], unit, 1)}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            One session in. Repeat this lift to watch the line climb. 🚀
          </p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatter={(v: number) => (metric === "volumeKg" ? `${v.toLocaleString()} ${unit}` : `${v} ${unit}`)}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                name={METRIC_LABEL[metric]}
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#8b5cf6", stroke: "#10131b", strokeWidth: 2 }}
                activeDot={{ r: 5, stroke: "#10131b", strokeWidth: 2 }}
              />
              {prPoints.map((p, i) => (
                <ReferenceDot
                  key={i}
                  x={p.label}
                  y={p.value}
                  r={6}
                  fill="#d97706"
                  stroke="#10131b"
                  strokeWidth={2}
                  isFront
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
