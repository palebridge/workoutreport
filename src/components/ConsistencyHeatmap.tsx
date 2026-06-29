import type { Consistency } from "../data/metrics";
import { Card } from "./ui";

const WEEKS = 26; // ~6 months of history
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

export function ConsistencyHeatmap({ cons }: { cons: Consistency }) {
  const grid = buildGrid(cons.byDay);

  return (
    <Card
      title={<>📅 Consistency</>}
      hint="Each square is a day. Brighter means more sessions."
      accent={
        <div className="flex gap-2">
          <Chip label="Current" value={`${cons.currentStreak}d`} tone="violet" />
          <Chip label="Longest" value={`${cons.longestStreak}d`} tone="cyan" />
        </div>
      }
    >
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="flex flex-col justify-between py-[2px] text-[10px] text-slate-500">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="h-[13px] leading-[13px]">
              {d}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={cell ? `${cell.date} · ${cell.count} workout${cell.count > 1 ? "s" : ""}` : ""}
                  className="h-[13px] w-[13px] rounded-[3px]"
                  style={{ background: cell ? levelColor(cell.count) : "transparent" }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          {cons.visitsThisWeek} this week · {cons.visitsThisMonth} this month · {cons.activeDays} active days
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

function buildGrid(byDay: Record<string, number>): (Cell | null)[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Monday of the current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - (WEEKS - 1) * 7);

  const grid: (Cell | null)[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: (Cell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      if (day > today) {
        col.push(null);
        continue;
      }
      const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
      col.push({ date: key, count: byDay[key] ?? 0 });
    }
    grid.push(col);
  }
  return grid;
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
