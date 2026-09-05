import { useEffect, useMemo, useState } from "react";
import type { ExerciseSeries, SeriesPoint } from "../../data/analysis";
import { METRICS, percentChange } from "../../data/analysis";
import { dayDistance, displayDay } from "../../data/calendar";
import type { DateRange } from "../../data/calendar";
import { useFormat, signed } from "./shared";

/** Sample interaction targets only. The line and accessible table retain every observation. */
export function markerPoints(points: SeriesPoint[]): SeriesPoint[] {
  const valid = points.filter((point) => point.value != null);
  if (valid.length <= 40) return valid;
  const selected = new Set<number>([0, valid.length - 1]);
  for (let index = 0; index < 40; index++)
    selected.add(Math.round((index * (valid.length - 1)) / 39));
  let minimum = 0,
    maximum = 0;
  for (let index = 1; index < valid.length; index++) {
    if (valid[index].value! < valid[minimum].value!) minimum = index;
    if (valid[index].value! > valid[maximum].value!) maximum = index;
  }
  selected.add(minimum);
  selected.add(maximum);
  return [...selected].sort((a, b) => a - b).map((index) => valid[index]);
}

export function Atlas({
  series,
  range,
  onWorkout,
  onExercise,
}: {
  series: ExerciseSeries[];
  range: DateRange;
  onWorkout: (id: string) => void;
  onExercise: (id: string) => void;
}) {
  const [all, setAll] = useState(false),
    [relative, setRelative] = useState(false);
  const [tableOpen, setTableOpen] = useState(false),
    [tablePage, setTablePage] = useState(0);
  const fmt = useFormat();
  const rows = all ? series : series.slice(0, 6);
  const sampled = rows.some(
    (row) => row.points.filter((point) => point.value != null).length > 40,
  );
  const tableRows = useMemo(
    () =>
      tableOpen
        ? series.flatMap((row) => row.points.map((point) => ({ row, point })))
        : [],
    [series, tableOpen],
  );
  useEffect(() => {
    setTablePage(0);
  }, [series, range.start, range.end]);
  const pages = Math.max(1, Math.ceil(tableRows.length / 50)),
    page = Math.min(tablePage, pages - 1);
  const visibleTableRows = tableRows.slice(page * 50, page * 50 + 50);
  const rangeDays = Math.max(1, dayDistance(range.start, range.end));
  return (
    <>
      <div className="atlas-toolbar">
        <span className="legend">
          <i />{" "}
          {relative
            ? "First eligible session = 100"
            : "Each lift, its own scale"}
        </span>
        <div className="segmented">
          <button aria-pressed={!relative} onClick={() => setRelative(false)}>
            Recorded
          </button>
          <button aria-pressed={relative} onClick={() => setRelative(true)}>
            Relative change
          </button>
        </div>
      </div>
      {sampled && (
        <p className="small muted">
          Lines show every observation. For longer histories, markers show 40
          evenly spaced sessions plus the first, last, lowest and highest
          values. The table below includes every session.
        </p>
      )}
      <div className="atlas">
        {rows.map((row, rowIndex) => {
          const valid = row.points.filter((point) => point.value != null),
            markers = markerPoints(valid);
          const first = valid[0]?.value ?? null,
            last = valid.at(-1)?.value ?? null;
          const delta =
            first != null && last != null && valid.length > 1
              ? percentChange(last, first)
              : null;
          const values = valid.map((point) =>
            relative && first && first > 0
              ? (point.value! / first) * 100
              : point.value!,
          );
          const canPlot = !relative || (first != null && first > 0);
          const min = Math.min(...values),
            max = Math.max(...values),
            span = max - min || Math.max(Math.abs(max) * 0.05, 1);
          const pointXY = (point: SeriesPoint) => ({
            x: 12 + (dayDistance(range.start, point.date) / rangeDays) * 596,
            y:
              55 -
              (((relative && first
                ? (point.value! / first) * 100
                : point.value!) -
                min) /
                span) *
                34,
          });
          let connected = false;
          const path = row.points
            .map((point) => {
              if (point.value == null) {
                connected = false;
                return "";
              }
              const { x, y } = pointXY(point),
                prefix = connected ? "L" : "M";
              connected = true;
              return `${prefix}${x},${y}`;
            })
            .join(" ");
          return (
            <div className="atlas-row" key={row.id}>
              <button
                className="atlas-label"
                onClick={() => onExercise(row.id)}
              >
                <span className="row-number">
                  {String(rowIndex + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <small>
                    {METRICS[row.metric].label} · {row.sessions} sessions
                  </small>
                </span>
              </button>
              <div className="atlas-plot">
                {canPlot && valid.length ? (
                  <svg
                    viewBox="0 0 620 78"
                    role="group"
                    aria-label={`${row.title} session progression; line contains all observations`}
                  >
                    {[20, 40, 60].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        x2="620"
                        y1={y}
                        y2={y}
                        className="chart-grid"
                      />
                    ))}
                    <path d={path} className="atlas-line" />
                    {markers.map((point) => {
                      const { x, y } = pointXY(point);
                      return (
                        <g
                          key={point.workoutId}
                          tabIndex={0}
                          role="button"
                          aria-label={`${row.title}, ${displayDay(point.date)}, ${fmt.metric(point.value, row.metric)}${point.isRecord ? ", new record" : ""}. Open workout.`}
                          onClick={() => onWorkout(point.workoutId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onWorkout(point.workoutId);
                            }
                          }}
                        >
                          <circle cx={x} cy={y} r="12" fill="transparent" />
                          <circle
                            cx={x}
                            cy={y}
                            r={point.isRecord ? 4.8 : 3}
                            className={
                              point.isRecord ? "record-dot" : "atlas-dot"
                            }
                          />
                          <title>{`${displayDay(point.date)} · ${fmt.metric(point.value, row.metric)}`}</title>
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <span className="muted small">
                    {relative
                      ? "Needs a positive baseline"
                      : "No eligible measurements"}
                  </span>
                )}
              </div>
              <div className="atlas-value">
                <strong>{fmt.metric(last, row.metric)}</strong>
                <small
                  className={
                    row.metric === "e1rm" && delta != null && delta > 0
                      ? "accent"
                      : "muted"
                  }
                >
                  {delta == null
                    ? "Baseline"
                    : `${signed(delta, 1)}% since first`}
                </small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="atlas-footer">
        <span>{displayDay(range.start)}</span>
        <span className="muted">Select a marker to inspect its sets</span>
        <span>{displayDay(range.end)}</span>
      </div>
      {series.length > 6 && (
        <button className="text-button" onClick={() => setAll(!all)}>
          {all ? "Show six exercises" : `Show all ${series.length} exercises`}
        </button>
      )}
      <details
        className="table-alternative"
        open={tableOpen}
        onToggle={(event) => setTableOpen(event.currentTarget.open)}
      >
        <summary>View every observation as a table</summary>
        {tableOpen && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Date</th>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTableRows.map(({ row, point }) => (
                    <tr key={`${row.id}:${point.workoutId}`}>
                      <th>{row.title}</th>
                      <td>{displayDay(point.date)}</td>
                      <td>{METRICS[row.metric].label}</td>
                      <td>{fmt.metric(point.value, row.metric)}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => onWorkout(point.workoutId)}
                        >
                          Open workout
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="atlas-toolbar" aria-label="Observation table pages">
              <button
                className="button compact"
                disabled={page === 0}
                onClick={() => setTablePage(page - 1)}
              >
                Previous
              </button>
              <span className="small muted" aria-live="polite">
                {tableRows.length
                  ? `${page * 50 + 1}–${Math.min((page + 1) * 50, tableRows.length)} of ${tableRows.length} observations`
                  : "No observations"}
              </span>
              <button
                className="button compact"
                disabled={page + 1 >= pages}
                onClick={() => setTablePage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </details>
    </>
  );
}
