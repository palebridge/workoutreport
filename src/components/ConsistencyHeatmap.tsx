import type { Consistency } from "../data/metrics";
import { TARGET_OPTIONS, useWeeklyTarget } from "../hooks/useWeeklyTarget";
import { Card } from "./ui";

const MIN_WEEKS = 12;
const MAX_WEEKS = 53;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ConsistencyHeatmap({ cons }: { cons: Consistency }) {
  const { target, setTarget } = useWeeklyTarget();
  const columns = buildColumns(cons.byDay, target);

  return (
    <Card
      title={<>📅 Consistency</>}
      hint="Each square is a day, brighter means more sessions. The bar under a week shows it hit your goal."
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
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          {/* Month labels, aligned over the columns */}
          <div className="flex gap-[3px] pl-[18px]">
            {columns.map((col, i) => (
              <div key={i} className="relative h-3 w-[13px]">
                {col.monthLabel && (
                  <span className="absolute left-0 top-0 whitespace-nowrap text-[9px] text-slate-500">
                    {col.monthLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day labels + the grid */}
          <div className="flex gap-[3px]">
            <div className="flex w-[15px] flex-col gap-[3px] text-center text-[9px] leading-[13px] text-slate-500">
              {DAY_LABELS.map((d, i) => (
                <span key={i} className="h-[13px]">
                  {d}
                </span>
              ))}
            </div>

            {columns.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.cells.map((cell, di) => (
                  <div
                    key={di}
                    title={cell ? `${cell.date} · ${cell.count} workout${cell.count > 1 ? "s" : ""}` : ""}
                    className="h-[13px] w-[13px] rounded-[3px]"
                    style={{ background: cell ? levelColor(cell.count) : "transparent" }}
                  />
                ))}
                {/* On-goal marker */}
                <div
                  className="mt-[2px] h-[3px] w-[13px] rounded-full"
                  style={{ background: col.onTarget ? "#34d399" : "rgba(255,255,255,0.05)" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly stats */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip label="This week" value={`${cons.sessionsThisWeek}/${target}`} tone="violet" />
        <Chip label="Week streak" value={`${cons.weeksOnTargetStreak}w`} tone="cyan" />
        <Chip label="Avg / wk" value={cons.avgPerWeek.toFixed(1)} tone="violet" />
        <Chip label="Best week" value={`${cons.bestWeek}`} tone="cyan" />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          {cons.weeksMetTarget}/{cons.totalWeeks} weeks on goal · {cons.activeDays} active days
        </span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {[0, 1, 2, 3].map((l) => (
            <span key={l} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: levelColor(l) }} />
          ))}
          <span>More</span>
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
}

function buildColumns(byDay: Record<string, number>, target: number): Column[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonday = mondayOf(today);

  // Window starts at the earliest active week, clamped to a sensible range so a
  // brand-new log isn't a sea of empty squares and a long history stays bounded.
  const activeDays = Object.keys(byDay).sort();
  const earliest = activeDays.length ? new Date(activeDays[0] + "T00:00:00") : today;
  const earliestMonday = mondayOf(earliest);
  const weeksSinceStart = Math.round((currentMonday.getTime() - earliestMonday.getTime()) / (7 * 86400000)) + 1;
  const weeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, weeksSinceStart));
  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - (weeks - 1) * 7);

  const columns: Column[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const cells: (Cell | null)[] = [];
    let weekCount = 0;
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);

    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + d);
      if (day > today) {
        cells.push(null);
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

    columns.push({ cells, monthLabel, onTarget: weekCount >= target });
  }
  return columns;
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
