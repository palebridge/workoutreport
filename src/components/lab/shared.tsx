import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Dataset, DatasetWorkout } from "../../data/types";
import type { AnalysisContext } from "../../data/calendar";
import { localDay, displayDay } from "../../data/calendar";
import { METRICS } from "../../data/analysis";
import type { Metric } from "../../data/analysis";
import { useUnit } from "../../hooks/useUnit";
import { KG_TO_LB } from "../../data/metrics";
import { Icon } from "./Icons";

export const pretty = (value: string) =>
  value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const number = (n: number, digits = 0) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: digits });
export const signed = (n: number, digits = 0) =>
  `${n > 0 ? "+" : ""}${number(n, digits)}`;
export function useFormat() {
  const { unit } = useUnit();
  const weight = (kg: number, digits = 1) =>
    `${number(kg * (unit === "lb" ? KG_TO_LB : 1), digits)} ${unit}`;
  const metric = (n: number | null, m: Metric) =>
    n == null
      ? "Not recorded"
      : METRICS[m].unit === "kg"
        ? weight(n)
        : `${number(n, 1)} ${METRICS[m].unit}`;
  return { unit, weight, metric };
}
export function Panel({
  label,
  title,
  action,
  children,
  className = "",
}: {
  label?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading">
        <div>
          {label && <p className="eyebrow">{label}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Empty({
  title = "Your next session starts the story.",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-cross">+</span>
      <h3>{title}</h3>
      <p>
        {children ??
          "Once your workouts are synced, the patterns will appear here."}
      </p>
    </div>
  );
}
export function Methods({ children }: { children?: ReactNode }) {
  return (
    <details className="methods">
      <summary>
        <Icon name="info" size={16} /> How calculated
      </summary>
      <div>
        {children ?? (
          <>
            <p>
              Working sets exclude warmups. Load volume is the sum of recorded
              external load × repetitions; it does not include body weight or
              measure effort.
            </p>
            <p>
              Estimated 1RM uses Epley for 2–10 reps of externally loaded
              exercises. Single reps use the recorded load. Records exclude
              warmups, first observations, assisted movements, and unknown
              exercise types.
            </p>
            <p>
              Muscle distribution counts primary and secondary involvement
              separately. Missing RPE and body measurements are not treated as
              zero.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="workout-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <header className="dialog-heading">
          <div>
            <p className="eyebrow">The source data</p>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close details"
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function WorkoutDetail({
  workout,
  dataset,
  context,
  onClose,
}: {
  workout: DatasetWorkout;
  dataset: Dataset;
  context: AnalysisContext;
  onClose: () => void;
}) {
  const fmt = useFormat();
  return (
    <Modal title={workout.title} onClose={onClose}>
      <p className="detail-meta">
        {displayDay(localDay(workout.startTime, context.timezone), {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        <span>·</span> {Math.round(workout.durationSeconds / 60)} min logged
      </p>
      {workout.description && (
        <p className="workout-note">{workout.description}</p>
      )}
      {workout.exercises.map((e) => (
        <section className="detail-exercise" key={e.index}>
          <div className="flex-between">
            <h3>{e.title}</h3>
            <span className="tag">
              {pretty(
                dataset.templates[e.templateId]?.primaryMuscleGroup ??
                  "unclassified",
              )}
            </span>
          </div>
          {e.notes && <p className="workout-note">{e.notes}</p>}
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Logged sets for {e.title}</caption>
              <thead>
                <tr>
                  <th>Set</th>
                  <th>Type</th>
                  <th>Load</th>
                  <th>Reps</th>
                  <th>Time</th>
                  <th>Distance</th>
                  <th>RPE</th>
                </tr>
              </thead>
              <tbody>
                {e.sets.map((s, i) => (
                  <tr key={s.index}>
                    <th>{i + 1}</th>
                    <td>{pretty(s.type)}</td>
                    <td>{s.weightKg == null ? "—" : fmt.weight(s.weightKg)}</td>
                    <td>{s.reps ?? "—"}</td>
                    <td>
                      {s.durationSeconds == null
                        ? "—"
                        : `${s.durationSeconds}s`}
                    </td>
                    <td>
                      {s.distanceMeters == null ? "—" : `${s.distanceMeters}m`}
                    </td>
                    <td>{s.rpe ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="muted small">
        Dashes mean not recorded. These are the original logged sets, including
        warmups.
      </p>
    </Modal>
  );
}
