import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "../../data/types";
import type { AnalysisContext } from "../../data/calendar";
import {
  addDays,
  daysBetween,
  displayDay,
  localDay,
  weekStart,
} from "../../data/calendar";
import {
  muscleDistribution,
  routineKey,
  scopedWorkouts,
  totals,
  weeklyBuckets,
} from "../../data/analysis";
import { Empty, number, Panel, pretty, useFormat } from "./shared";
import { Icon } from "./Icons";

export default function Patterns({
  dataset,
  context,
  onWorkout,
  initialWeek,
}: {
  dataset: Dataset;
  context: AnalysisContext;
  onWorkout: (id: string) => void;
  initialWeek?: string;
}) {
  const [muscle, setMuscle] = useState<string | null>(null),
    [week, setWeek] = useState<string | null>(initialWeek ?? null),
    [day, setDay] = useState<string | null>(null),
    [routine, setRoutine] = useState<string | null>(null),
    [trend, setTrend] = useState<"volume" | "duration">("volume");
  useEffect(() => setWeek(initialWeek ?? null), [initialWeek]);
  const muscles = useMemo(
    () => muscleDistribution(dataset, context),
    [dataset, context],
  );
  const weeks = useMemo(
    () => weeklyBuckets(dataset, context),
    [dataset, context],
  );
  const workouts = useMemo(
    () => scopedWorkouts(dataset, context),
    [dataset, context],
  );
  const selected = useMemo(
    () =>
      workouts.filter(
        (w) =>
          (!muscle ||
            w.exercises.some(
              (e) =>
                dataset.templates[e.templateId]?.primaryMuscleGroup === muscle,
            )) &&
          (!week ||
            weekStart(localDay(w.startTime, context.timezone)) === week) &&
          (!day || localDay(w.startTime, context.timezone) === day) &&
          (!routine || routineKey(w) === routine),
      ),
    [workouts, muscle, week, day, routine, dataset.templates, context.timezone],
  );
  const fmt = useFormat();
  const maxCell = Math.max(
    1,
    ...muscles.rows.flatMap((m) => Object.values(m.weeks)),
  );
  const calendarStart =
    context.range.start > addDays(context.range.end, -181)
      ? context.range.start
      : addDays(context.range.end, -181);
  const calendarDays = daysBetween({
    start: weekStart(calendarStart),
    end: context.range.end,
  });
  const counts = new Map<string, number>();
  for (const w of workouts) {
    const d = localDay(w.startTime, context.timezone);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
    (label, index) => ({
      label,
      count: workouts.filter(
        (w) =>
          (new Date(
            `${localDay(w.startTime, context.timezone)}T12:00:00Z`,
          ).getUTCDay() +
            6) %
            7 ===
          index,
      ).length,
    }),
  );
  const routines = [...new Set(workouts.map(routineKey))]
    .map((key) => ({
      key,
      workouts: workouts.filter((w) => routineKey(w) === key),
    }))
    .sort((a, b) => b.workouts.length - a.workouts.length);
  const measurements = useMemo(
    () =>
      dataset.bodyMeasurements.filter((m) => {
        const day = bodyDay(m.date, context.timezone);
        return (
          day >= context.range.start &&
          day <= context.range.end &&
          (m.weightKg != null || m.fatPercent != null)
        );
      }),
    [dataset.bodyMeasurements, context.range, context.timezone],
  );
  const bodyStatus = dataset.sources?.bodyMeasurements.status ?? "unknown";
  const filters = muscle || week || day || routine;
  const [sessionPage, setSessionPage] = useState(0),
    [weekPage, setWeekPage] = useState(0),
    [bodyPage, setBodyPage] = useState(0),
    [routinePage, setRoutinePage] = useState(0);
  const [weeklyOpen, setWeeklyOpen] = useState(false),
    [bodyOpen, setBodyOpen] = useState(false),
    [matrixPage, setMatrixPage] = useState<number | null>(null);
  useEffect(() => setSessionPage(0), [selected]);
  useEffect(() => {
    setWeekPage(0);
    setBodyPage(0);
    setRoutinePage(0);
    setMatrixPage(null);
  }, [context.range.start, context.range.end, context.timezone]);
  const safeSessionPage = Math.min(
    sessionPage,
    Math.max(0, Math.ceil(selected.length / 50) - 1),
  );
  const safeWeekPage = Math.min(
    weekPage,
    Math.max(0, Math.ceil(weeks.length / 50) - 1),
  );
  const safeBodyPage = Math.min(
    bodyPage,
    Math.max(0, Math.ceil(measurements.length / 50) - 1),
  );
  const safeRoutinePage = Math.min(
    routinePage,
    Math.max(0, Math.ceil(routines.length / 50) - 1),
  );
  const matrixPages = Math.max(1, Math.ceil(weeks.length / 12)),
    matrixIndex = Math.min(matrixPage ?? matrixPages - 1, matrixPages - 1);
  const matrixWeeks = weeks.slice(matrixIndex * 12, matrixIndex * 12 + 12);
  return (
    <>
      <Panel
        label="Where the work goes"
        title="Training distribution"
        action={
          <span className="tag">
            {muscles.classified}/{muscles.total} sets classified
          </span>
        }
      >
        <p className="chart-note top-note">
          Primary-muscle working sets by week. Select a cell to find the
          sessions behind it. Matrix totals cover the entire selected period;
          warmups affect session totals and workload charts only.
        </p>
        {muscles.rows.length ? (
          <div className="table-scroll muscle-matrix">
            <table>
              <thead>
                <tr>
                  <th>Muscle group</th>
                  {matrixWeeks.map((w) => (
                    <th key={w.start}>
                      <button
                        onClick={() => {
                          setWeek(week === w.start ? null : w.start);
                          setDay(null);
                        }}
                        aria-pressed={week === w.start}
                      >
                        {w.label}
                        {w.partial ? " *" : ""}
                      </button>
                    </th>
                  ))}
                  <th>Primary</th>
                  <th>Secondary</th>
                </tr>
              </thead>
              <tbody>
                {muscles.rows.map((m) => (
                  <tr key={m.muscle}>
                    <th>
                      <button
                        className={muscle === m.muscle ? "accent" : ""}
                        onClick={() =>
                          setMuscle(muscle === m.muscle ? null : m.muscle)
                        }
                        aria-pressed={muscle === m.muscle}
                      >
                        {pretty(m.muscle)}
                      </button>
                    </th>
                    {matrixWeeks.map((w) => {
                      const count = m.weeks[w.start] ?? 0;
                      return (
                        <td key={w.start}>
                          <button
                            className="matrix-cell"
                            style={{
                              background: count
                                ? `rgba(212,247,125,${0.1 + (count / maxCell) * 0.65})`
                                : "#20251f",
                              color:
                                count > maxCell * 0.45 ? "#17200f" : "#b5c1ab",
                            }}
                            onClick={() => {
                              setMuscle(m.muscle);
                              setWeek(w.start);
                              setDay(null);
                            }}
                            aria-label={`${pretty(m.muscle)}, week of ${w.label}: ${count} primary working sets. Show sessions.`}
                          >
                            {count || "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td>{m.primary}</td>
                    <td className="muted">{m.secondary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Muscle metadata is not available.">
            Your recorded sessions are still available below.
          </Empty>
        )}
        {matrixPages > 1 && (
          <div className="atlas-toolbar" aria-label="Muscle matrix week pages">
            <button
              className="button compact"
              disabled={matrixIndex === 0}
              onClick={() => setMatrixPage(matrixIndex - 1)}
            >
              Earlier weeks
            </button>
            <span className="small muted" aria-live="polite">
              Weeks {matrixIndex * 12 + 1}–
              {Math.min((matrixIndex + 1) * 12, weeks.length)} of {weeks.length}
            </span>
            <button
              className="button compact"
              disabled={matrixIndex + 1 >= matrixPages}
              onClick={() => setMatrixPage(matrixIndex + 1)}
            >
              Later weeks
            </button>
          </div>
        )}
        <p className="chart-note">
          Secondary involvement is shown separately and can overlap. It is not
          added to primary set totals. * Partial week. Unclassified exercises
          are excluded from this matrix.
        </p>
      </Panel>
      {filters && (
        <div className="filter-chips" aria-label="Active pattern filters">
          {muscle && (
            <button onClick={() => setMuscle(null)}>
              {pretty(muscle)}
              <Icon name="close" size={14} />
            </button>
          )}
          {week && (
            <button onClick={() => setWeek(null)}>
              Week of {displayDay(week)}
              <Icon name="close" size={14} />
            </button>
          )}
          {day && (
            <button onClick={() => setDay(null)}>
              {displayDay(day)}
              <Icon name="close" size={14} />
            </button>
          )}
          {routine && (
            <button onClick={() => setRoutine(null)}>
              Selected routine
              <Icon name="close" size={14} />
            </button>
          )}
          <button
            className="text-button"
            onClick={() => {
              setMuscle(null);
              setWeek(null);
              setDay(null);
              setRoutine(null);
            }}
          >
            Clear all
          </button>
        </div>
      )}
      <Panel
        label="Follow the selected evidence"
        title={
          filters ? "Sessions in this selection" : "Sessions behind the pattern"
        }
        action={<span className="tag">{selected.length} sessions</span>}
      >
        {selected.length ? (
          <div className="pattern-sessions">
            {[...selected]
              .reverse()
              .slice(safeSessionPage * 50, safeSessionPage * 50 + 50)
              .map((w) => (
                <button
                  className="pattern-session"
                  key={w.id}
                  onClick={() => onWorkout(w.id)}
                >
                  <span>
                    <small>
                      {displayDay(localDay(w.startTime, context.timezone))}
                    </small>
                    <strong>{w.title}</strong>
                  </span>
                  <span>
                    {totals([w], context.includeWarmups).sets} sets{" "}
                    <Icon name="arrow" size={17} />
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <Empty title="No sessions match these filters.">
            Clear a filter to widen the selection.
          </Empty>
        )}
        <Pager
          page={safeSessionPage}
          total={selected.length}
          onPage={setSessionPage}
          label="Matching sessions"
        />
      </Panel>
      <Panel
        label="Consistency leaves a trace"
        title="Days you showed up"
        action={<span className="tag">{workouts.length} sessions</span>}
      >
        <div className="calendar-scroll">
          <div className="calendar-grid">
            {calendarDays.map((d) => {
              const count = counts.get(d) ?? 0;
              return (
                <button
                  key={d}
                  disabled={d < calendarStart}
                  className={`calendar-day ${count ? "trained" : ""} ${day === d ? "selected" : ""}`}
                  style={
                    count
                      ? { opacity: Math.min(1, 0.6 + count * 0.2) }
                      : undefined
                  }
                  aria-label={`${displayDay(d, { day: "numeric", month: "long", year: "numeric" })}: ${count} sessions`}
                  title={`${d} · ${count} sessions`}
                  onClick={() => {
                    setDay(day === d ? null : d);
                    setWeek(null);
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            {displayDay(calendarStart)} — {displayDay(context.range.end)}
          </span>
          <span>
            <i /> No session <i className="trained" /> Trained
          </span>
        </div>
        {calendarStart !== context.range.start && (
          <p className="chart-note">
            Showing the last 26 weeks of the selected range.
          </p>
        )}
      </Panel>
      <div className="pattern-grid">
        <Panel
          label="Recorded workload"
          title="Week by week"
          action={
            <select
              aria-label="Weekly trend metric"
              value={trend}
              onChange={(e) =>
                setTrend(e.target.value as "volume" | "duration")
              }
            >
              <option value="volume">Load volume</option>
              <option value="duration">Logged duration</option>
            </select>
          }
        >
          <div className="pattern-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={weeks.map((w) => ({
                  ...w,
                  value: trend === "volume" ? w.volume : w.duration / 60,
                }))}
                margin={{ top: 12, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="#30372f" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#979e95", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#979e95", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    number(
                      trend === "volume" && fmt.unit === "lb"
                        ? v * 2.2046226218
                        : v,
                      0,
                    )
                  }
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="chart-tooltip">
                        <strong>Week of {payload[0].payload.label}</strong>
                        <span>
                          {trend === "volume"
                            ? fmt.weight(payload[0].payload.value, 0)
                            : `${Math.round(payload[0].payload.value)} min`}
                        </span>
                        <small>
                          {payload[0].payload.partial
                            ? "Partial week"
                            : "Complete week"}
                        </small>
                      </div>
                    ) : null
                  }
                />
                <Area
                  dataKey="value"
                  type="linear"
                  stroke="#d4f77d"
                  fill="#d4f77d"
                  fillOpacity={0.09}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details
            className="table-alternative"
            open={weeklyOpen}
            onToggle={(event) => setWeeklyOpen(event.currentTarget.open)}
          >
            <summary>View weekly data</summary>
            {weeklyOpen && (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th>Sessions</th>
                        <th>Sets</th>
                        <th>Volume</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeks
                        .slice(safeWeekPage * 50, safeWeekPage * 50 + 50)
                        .map((w) => (
                          <tr key={w.start}>
                            <th>
                              {w.label}
                              {w.partial ? " *" : ""}
                            </th>
                            <td>{w.sessions}</td>
                            <td>{w.sets}</td>
                            <td>{fmt.weight(w.volume, 0)}</td>
                            <td>{Math.round(w.duration / 60)} min</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  page={safeWeekPage}
                  total={weeks.length}
                  onPage={setWeekPage}
                  label="Weekly data"
                />
              </>
            )}
          </details>
        </Panel>
        <Panel label="Your natural rhythm" title="Days of the week">
          <div className="weekday-bars">
            {weekdays.map((d) => (
              <div key={d.label}>
                <span>{d.label}</span>
                <i
                  style={{
                    width: `${(d.count / Math.max(1, ...weekdays.map((x) => x.count))) * 65}%`,
                  }}
                />
                <strong>{d.count}</strong>
              </div>
            ))}
          </div>
          <p className="chart-note">
            Recorded sessions across the entire selected period.
          </p>
        </Panel>
      </div>
      <Panel label="Familiar sessions" title="Routine history">
        <div className="routine-cards">
          {routines
            .slice(safeRoutinePage * 50, safeRoutinePage * 50 + 50)
            .map((r) => (
              <button
                key={r.key}
                onClick={() => setRoutine(routine === r.key ? null : r.key)}
                aria-pressed={routine === r.key}
              >
                <span className="eyebrow">{r.workouts.length} sessions</span>
                <strong>{r.workouts.at(-1)?.title}</strong>
                <span>
                  {fmt.weight(
                    totals(r.workouts, context.includeWarmups).volume,
                    0,
                  )}{" "}
                  logged volume
                </span>
                <Icon name="arrow" size={18} />
              </button>
            ))}
        </div>
        <Pager
          page={safeRoutinePage}
          total={routines.length}
          onPage={setRoutinePage}
          label="Routine history"
        />
        <p className="chart-note">
          Grouped by Hevy routine ID. Sessions without one are grouped only when
          their ordered exercise identities match.
        </p>
      </Panel>
      {measurements.length > 0 &&
        bodyStatus !== "partial" &&
        bodyStatus !== "unavailable" && (
          <Panel label="Optional context" title="Recorded body measurements">
            <details
              className="table-alternative"
              open={bodyOpen}
              onToggle={(event) => setBodyOpen(event.currentTarget.open)}
            >
              <summary>View recorded measurements</summary>
              {bodyOpen && (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Body weight</th>
                          <th>Body fat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measurements
                          .slice(safeBodyPage * 50, safeBodyPage * 50 + 50)
                          .map((m, i) => (
                            <tr key={`${m.date}-${i}`}>
                              <th>
                                {displayDay(bodyDay(m.date, context.timezone))}
                              </th>
                              <td>
                                {m.weightKg == null
                                  ? "Not recorded"
                                  : fmt.weight(m.weightKg)}
                              </td>
                              <td>
                                {m.fatPercent == null
                                  ? "Not recorded"
                                  : `${m.fatPercent}%`}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager
                    page={safeBodyPage}
                    total={measurements.length}
                    onPage={setBodyPage}
                    label="Body measurements"
                  />
                </>
              )}
            </details>
            <p className="chart-note">
              Recorded measurements only. Source coverage: {bodyStatus}.
            </p>
          </Panel>
        )}
      {(bodyStatus === "empty" ||
        (bodyStatus === "available" && measurements.length === 0)) && (
        <p className="chart-note">
          No body measurements are recorded in this date range.
        </p>
      )}
      {(bodyStatus === "partial" || bodyStatus === "unavailable") && (
        <p className="chart-note">
          Body measurements are {bodyStatus}. Trend analysis is paused until a
          complete snapshot is available.
        </p>
      )}
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

function bodyDay(value: string, timezone: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localDay(value, timezone);
}
