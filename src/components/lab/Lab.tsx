import { useEffect, useMemo } from "react";
import type { Dataset } from "../../data/types";
import { addDays, displayDay } from "../../data/calendar";
import {
  availableScenarioWeeks,
  duplicateScenarioSession,
  duplicateScenarioSet,
  editScenarioSet,
  isEditableScenarioSet,
  removeScenarioSession,
  removeScenarioSet,
  scenarioResult,
  seedScenario,
} from "../../data/scenario";
import type { ScenarioDraft } from "../../data/scenario";
import { KG_TO_LB } from "../../data/metrics";
import {
  Empty,
  Methods,
  number,
  Panel,
  pretty,
  signed,
  useFormat,
} from "./shared";
import { Icon } from "./Icons";

export default function Lab({
  dataset,
  timezone,
  now,
  draft,
  onDraft,
  onWorkout,
}: {
  dataset: Dataset;
  timezone: string;
  now: string;
  draft: ScenarioDraft | null;
  onDraft: (draft: ScenarioDraft) => void;
  onWorkout: (id: string) => void;
}) {
  const weeks = useMemo(
    () => availableScenarioWeeks(dataset, now, timezone),
    [dataset, now, timezone],
  );
  useEffect(() => {
    if (!draft && weeks[0]) onDraft(seedScenario(dataset, weeks[0], timezone));
  }, [draft, weeks, dataset, timezone, onDraft]);
  const result = useMemo(
    () => (draft ? scenarioResult(dataset, draft, timezone) : null),
    [dataset, draft, timezone],
  );
  const fmt = useFormat(),
    factor = fmt.unit === "lb" ? KG_TO_LB : 1;
  const reset = (week = draft?.weekStart ?? weeks[0]) => {
    if (week) onDraft(seedScenario(dataset, week, timezone));
  };
  return (
    <div className="view-enter">
      <div className="view-title">
        <p className="eyebrow">Change the inputs. See the difference.</p>
        <h1>Your week. Reimagined.</h1>
        <p className="view-intro">
          Try a different shape for your training. Start with a completed week,
          make a few changes, and see exactly what they add up to.
        </p>
      </div>
      <div className="lab-banner">
        <Icon name="lab" />
        <div>
          <strong>A space to experiment</strong>
          <span>
            Hypothetical workload · kept only until you lock or close this page
          </span>
        </div>
        <span className="tag">Source history stays intact</span>
      </div>
      {!draft || !result ? (
        <Empty title="Start with a completed week.">
          Your first scenario becomes available after a week of workouts is
          complete.
        </Empty>
      ) : (
        <>
          <div className="lab-toolbar">
            <label>
              Copy a completed week
              <select
                value={draft.weekStart}
                onChange={(e) => reset(e.target.value)}
              >
                {[...new Set([draft.weekStart, ...weeks])]
                  .sort()
                  .reverse()
                  .map((w) => (
                    <option key={w} value={w}>
                      {displayDay(w)} – {displayDay(addDays(w, 6))}
                    </option>
                  ))}
              </select>
            </label>
            <button className="button" onClick={() => reset()}>
              <Icon name="refresh" size={16} />
              Reset to source week
            </button>
          </div>
          {result.stale ? (
            <div className="status-banner" role="status">
              The source snapshot or timezone changed. Reset this draft to
              calculate against the current data.{" "}
              <button className="button" onClick={() => reset()}>
                Reset draft
              </button>
            </div>
          ) : (
            <div className="scenario-layout">
              <div className="scenario-editor">
                <div className="week-strip">
                  {Array.from({ length: 7 }, (_, i) => {
                    const day = addDays(draft.weekStart, i);
                    const count = draft.sessions.filter(
                      (s) => s.day === day,
                    ).length;
                    return (
                      <div className={count ? "occupied" : ""} key={day}>
                        <span>{displayDay(day, { weekday: "short" })}</span>
                        <strong>{displayDay(day, { day: "numeric" })}</strong>
                        <small>
                          {count
                            ? count + " session" + (count > 1 ? "s" : "")
                            : "Rest"}
                        </small>
                      </div>
                    );
                  })}
                </div>
                {draft.sessions.length === 0 && (
                  <Empty title="An open week.">
                    Add a session from the source week below to keep
                    experimenting.
                  </Empty>
                )}
                {[...draft.sessions]
                  .sort((a, b) => a.day.localeCompare(b.day))
                  .map((session, index) => (
                    <details
                      className="scenario-session"
                      key={session.id}
                      open={index === 0 ? true : undefined}
                    >
                      <summary>
                        <span className="session-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong>{session.workout.title}</strong>
                          <small>
                            {displayDay(session.day, {
                              weekday: "long",
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            · {session.workout.exercises.length} exercises
                          </small>
                        </span>
                        <Icon name="chevron" size={18} />
                      </summary>
                      <div className="scenario-session-body">
                        <div className="scenario-actions">
                          <label>
                            Training day
                            <select
                              aria-label={
                                session.workout.title + " training day"
                              }
                              value={session.day}
                              onChange={(e) =>
                                onDraft({
                                  ...draft,
                                  sessions: draft.sessions.map((s) =>
                                    s.id === session.id
                                      ? { ...s, day: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            >
                              {Array.from({ length: 7 }, (_, i) =>
                                addDays(draft.weekStart, i),
                              ).map((day) => (
                                <option key={day} value={day}>
                                  {displayDay(day, { weekday: "long" })}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="button compact"
                            onClick={() =>
                              onDraft(
                                duplicateScenarioSession(
                                  draft,
                                  session.id,
                                  crypto.randomUUID(),
                                ),
                              )
                            }
                          >
                            <Icon name="plus" size={15} />
                            Copy session
                          </button>
                          <button
                            className="text-button"
                            onClick={() => onWorkout(session.sourceWorkoutId)}
                          >
                            View source
                          </button>
                          <button
                            className="text-button danger"
                            onClick={() =>
                              onDraft(removeScenarioSession(draft, session.id))
                            }
                          >
                            Remove session
                          </button>
                        </div>
                        {session.workout.exercises.map((exercise) => (
                          <section
                            className="scenario-exercise"
                            key={exercise.index}
                          >
                            <h3>{exercise.title}</h3>
                            <div className="scenario-set-labels">
                              <span>Set</span>
                              <span>Load ({fmt.unit})</span>
                              <span>Reps</span>
                              <span>Adjust</span>
                            </div>
                            {exercise.sets.map((set, i) => {
                              const editable =
                                draft.editableTemplateIds.includes(
                                  exercise.templateId,
                                ) &&
                                isEditableScenarioSet(
                                  set,
                                  dataset.templates[exercise.templateId],
                                );
                              return (
                                <div
                                  className={
                                    "scenario-set " +
                                    (!editable ? "preserved" : "")
                                  }
                                  key={set.index}
                                >
                                  <span>
                                    {i + 1}
                                    <small>
                                      {set.type === "warmup"
                                        ? "Warmup"
                                        : !editable
                                          ? "Preserved"
                                          : ""}
                                    </small>
                                  </span>
                                  {editable ? (
                                    <>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        aria-label={
                                          exercise.title +
                                          " set " +
                                          (i + 1) +
                                          " load in " +
                                          fmt.unit
                                        }
                                        value={
                                          Math.round(
                                            set.weightKg! * factor * 1000,
                                          ) / 1000
                                        }
                                        onChange={(e) => {
                                          if (e.target.value !== "")
                                            onDraft(
                                              editScenarioSet(
                                                draft,
                                                session.id,
                                                exercise.index,
                                                set.index,
                                                {
                                                  weightKg:
                                                    Number(e.target.value) /
                                                    factor,
                                                },
                                              ),
                                            );
                                        }}
                                      />
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        aria-label={
                                          exercise.title +
                                          " set " +
                                          (i + 1) +
                                          " reps"
                                        }
                                        value={set.reps!}
                                        onChange={(e) => {
                                          if (e.target.value !== "")
                                            onDraft(
                                              editScenarioSet(
                                                draft,
                                                session.id,
                                                exercise.index,
                                                set.index,
                                                {
                                                  reps: Number(e.target.value),
                                                },
                                              ),
                                            );
                                        }}
                                      />
                                      <div className="set-actions">
                                        <button
                                          className="icon-button"
                                          aria-label={
                                            "Copy " +
                                            exercise.title +
                                            " set " +
                                            (i + 1)
                                          }
                                          onClick={() =>
                                            onDraft(
                                              duplicateScenarioSet(
                                                draft,
                                                session.id,
                                                exercise.index,
                                                set.index,
                                              ),
                                            )
                                          }
                                        >
                                          <Icon name="plus" size={16} />
                                        </button>
                                        <button
                                          className="icon-button"
                                          aria-label={
                                            "Remove " +
                                            exercise.title +
                                            " set " +
                                            (i + 1)
                                          }
                                          onClick={() =>
                                            onDraft(
                                              removeScenarioSet(
                                                draft,
                                                session.id,
                                                exercise.index,
                                                set.index,
                                              ),
                                            )
                                          }
                                        >
                                          <Icon name="minus" size={16} />
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span>
                                        {set.weightKg == null
                                          ? "—"
                                          : number(set.weightKg * factor, 1)}
                                      </span>
                                      <span>{set.reps ?? "—"}</span>
                                      <span className="preserved-value">
                                        {set.durationSeconds != null
                                          ? set.durationSeconds + "s"
                                          : set.distanceMeters != null
                                            ? set.distanceMeters + "m"
                                            : "Fixed"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </section>
                        ))}
                      </div>
                    </details>
                  ))}
                <label className="add-session">
                  Add a session from the source week
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const source = seedScenario(
                        dataset,
                        draft.weekStart,
                        timezone,
                      ).sessions.find(
                        (s) => s.sourceWorkoutId === e.target.value,
                      );
                      if (source)
                        onDraft({
                          ...draft,
                          sessions: [
                            ...draft.sessions,
                            { ...source, id: crypto.randomUUID() },
                          ],
                        });
                    }}
                  >
                    <option value="">Choose a session to copy…</option>
                    {seedScenario(
                      dataset,
                      draft.weekStart,
                      timezone,
                    ).sessions.map((s) => (
                      <option key={s.id} value={s.sourceWorkoutId}>
                        {s.workout.title} · {displayDay(s.day)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <aside className="scenario-results">
                <Panel
                  label="Calculated from your edits"
                  title="The difference"
                >
                  <div className="result-legend">
                    <span>Source week</span>
                    <Icon name="arrow" size={15} />
                    <span>Scenario</span>
                  </div>
                  {(["sessions", "sets", "reps", "volume"] as const).map(
                    (key) => (
                      <div className="scenario-result" key={key}>
                        <span>
                          {key === "sets"
                            ? "Working sets"
                            : key === "volume"
                              ? "Load volume"
                              : pretty(key)}
                        </span>
                        <div>
                          <span>
                            {key === "volume"
                              ? fmt.weight(result.baseline[key], 0)
                              : number(result.baseline[key])}
                          </span>
                          <Icon name="arrow" size={16} />
                          <strong>
                            {key === "volume"
                              ? fmt.weight(result.scenario[key], 0)
                              : number(result.scenario[key])}
                          </strong>
                        </div>
                        <small>
                          {key === "volume"
                            ? (result.delta[key] > 0 ? "+" : "") +
                              fmt.weight(result.delta[key], 0)
                            : signed(result.delta[key])}{" "}
                          {result.percent[key] == null
                            ? "· no baseline"
                            : "· " + signed(result.percent[key]!, 1) + "%"}
                        </small>
                      </div>
                    ),
                  )}
                  <div className="time-estimate">
                    <p className="eyebrow">Rough time estimate</p>
                    <strong>
                      {result.timeEstimate.seconds == null
                        ? "More history needed"
                        : number(result.timeEstimate.seconds / 60) + " min"}
                    </strong>
                    {result.timeEstimate.seconds != null ? (
                      <p>
                        Observed rate range:{" "}
                        {number(result.timeEstimate.minSeconds! / 60)}–
                        {number(result.timeEstimate.maxSeconds! / 60)} min.
                        Based on {result.timeEstimate.samples} distinct
                        comparable sessions.
                      </p>
                    ) : (
                      <p>
                        At least 3 comparable sessions per routine and exercise
                        order are needed. {result.timeEstimate.coveredSessions}{" "}
                        of {result.timeEstimate.totalSessions} scenario sessions
                        have enough history.
                      </p>
                    )}
                  </div>
                </Panel>
                <Panel
                  label="Working sets by primary muscle"
                  title="Where the work goes"
                >
                  <div className="muscle-deltas">
                    {[
                      ...new Set([
                        ...Object.keys(result.baselineMuscles),
                        ...Object.keys(result.scenarioMuscles),
                      ]),
                    ]
                      .sort()
                      .map((m) => (
                        <div key={m}>
                          <span>{pretty(m)}</span>
                          <span>
                            {result.baselineMuscles[m] ?? 0} →{" "}
                            <strong>{result.scenarioMuscles[m] ?? 0}</strong>
                          </span>
                        </div>
                      ))}
                  </div>
                </Panel>
              </aside>
            </div>
          )}
          <Methods>
            <p>
              Sessions, working sets, repetitions and load volume are exact
              arithmetic from your copied week. Warmups, assisted, bodyweight,
              duration and distance entries are preserved. Only working sets for
              known external-resistance exercises can be edited.
            </p>
            <p>
              Time scales the median recorded seconds per logged set for the
              same routine and ordered exercise list. It includes warmups. The
              displayed range uses the lowest and highest historical rates; it
              is not a prediction interval. Rest times and exercise changes can
              make actual duration different.
            </p>
            <p>
              This models workload. It does not predict strength, recovery,
              muscle growth or injury risk. Drafts remain in memory and never
              change your Hevy workouts.
            </p>
          </Methods>
        </>
      )}
    </div>
  );
}
