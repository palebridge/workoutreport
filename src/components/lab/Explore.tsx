import { Fragment, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset, DatasetWorkout } from "../../data/types";
import type { AnalysisContext } from "../../data/calendar";
import { displayDay, localDay } from "../../data/calendar";
import {
  compareSessions,
  exerciseSeries,
  included,
  median,
  METRICS,
  percentChange,
  routineKey,
  scopedWorkouts,
  totals,
} from "../../data/analysis";
import type { Finding, Metric } from "../../data/analysis";
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
import Patterns from "./Patterns";
import { markerPoints } from "./Atlas";

export default function Explore({
  dataset,
  context,
  selection,
  onSelect,
  onWorkout,
}: {
  dataset: Dataset;
  context: AnalysisContext;
  selection: Finding["target"];
  onSelect: (target: Finding["target"]) => void;
  onWorkout: (id: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [muscle, setMuscle] = useState(""),
    [equipment, setEquipment] = useState(""),
    [metric, setMetric] = useState<Metric | undefined>(undefined);
  const series = useMemo(
    () => exerciseSeries(dataset, context, metric),
    [dataset, context, metric],
  );
  const filtered = series.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) &&
      (!muscle || s.muscle === muscle) &&
      (!equipment || s.equipment === equipment),
  );
  const selected =
    filtered.find((s) => s.id === selection.exerciseId) ?? filtered[0];
  const fmt = useFormat();
  const previous = useMemo(
    () =>
      context.comparison && selected
        ? exerciseSeries(
            dataset,
            context,
            selected.metric,
            context.comparison,
          ).find((s) => s.id === selected.id)
        : undefined,
    [dataset, context, selected?.id, selected?.metric],
  );
  const values =
    selected?.points.flatMap((p) => (p.value == null ? [] : [p.value])) ?? [];
  const beforeValues =
    previous?.points.flatMap((p) => (p.value == null ? [] : [p.value])) ?? [];
  const change =
    values.length >= 3 && beforeValues.length >= 3
      ? percentChange(median(values)!, median(beforeValues)!)
      : null;
  const chartPoints = useMemo(
    () =>
      selected?.points.map((p, i) => ({
        ...p,
        index: i,
        label: displayDay(p.date),
      })) ?? [],
    [selected],
  );
  const markerIds = useMemo(
    () =>
      new Set(
        markerPoints(selected?.points ?? []).map((point) => point.workoutId),
      ),
    [selected],
  );
  const [detailsOpen, setDetailsOpen] = useState(false),
    [detailsPage, setDetailsPage] = useState(0);
  useEffect(
    () => setDetailsPage(0),
    [selected?.id, selected?.metric, selected?.points],
  );
  const detailCount = selected?.points.length ?? 0,
    safeDetailsPage = Math.min(
      detailsPage,
      Math.max(0, Math.ceil(detailCount / 50) - 1),
    );
  const detailRows =
    detailsOpen && selected
      ? [...selected.points]
          .reverse()
          .slice(safeDetailsPage * 50, safeDetailsPage * 50 + 50)
      : [];
  const mode = selection.mode;
  return (
    <div className="view-enter">
      <div className="view-title">
        <p className="eyebrow">The detail behind the progress</p>
        <h1>Take a closer look.</h1>
      </div>
      <div className="view-tabs" role="group" aria-label="Explore modes">
        {(["lifts", "sessions", "patterns"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            onClick={() => onSelect({ ...selection, mode: m })}
          >
            {pretty(m)}
            <Icon
              name={
                m === "lifts"
                  ? "explore"
                  : m === "sessions"
                    ? "overview"
                    : "journey"
              }
              size={16}
            />
          </button>
        ))}
      </div>
      {mode === "lifts" && (
        <div className="explore-layout">
          <aside className="exercise-picker">
            <label className="search-field">
              <Icon name="explore" size={17} />
              <input
                aria-label="Search exercises"
                placeholder="Find an exercise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="picker-filters">
              <select
                aria-label="Filter by muscle"
                value={muscle}
                onChange={(e) => setMuscle(e.target.value)}
              >
                <option value="">All muscles</option>
                {[...new Set(series.map((s) => s.muscle))].sort().map((m) => (
                  <option key={m} value={m}>
                    {pretty(m)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">All equipment</option>
                {[...new Set(series.map((s) => s.equipment))]
                  .sort()
                  .map((m) => (
                    <option key={m} value={m}>
                      {pretty(m)}
                    </option>
                  ))}
              </select>
            </div>
            <p className="eyebrow picker-count">
              {filtered.length} exercises in view
            </p>
            <div className="exercise-list">
              {[...filtered]
                .sort(
                  (a, b) =>
                    Date.parse(b.lastPerformed) - Date.parse(a.lastPerformed),
                )
                .map((s) => (
                  <button
                    key={s.id}
                    aria-pressed={selected?.id === s.id}
                    onClick={() => {
                      setMetric(undefined);
                      onSelect({ mode: "lifts", exerciseId: s.id });
                    }}
                  >
                    <strong>{s.title}</strong>
                    <span>
                      {pretty(s.muscle)} · {s.sessions} sessions
                    </span>
                  </button>
                ))}
            </div>
          </aside>
          <div className="explore-detail">
            {selected ? (
              <>
                <Panel
                  label={`${pretty(selected.muscle)} / ${pretty(selected.equipment)}`}
                  title={selected.title}
                  action={
                    <span className="tag">{selected.sessions} sessions</span>
                  }
                >
                  <div
                    className="metric-options"
                    role="group"
                    aria-label="Progression metric"
                  >
                    {selected.metrics.map((m) => (
                      <button
                        key={m}
                        aria-pressed={selected.metric === m}
                        onClick={() => setMetric(m)}
                      >
                        {METRICS[m].label}
                      </button>
                    ))}
                  </div>
                  <div className="lift-summary">
                    <div>
                      <span className="eyebrow">Latest</span>
                      <strong>
                        {fmt.metric(
                          selected.points.at(-1)?.value ?? null,
                          selected.metric,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span className="eyebrow">Period median</span>
                      <strong>
                        {fmt.metric(median(values), selected.metric)}
                      </strong>
                    </div>
                    <div>
                      <span className="eyebrow">Previous median</span>
                      <strong>
                        {fmt.metric(median(beforeValues), selected.metric)}
                      </strong>
                      {change != null && (
                        <small className="accent">
                          {signed(change, 1)}% · {values.length} vs{" "}
                          {beforeValues.length} samples
                        </small>
                      )}
                    </div>
                  </div>
                  {values.length ? (
                    <div className="progress-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartPoints}
                          margin={{ top: 18, right: 26, left: 0, bottom: 15 }}
                        >
                          <CartesianGrid
                            stroke="#30372f"
                            strokeDasharray="2 5"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="index"
                            tickFormatter={(i) => chartPoints[i]?.label ?? ""}
                            tick={{ fill: "#979e95", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={40}
                          />
                          <YAxis
                            tick={{ fill: "#979e95", fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            width={75}
                            tickFormatter={(v) =>
                              number(
                                METRICS[selected.metric].unit === "kg" &&
                                  fmt.unit === "lb"
                                  ? v * 2.2046226218
                                  : v,
                                0,
                              )
                            }
                            domain={["auto", "auto"]}
                          />
                          <Tooltip
                            content={({ active, payload }) =>
                              active && payload?.length ? (
                                <div className="chart-tooltip">
                                  <strong>{payload[0].payload.label}</strong>
                                  <span>
                                    {fmt.metric(
                                      payload[0].payload.value,
                                      selected.metric,
                                    )}
                                  </span>
                                  <small>
                                    {payload[0].payload.isRecord
                                      ? "New estimated-strength record"
                                      : "Open exact sets in the session table below"}
                                  </small>
                                </div>
                              ) : null
                            }
                          />
                          <Line
                            type="linear"
                            dataKey="value"
                            stroke="#d4f77d"
                            strokeWidth={2}
                            isAnimationActive={false}
                            connectNulls={false}
                            activeDot={false}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (
                                payload.value == null ||
                                !markerIds.has(payload.workoutId)
                              )
                                return <Fragment key={payload.workoutId} />;
                              return (
                                <g
                                  key={payload.workoutId}
                                  tabIndex={0}
                                  role="button"
                                  aria-label={`${selected.title}, ${payload.label}, ${fmt.metric(payload.value, selected.metric)}. Open workout.`}
                                  onClick={() => onWorkout(payload.workoutId)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      onWorkout(payload.workoutId);
                                    }
                                  }}
                                >
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={16}
                                    fill="transparent"
                                  />
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={payload.isRecord ? 5 : 4}
                                    fill={
                                      payload.isRecord ? "#ebba69" : "#171a18"
                                    }
                                    stroke="#d4f77d"
                                    strokeWidth={2}
                                  />
                                </g>
                              );
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <Empty title="No eligible values in this period.">
                      Choose another metric or widen the date range.
                    </Empty>
                  )}
                  <p className="chart-note">
                    {METRICS[selected.metric].label} per session ·{" "}
                    {METRICS[selected.metric].unit === "kg"
                      ? fmt.unit
                      : METRICS[selected.metric].unit}
                    .{" "}
                    {selected.metric === "e1rm"
                      ? "Amber points mark verified improvements over an earlier record."
                      : "Changes describe the recorded metric, not necessarily improved performance."}
                  </p>
                  {values.length > 40 && (
                    <p className="chart-note">
                      The line includes every observation. Interactive markers
                      show 40 evenly spaced sessions plus endpoints and
                      extremes. Every exact value remains in the session table.
                    </p>
                  )}
                </Panel>
                <Panel label="Every point has a source" title="Session details">
                  <details
                    className="table-alternative"
                    open={detailsOpen}
                    onToggle={(event) =>
                      setDetailsOpen(event.currentTarget.open)
                    }
                  >
                    <summary>View every logged session</summary>
                    {detailsOpen && (
                      <>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>{METRICS[selected.metric].label}</th>
                                <th>Sets</th>
                                <th>Median RPE</th>
                                <th>Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailRows.map((p) => (
                                <tr key={p.workoutId}>
                                  <th>{displayDay(p.date)}</th>
                                  <td>
                                    {fmt.metric(p.value, selected.metric)}{" "}
                                    {p.isRecord && (
                                      <span className="record-label">PR</span>
                                    )}
                                  </td>
                                  <td>{p.sets}</td>
                                  <td>{p.rpe ?? "—"}</td>
                                  <td>
                                    <button
                                      className="text-button"
                                      onClick={() => onWorkout(p.workoutId)}
                                    >
                                      Open sets <Icon name="arrow" size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Pager
                          page={safeDetailsPage}
                          total={detailCount}
                          onPage={setDetailsPage}
                          label="Session details"
                        />
                      </>
                    )}
                  </details>
                  <p className="chart-note">
                    RPE is the median of recorded ratings only.{" "}
                    {selected.points.filter((p) => p.rpe != null).length} of{" "}
                    {selected.points.length} sessions include a rating.
                  </p>
                </Panel>
              </>
            ) : (
              <Empty title="No matching exercises.">
                Clear the filters or select a wider date range.
              </Empty>
            )}
          </div>
        </div>
      )}
      {mode === "sessions" && (
        <SessionExplorer
          dataset={dataset}
          context={context}
          onWorkout={onWorkout}
          initialWorkoutId={selection.workoutId}
        />
      )}
      {mode === "patterns" && (
        <Patterns
          dataset={dataset}
          context={context}
          onWorkout={onWorkout}
          initialWeek={selection.weekStart}
        />
      )}
      <Methods />
    </div>
  );
}

export function SessionList({
  workouts,
  context,
  onWorkout,
  onCompare,
}: {
  workouts: DatasetWorkout[];
  context: AnalysisContext;
  onWorkout: (id: string) => void;
  onCompare?: (id: string) => void;
}) {
  const fmt = useFormat(),
    [page, setPage] = useState(0);
  useEffect(() => setPage(0), [workouts]);
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(workouts.length / 50) - 1),
  );
  return (
    <>
      <div className="session-list">
        {[...workouts]
          .reverse()
          .slice(safePage * 50, safePage * 50 + 50)
          .map((w) => (
            <div className="session-row" key={w.id}>
              <div className="session-date">
                <strong>
                  {displayDay(localDay(w.startTime, context.timezone), {
                    day: "numeric",
                  })}
                </strong>
                <span>
                  {displayDay(localDay(w.startTime, context.timezone), {
                    month: "short",
                  })}
                </span>
              </div>
              <button className="session-name" onClick={() => onWorkout(w.id)}>
                <strong>{w.title}</strong>
                <small>
                  {w.exercises.length} exercises ·{" "}
                  {Math.round(w.durationSeconds / 60)} min logged
                </small>
              </button>
              <span className="session-volume">
                {fmt.weight(totals([w], context.includeWarmups).volume, 0)}
              </span>
              {onCompare && (
                <button
                  className="button compact"
                  onClick={() => onCompare(w.id)}
                >
                  Compare
                </button>
              )}
              <button
                className="icon-button"
                aria-label={`Open ${w.title} on ${localDay(w.startTime, context.timezone)}`}
                onClick={() => onWorkout(w.id)}
              >
                <Icon name="arrow" size={17} />
              </button>
            </div>
          ))}
      </div>
      <Pager
        page={safePage}
        total={workouts.length}
        onPage={setPage}
        label="Workout log"
      />
    </>
  );
}

function Pager({
  page,
  total,
  onPage,
  label,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (total <= 50) return null;
  return (
    <div className="atlas-toolbar" aria-label={label + " pages"}>
      <button
        className="button compact"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="small muted" aria-live="polite">
        {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}
      </span>
      <button
        className="button compact"
        disabled={(page + 1) * 50 >= total}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
function topLoads(
  workout: DatasetWorkout | undefined,
  includeWarmups: boolean,
): Map<string, number | null> {
  const loads = new Map<string, number | null>(),
    occurrences = new Map<string, number>();
  for (const exercise of workout?.exercises ?? []) {
    const occurrence = occurrences.get(exercise.templateId) ?? 0;
    occurrences.set(exercise.templateId, occurrence + 1);
    const values = exercise.sets
      .filter((set) => included(set, includeWarmups) && set.weightKg != null)
      .map((set) => set.weightKg!);
    loads.set(
      `${exercise.templateId}:${occurrence}`,
      values.length ? Math.max(...values) : null,
    );
  }
  return loads;
}

function SessionExplorer({
  dataset,
  context,
  onWorkout,
  initialWorkoutId,
}: {
  dataset: Dataset;
  context: AnalysisContext;
  onWorkout: (id: string) => void;
  initialWorkoutId?: string;
}) {
  const [query, setQuery] = useState(""),
    [selectedId, setSelectedId] = useState(initialWorkoutId ?? ""),
    [comparisonId, setComparisonId] = useState("");
  useEffect(() => {
    setSelectedId(initialWorkoutId ?? "");
    setComparisonId("");
  }, [initialWorkoutId]);
  const workouts = useMemo(
    () =>
      scopedWorkouts(dataset, context).filter((w) =>
        w.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [dataset, context, query],
  );
  const selected =
    dataset.workouts.find((w) => w.id === selectedId) ?? workouts.at(-1);
  const previous = selected
    ? dataset.workouts
        .filter(
          (w) =>
            w.id !== selected.id &&
            Date.parse(w.startTime) <= Date.parse(selected.startTime) &&
            routineKey(w) === routineKey(selected),
        )
        .at(-1)
    : undefined;
  const comparison =
    dataset.workouts.find(
      (w) => w.id === comparisonId && w.id !== selected?.id,
    ) ?? previous;
  const comparisonLoads = topLoads(comparison, context.includeWarmups),
    selectedLoads = topLoads(selected, context.includeWarmups);
  const comparisonVolume =
    selected && comparison
      ? totals([comparison, selected], context.includeWarmups).volume
      : 0;
  const fmt = useFormat();
  return (
    <>
      <Panel
        label="Spot the differences"
        title="Two sessions. One closer look."
      >
        <div className="comparison-selectors">
          <label>
            Comparison session
            <select
              value={comparison?.id ?? ""}
              onChange={(e) => setComparisonId(e.target.value)}
            >
              <option value="">Choose a session</option>
              {[...dataset.workouts]
                .reverse()
                .filter((w) => w.id !== selected?.id)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {displayDay(localDay(w.startTime, context.timezone))} ·{" "}
                    {w.title}
                  </option>
                ))}
            </select>
          </label>
          <Icon name="arrow" />
          <label>
            Selected session
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setComparisonId("");
              }}
            >
              <option value="">Choose a session</option>
              {[...dataset.workouts].reverse().map((w) => (
                <option key={w.id} value={w.id}>
                  {displayDay(localDay(w.startTime, context.timezone))} ·{" "}
                  {w.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selected && comparison ? (
          <>
            <div className="comparison-summary">
              <button
                className="text-button"
                onClick={() => onWorkout(comparison.id)}
              >
                Open comparison sets
              </button>
              <span>
                {Math.round(comparison.durationSeconds / 60)} →{" "}
                {Math.round(selected.durationSeconds / 60)} min logged
              </span>
              <button
                className="text-button"
                onClick={() => onWorkout(selected.id)}
              >
                Open selected sets
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Match</th>
                    <th>Sets</th>
                    <th>Total reps</th>
                    <th>Top recorded load</th>
                    <th>Volume change</th>
                  </tr>
                </thead>
                <tbody>
                  {compareSessions(
                    comparison,
                    selected,
                    context.includeWarmups,
                  ).map((row) => (
                    <tr key={row.key}>
                      <th>{row.title}</th>
                      <td>{row.status}</td>
                      <td>
                        {row.before.sets} → {row.after.sets}
                      </td>
                      <td>
                        {row.before.reps} → {row.after.reps}
                      </td>
                      <td>
                        {comparisonLoads.get(row.key) == null
                          ? "—"
                          : fmt.weight(comparisonLoads.get(row.key)!)}{" "}
                        →{" "}
                        {selectedLoads.get(row.key) == null
                          ? "—"
                          : fmt.weight(selectedLoads.get(row.key)!)}
                      </td>
                      <td>
                        <div className="contribution">
                          <span>
                            {row.delta > 0 ? "+" : ""}
                            {fmt.weight(row.delta, 0)}
                          </span>
                          <i
                            className={row.delta < 0 ? "negative" : ""}
                            style={{
                              width: Math.min(
                                90,
                                (Math.abs(row.delta) /
                                  Math.max(1, comparisonVolume)) *
                                  220,
                              ),
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="chart-note">
              Matching uses exercise identity and occurrence. Added sets and
              exercise changes contribute to volume; they do not establish a
              strength gain. Both sessions may be outside the current date
              range; choose either direction deliberately. Dashes indicate no
              recorded load.
            </p>
          </>
        ) : (
          <Empty title="A comparison starts with two sessions.">
            Select a second recorded session, or return after your next workout.
          </Empty>
        )}
      </Panel>
      <Panel
        label="Your recorded history"
        title="Workout log"
        action={<span className="tag">{workouts.length} sessions</span>}
      >
        <label className="search-field session-search">
          <Icon name="explore" size={17} />
          <input
            aria-label="Search workouts"
            placeholder="Search your sessions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {workouts.length ? (
          <SessionList
            workouts={workouts}
            context={context}
            onWorkout={onWorkout}
            onCompare={(id) => {
              setSelectedId(id);
              setComparisonId("");
            }}
          />
        ) : (
          <Empty title="No sessions match this view." />
        )}
      </Panel>
    </>
  );
}
