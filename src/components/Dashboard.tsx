import { useMemo } from "react";
import {
  achievements,
  categorySplit,
  consistency,
  exerciseSummaries,
  muscleBalance,
  overview,
  personalRecords,
  weeklyTrend,
  workoutTrend,
} from "../data/metrics";
import type { Dataset } from "../data/types";
import { Achievements } from "./Achievements";
import { ConsistencyHeatmap } from "./ConsistencyHeatmap";
import { ExerciseProgress } from "./ExerciseProgress";
import { Hero } from "./Hero";
import { MuscleBalance } from "./MuscleBalance";
import { RecentWorkouts } from "./RecentWorkouts";
import { StatCounters } from "./StatCounters";
import { TimeTrend } from "./TimeTrend";
import { UnitToggle } from "./UnitToggle";
import { VolumeTrend } from "./VolumeTrend";

export function Dashboard({ dataset }: { dataset: Dataset }) {
  const ov = useMemo(() => overview(dataset), [dataset]);
  const muscles = useMemo(() => muscleBalance(dataset), [dataset]);
  const split = useMemo(() => categorySplit(muscles), [muscles]);
  const cons = useMemo(() => consistency(dataset), [dataset]);
  const sessions = useMemo(() => workoutTrend(dataset), [dataset]);
  const weeks = useMemo(() => weeklyTrend(dataset), [dataset]);
  const summaries = useMemo(() => exerciseSummaries(dataset), [dataset]);
  const prs = useMemo(() => personalRecords(dataset), [dataset]);
  const ach = useMemo(() => achievements(dataset, ov, cons), [dataset, ov, cons]);

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
            onClick={() => location.reload()}
            title="Lock dashboard"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
          >
            🔒 Lock
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <Hero user={dataset.user} ov={ov} cons={cons} generatedAt={dataset.generatedAt} />
        <StatCounters ov={ov} cons={cons} />

        {/* Featured */}
        <MuscleBalance stats={muscles} split={split} />

        <div className="grid gap-5 lg:grid-cols-2">
          <VolumeTrend sessions={sessions} weeks={weeks} />
          <TimeTrend sessions={sessions} weeks={weeks} ov={ov} />
        </div>

        <ConsistencyHeatmap cons={cons} />
        <ExerciseProgress dataset={dataset} summaries={summaries} />
        <Achievements achievements={ach} records={prs} />
        <RecentWorkouts dataset={dataset} />

        <footer className="pt-4 text-center text-xs text-slate-600">
          Data from Hevy · synced {new Date(dataset.generatedAt).toLocaleDateString()} · decrypted in your browser
        </footer>
      </div>
    </div>
  );
}
