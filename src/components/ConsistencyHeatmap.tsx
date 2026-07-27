import type { Consistency } from "../data/metrics";
import { TARGET_OPTIONS, useWeeklyTarget } from "../hooks/useWeeklyTarget";
import { Card } from "./ui";

// The strip always starts at the week of the first workout — never before it —
// and any spare columns are *upcoming* weeks, drawn as outlines. So the chart
// reads as "the journey so far, and the road ahead" instead of padding the past
// with weeks that predate the log.
const RUNWAY = 2; // weeks shown ahead once history is long
const MIN_COLS = 10; // keeps the strip a sensible width early on
const MAX_COLS = 53;
const GAP = 3;
const LABEL_W = 15;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ConsistencyHeatmap({ cons }: { cons: Consistency }) {
  const { target, setTarget } = useWeeklyTarget();
  const columns = buildColumns(cons.byDay, target);
  const cell = cellSize(columns.length);

  return (
    <Card
      title={<>📅 Consistency</>}
      hint="Each square is a day, brighter means more sessions. A green underline marks a week that hit your goal — outlined squares are still ahead of you."
      accent={
        <div className="flex flex-col items-end gap-1">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
            {TARGET_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setTarget(n)}
                className={`rounded-full px-2.5 py-1 transition ${
                  target === n ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
                aria-pressed={target === n}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">weekly goal</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
      <div className="min-w-0 flex-1 overflow-x-auto pb-1">
        <div className="flex w-fit flex-col gap-1">
          {/* Month labels, aligned over the columns */}
          <div className="flex" style={{ gap: GAP, paddingLeft: LABEL_W + GAP }}>
            {columns.map((col, i) => (
              <div key={i} className="relative h-3" style={{ width: cell }}>
                {col.monthLabel && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[9px] text-slate-500">
                    {col.monthLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day labels + the grid */}
          <div className="flex" style={{ gap: GAP }}>
            <div
              className="flex flex-col text-center text-[9px] text-slate-500"
              style={{ width: LABEL_W, gap: GAP }}
            >
              {DAY_LABELS.map((d, i) => (
                <span key={i} style={{ height: cell, lineHeight: `${cell}px` }}>
                  {d}
                </span>
              ))}
            </div>

            {columns.map((col, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                {col.cells.map((c, di) => (
                  <div
                    key={di}
                    title={c ? `${c.date} · ${c.count} workout${c.count > 1 ? "s" : ""}` : ""}
                    className="rounded-[3px]"
                    style={{
                      width: cell,
                      height: cell,
                      // A past day with no session is a filled faint square; a
                      // day still to come is an outline. Fill vs. outline is
                      // what separates "trained nothing" from "not yet".
                      background: c ? levelColor(c.count) : "transparent",
                      border: c ? undefined : "1px dashed rgba(255,255,255,0.10)",
                    }}
                  />
                ))}
                {/* Goal marker: a green underline only on weeks that hit the goal */}
                <div
                  className="mt-[3px] h-[4px] rounded-full"
                  title={!col.isFuture && col.onTarget ? "Hit your weekly goal" : ""}
                  style={{
                    width: cell,
                    background: !col.isFuture && col.onTarget ? "#059669" : "transparent",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly stats — sit alongside the strip on wide screens */}
      <div className="grid shrink-0 grid-cols-4 gap-2 lg:grid-cols-2">
        <Chip label="This week" value={`${cons.sessionsThisWeek}/${target}`} tone="violet" />
        <Chip label="Week streak" value={`${cons.weeksOnTargetStreak}w`} tone="cyan" />
        <Chip label="Avg / wk" value={cons.avgPerWeek.toFixed(1)} tone="violet" />
        <Chip label="Best week" value={`${cons.bestWeek}`} tone="cyan" />
      </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <span>
          {cons.weeksMetTarget}/{cons.totalWeeks} weeks on goal · {cons.activeDays} active days
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-[4px] w-[13px] rounded-full" style={{ background: "#059669" }} />
            week hit goal
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-[11px] w-[11px] rounded-[3px]"
              style={{ border: "1px dashed rgba(255,255,255,0.10)" }}
            />
            ahead
          </span>
          <span className="flex items-center gap-1.5">
            <span>Less</span>
            {[0, 1, 2, 3].map((l) => (
              <span key={l} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: levelColor(l) }} />
            ))}
            <span>More</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

interface Cell {
  date: string;
  count: number;
}

interface Column {
  cells: (Cell | null)[];
  monthLabel: string | null;
  onTarget: boolean;
  /** a week that hasn't started yet — drawn as outlines, never marked */
  isFuture: boolean;
}

function buildColumns(byDay: Record<string, number>, target: number): Column[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonday = mondayOf(today);

  // Anchor the window at the first workout's week. Spare columns become runway
  // (weeks ahead); once history outgrows MAX_COLS the start rolls forward.
  const activeDays = Object.keys(byDay).sort();
  const earliest = activeDays.length ? new Date(activeDays[0] + "T00:00:00") : today;
  const earliestMonday = mondayOf(earliest);
  const weeksSoFar =
    Math.round((currentMonday.getTime() - earliestMonday.getTime()) / (7 * 86400000)) + 1;
  const pastWeeks = Math.min(weeksSoFar, MAX_COLS - RUNWAY);
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, pastWeeks + RUNWAY));
  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - (pastWeeks - 1) * 7);

  const columns: Column[] = [];
  let prevMonth = -1;
  for (let w = 0; w < cols; w++) {
    const cells: (Cell | null)[] = [];
    let weekCount = 0;
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      if (day > today) {
        cells.push(null); // still to come — rendered as an outline
        continue;
      }
      const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      const count = byDay[key] ?? 0;
      weekCount += count;
      cells.push({ date: key, count });
    }

    // Label the column when its month differs from the previous one.
    const month = weekStart.getMonth();
    const monthLabel = month !== prevMonth ? MONTHS[month] : null;
    prevMonth = month;

    columns.push({
      cells,
      monthLabel,
      onTarget: weekCount >= target,
      isFuture: weekStart.getTime() > currentMonday.getTime(),
    });
  }
  return columns;
}

/** Cells grow while the strip is short so the card never looks sparse. */
function cellSize(cols: number): number {
  if (cols <= 14) return 26;
  if (cols <= 28) return 17;
  return 13;
}

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return m;
}

function levelColor(count: number): string {
  if (count <= 0) return "rgba(255,255,255,0.05)";
  if (count === 1) return "rgba(139,92,246,0.45)";
  if (count === 2) return "rgba(139,92,246,0.75)";
  return "rgba(167,139,250,1)";
}

function Chip({ label, value, tone }: { label: string; value: string; tone: "violet" | "cyan" }) {
  const color = tone === "violet" ? "text-glow-violet" : "text-glow-cyan";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-center">
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
