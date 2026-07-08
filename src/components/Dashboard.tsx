import { useMemo, useState } from "react";
import {
  achievements,
  buildInsights,
  categorySplit,
  consistency,
  exerciseSummaries,
  muscleBalance,
  overview,
  personalRecords,
  weekdayRhythm,
  weeklyTrend,
  workoutTrend,
} from "../data/metrics";
import type { Dataset } from "../data/types";
import { useWeeklyTarget } from "../hooks/useWeeklyTarget";
import { Achievements } from "./Achievements";
import { BodyMeasurements } from "./BodyMeasurements";
import { ConsistencyHeatmap } from "./ConsistencyHeatmap";
import { ExerciseProgress } from "./ExerciseProgress";
import { Hero } from "./Hero";
import { Insights } from "./Insights";
import { MuscleBalance } from "./MuscleBalance";
import { RangeFilter } from "./RangeFilter";
import type { RangeWeeks } from "./RangeFilter";
import { RecentWorkouts } from "./RecentWorkouts";
import { StatCounters } from "./StatCounters";
import { TimeTrend } from "./TimeTrend";
import { UnitToggle } from "./UnitToggle";
import { VolumeTrend } from "./VolumeTrend";
import { WeekRhythm } from "./WeekRhythm";
import { WeeklySessions } from "./WeeklySessions";

type RefreshStatus = "idle" | "loading" | "updated" | "current" | "error";

export function Dashboard({
  dataset,
  onRefresh,
}: {
  dataset: Dataset;
  onRefresh: () => Promise<{ changed: boolean }>;
}) {
  const { target } = useWeeklyTarget();
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [range, setRange] = useState<RangeWeeks>(0);

  async function handleRefresh() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const { changed } = await onRefresh();
      setStatus(changed ? "updated" : "current");
    } catch {
      setStatus("error");
    }
    window.setTimeout(() => setStatus("idle"), 2600);
  }

  // ---- All-time metrics (hero, totals, calendar, records, badges) ----
  const ov = useMemo(() => overview(dataset), [dataset]);
  const cons = useMemo(() => consistency(dataset, target), [dataset, target]);
  const prs = useMemo(() => personalRecords(dataset), [dataset]);
  const ach = useMemo(() => achievements(dataset, ov, cons), [dataset, ov, cons]);
  const musclesAll = useMemo(() => muscleBalance(dataset), [dataset]);
  const insights = useMemo(
    () => buildInsights(dataset, ov, cons, musclesAll, ach),
    [dataset, ov, cons, musclesAll, ach],
  );

  // ---- Range-scoped dataset: the filter row scopes every chart below it ----
  const scoped = useMemo(() => {
    if (range === 0) return dataset;
    const cutoff = Date.now() - range * 7 * 86400000;
    return {
      ...dataset,
      workouts: dataset.workouts.filter((w) => Date.parse(w.startTime) >= cutoff),
      bodyMeasurements: dataset.bodyMeasurements.filter((m) => Date.parse(m.date) >= cutoff),
    };
  }, [dataset, range]);

  const muscles = useMemo(() => (range === 0 ? musclesAll : muscleBalance(scoped)), [range, musclesAll, scoped]);
  const split = useMemo(() => categorySplit(muscles), [muscles]);
  const sessions = useMemo(() => workoutTrend(scoped), [scoped]);
  const weeks = useMemo(() => weeklyTrend(scoped), [scoped]);
  const rhythm = useMemo(() => weekdayRhythm(scoped), [scoped]);
  const weeklySessions = useMemo(() => consistency(scoped, target).weeks, [scoped, target]);
  const summaries = useMemo(() => exerciseSummaries(scoped), [scoped]);
  const scopedOv = useMemo(() => (range === 0 ? ov : overview(scoped)), [range, ov, scoped]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <span className="text-lg">💪</span>
          <span className="hidden sm:inline">Workout Report</span>
        </div>
        <div className="flex items-center gap-2">
          <UnitToggle />
          <button
            onClick={handleRefresh}
            disabled={status === "loading"}
            title="Re-fetch the latest deployed data"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:text-white disabled:opacity-60"
          >
            <span className={status === "loading" ? "inline-block animate-spin" : ""}>↻</span>
            {refreshLabel(status)}
          </button>
          <button
            onClick={() => location.reload()}
            title="Lock dashboard"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
          >
            🔒
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <Hero user={dataset.user} ov={ov} cons={cons} generatedAt={dataset.generatedAt} />
        <StatCounters ov={ov} cons={cons} />
        <Insights insights={insights} />

        {/* One filter row; everything from here to the "All history" section is scoped. */}
        <RangeFilter value={range} onChange={setRange} />

        <MuscleBalance stats={muscles} split={split} />

        <div className="grid gap-5 lg:grid-cols-2">
          <VolumeTrend sessions={sessions} weeks={weeks} />
          <TimeTrend sessions={sessions} weeks={weeks} ov={scopedOv} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <WeekRhythm rhythm={rhythm} />
          <WeeklySessions weeks={weeklySessions} target={target} />
        </div>

        <ExerciseProgress dataset={scoped} summaries={summaries} />
        <BodyMeasurements measurements={scoped.bodyMeasurements} />
        <RecentWorkouts dataset={scoped} />

        {/* All-history section — deliberately not affected by the range filter. */}
        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            All history
          </span>
          <span className="flex-1 border-t border-white/5" />
        </div>

        <ConsistencyHeatmap cons={cons} />
        <Achievements achievements={ach} records={prs} />

        <footer className="pt-4 text-center text-xs text-slate-600">
          Data from Hevy · synced {new Date(dataset.generatedAt).toLocaleDateString()} · decrypted in your browser
        </footer>
      </div>
    </div>
  );
}

function refreshLabel(status: RefreshStatus): string {
  switch (status) {
    case "loading":
      return "Refreshing…";
    case "updated":
      return "Updated ✓";
    case "current":
      return "Up to date";
    case "error":
      return "Retry";
    default:
      return "Refresh";
  }
}
