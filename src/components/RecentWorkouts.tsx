import { useState } from "react";
import { fmtDuration, fmtWeight, setVolumeKg } from "../data/metrics";
import type { Dataset, DatasetWorkout } from "../data/types";
import { useUnit } from "../hooks/useUnit";
import { Card, Pill } from "./ui";

export function RecentWorkouts({ dataset }: { dataset: Dataset }) {
  const recent = [...dataset.workouts].reverse().slice(0, 8);

  return (
    <Card title={<>🗒️ Recent Workouts</>} hint="Your latest sessions — tap to expand.">
      {recent.length === 0 ? (
        <p className="text-sm text-slate-500">No workouts yet.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((w) => (
            <WorkoutRow key={w.id} workout={w} templates={dataset.templates} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function WorkoutRow({
  workout,
  templates,
}: {
  workout: DatasetWorkout;
  templates: Dataset["templates"];
}) {
  const { unit } = useUnit();
  const [open, setOpen] = useState(false);

  let volume = 0;
  let sets = 0;
  for (const e of workout.exercises)
    for (const s of e.sets) {
      sets += 1;
      volume += setVolumeKg(s);
    }

  return (
    <li className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
      >
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-100">{workout.title}</div>
          <div className="text-xs text-slate-500">
            {new Date(workout.startTime).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill>{fmtDuration(workout.durationSeconds)}</Pill>
          <Pill className="hidden sm:inline-flex">{workout.exercises.length} ex</Pill>
          {volume > 0 && <Pill className="!text-emerald-300">{fmtWeight(volume, unit)}</Pill>}
          <span className={`text-slate-500 transition ${open ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 px-4 py-3">
          <ul className="space-y-2.5">
            {workout.exercises.map((e) => {
              const t = templates[e.templateId];
              return (
                <li key={e.index} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-200">{e.title}</span>
                    {t?.primaryMuscleGroup && (
                      <span className="ml-2 text-xs capitalize text-slate-500">
                        {t.primaryMuscleGroup.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400">
                    {e.sets.map((s, i) => (
                      <span key={i} className="ml-1.5 inline-block">
                        {formatSet(s, unit)}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <span className="mt-3 inline-block text-xs text-slate-500">{sets} total sets</span>
        </div>
      )}
    </li>
  );
}

function formatSet(s: { weightKg: number | null; reps: number | null; durationSeconds: number | null }, unit: "kg" | "lb") {
  if (s.weightKg != null && s.reps != null) return `${fmtWeight(s.weightKg, unit, 1)}×${s.reps}`;
  if (s.reps != null) return `${s.reps} reps`;
  if (s.durationSeconds != null) return fmtDuration(s.durationSeconds);
  return "—";
}
