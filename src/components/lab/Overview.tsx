import { useMemo } from "react";
import type { Dataset } from "../../data/types";
import type { AnalysisContext } from "../../data/calendar";
import { displayDay, localDay } from "../../data/calendar";
import {
  buildFindings,
  exerciseSeries,
  percentChange,
  rangeLabel,
  scopedWorkouts,
  totals,
  weeklyBuckets,
} from "../../data/analysis";
import type { Finding } from "../../data/analysis";
import { Atlas } from "./Atlas";
import { Empty, Methods, number, Panel, signed, useFormat } from "./shared";
import { Icon } from "./Icons";

export default function Overview({
  dataset,
  context,
  onWorkout,
  onExplore,
}: {
  dataset: Dataset;
  context: AnalysisContext;
  onWorkout: (id: string) => void;
  onExplore: (target: Finding["target"]) => void;
}) {
  const series = useMemo(
    () => exerciseSeries(dataset, context),
    [dataset, context],
  );
  const workouts = useMemo(
    () => scopedWorkouts(dataset, context),
    [dataset, context],
  );
  const facts = useMemo(
    () => buildFindings(dataset, context, series),
    [dataset, context, series],
  );
  const weeks = useMemo(
    () => weeklyBuckets(dataset, context),
    [dataset, context],
  );
  const visibleWeeks = weeks.slice(-12);
  const current = totals(workouts, context.includeWarmups);
  const previous = context.comparison
    ? totals(
        scopedWorkouts(dataset, context, context.comparison),
        context.includeWarmups,
      )
    : null;
  const comparisonCovered =
    context.comparison &&
    dataset.workouts[0] &&
    localDay(dataset.workouts[0].startTime, context.timezone) <=
      context.comparison.start;
  const fmt = useFormat();
  const latest = workouts.at(-1);
  return (
    <div className="view-enter">
      <div className="overview-intro">
        <div>
          <p className="eyebrow">
            <span className="status-dot" /> Your training, in focus
          </p>
          <h1>
            The work.
            <br />
            <span className="text-muted">The progress.</span>
          </h1>
        </div>
        <p className="intro-note">
          A closer look at what you put in.
          <br />
          And how far it’s taking you.
        </p>
        <span className="edition-mark" aria-hidden="true">
          WR / 01
        </span>
      </div>
      <div className="metric-strip">
        {(
          [
            {
              key: "sessions",
              label: "Sessions",
              value: number(current.sessions),
              suffix: "recorded workout sessions",
            },
            {
              key: "sets",
              label: context.includeWarmups ? "Logged sets" : "Working sets",
              value: number(current.sets),
              suffix: context.includeWarmups
                ? "including warmups"
                : "warmups excluded",
            },
            {
              key: "volume",
              label: "Load volume",
              value: fmt.weight(current.volume, 0),
              suffix: "recorded load × reps",
            },
          ] as const
        ).map((m, i) => {
          const delta =
            comparisonCovered && previous
              ? percentChange(current[m.key], previous[m.key])
              : null;
          return (
            <div className="headline-metric" key={m.key}>
              <p className="eyebrow">
                <span>0{i + 1}</span> {m.label}
              </p>
              <div className="metric-number">{m.value}</div>
              <p>
                {delta == null ? (
                  m.suffix
                ) : (
                  <>
                    <span className="comparison-change">
                      {signed(delta, 1)}%
                    </span>{" "}
                    vs previous period
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
      {!workouts.length ? (
        <Empty title="No sessions in this window.">
          Try a wider date range to explore your history.
        </Empty>
      ) : (
        <>
          <Panel
            label="01 / Progress, connected"
            title="Your training atlas"
            action={<span className="tag">{series.length} exercises</span>}
          >
            <Atlas
              series={series}
              range={context.range}
              onWorkout={onWorkout}
              onExercise={(id) => onExplore({ mode: "lifts", exerciseId: id })}
            />
          </Panel>
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / What changed</p>
              <h2>Follow the interesting parts.</h2>
            </div>
            <span className="small muted">{rangeLabel(context.range)}</span>
          </div>
          <div className="finding-grid">
            {facts.map((f, i) => (
              <article className={`finding finding-${f.kind}`} key={f.id}>
                <div className="finding-top">
                  <span className="eyebrow">{f.eyebrow}</span>
                  <span className="finding-index">0{i + 1}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.detail}</p>
                <button
                  className="finding-action"
                  onClick={() => onExplore(f.target)}
                >
                  Explore this <Icon name="arrow" size={18} />
                </button>
              </article>
            ))}
          </div>
          <div className="overview-bottom">
            <Panel
              label="03 / Keep showing up"
              title="Your weekly rhythm"
              action={
                <span className="tag">{number(current.sessions)} sessions</span>
              }
            >
              <div className="rhythm-bars">
                {visibleWeeks.map((w) => (
                  <button
                    key={w.start}
                    className="rhythm-column"
                    onClick={() =>
                      onExplore({ mode: "patterns", weekStart: w.start })
                    }
                    aria-label={`Week of ${w.label}: ${w.sessions} sessions${w.partial ? ", partial week" : ""}`}
                  >
                    <span className="rhythm-count">{w.sessions}</span>
                    <span
                      className={`rhythm-bar ${w.partial ? "partial" : ""}`}
                      style={{
                        height: `${12 + (w.sessions / Math.max(1, ...weeks.map((x) => x.sessions))) * 70}%`,
                      }}
                    />
                    <span className="small">{w.label}</span>
                  </button>
                ))}
              </div>
              <p className="small muted">
                {weeks.length > 12 ? "Showing the latest 12 weeks. " : ""}
                Outlined bars are partial weeks in this date range.
              </p>
            </Panel>
            {latest && (
              <Panel
                label="04 / Last in the log"
                title="The latest session"
                className="latest-panel"
              >
                <div className="latest-date">
                  {displayDay(localDay(latest.startTime, context.timezone), {
                    day: "numeric",
                  })}
                  <span>
                    {displayDay(localDay(latest.startTime, context.timezone), {
                      month: "short",
                    })}
                  </span>
                </div>
                <h3>{latest.title}</h3>
                <p className="muted">
                  {latest.exercises.length} exercises{" "}
                  <span className="separator">/</span>{" "}
                  {Math.round(latest.durationSeconds / 60)} minutes
                </p>
                <button
                  className="button primary"
                  onClick={() => onWorkout(latest.id)}
                >
                  Open session <Icon name="arrow" size={18} />
                </button>
              </Panel>
            )}
          </div>
        </>
      )}
      <Methods />
    </div>
  );
}
