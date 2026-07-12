import type { MountainState } from "../data/game";
import { fmtWeight, shortDate } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { Card, Pill } from "./ui";

// Fixed positions for each waypoint along the ascent (viewBox 800×300).
const WP_POS: { x: number; y: number }[] = [
  { x: 95, y: 268 },
  { x: 170, y: 240 },
  { x: 245, y: 210 },
  { x: 320, y: 182 },
  { x: 395, y: 154 },
  { x: 468, y: 126 },
  { x: 538, y: 98 },
  { x: 600, y: 70 },
  { x: 652, y: 40 },
];
const START = { x: 30, y: 292 };

/** Lifetime tonnage as an expedition up a mountainside. */
export function IronMountain({ state }: { state: MountainState }) {
  const { unit } = useUnit();

  // Flag position: interpolate between the last reached waypoint (or the
  // trailhead) and the next one.
  const from = state.lastReachedIndex >= 0 ? WP_POS[state.lastReachedIndex] : START;
  const to = WP_POS[Math.min(state.lastReachedIndex + 1, WP_POS.length - 1)];
  const t = state.lastReachedIndex >= WP_POS.length - 1 ? 1 : state.progressToNext;
  const flag = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };

  const pathD = [START, ...WP_POS].map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

  return (
    <Card
      title={<>🏔️ Iron Mountain</>}
      hint="Every kilogram you've ever lifted hauls you further up the mountain."
      accent={<Pill className="!text-glow-cyan">{Math.round(state.pctToSummit * 1000) / 10}% to the summit</Pill>}
    >
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#0c1226] to-[#131a33]">
        <svg viewBox="0 0 800 300" className="h-auto w-full" role="img" aria-label="Your climb up Iron Mountain">
          {/* stars */}
          {[
            [60, 40], [140, 24], [300, 50], [420, 20], [720, 40], [760, 90], [220, 80], [680, 140],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#e2e8f0" opacity={0.5} />
          ))}
          <circle cx={730} cy={56} r={16} fill="#e2e8f0" opacity={0.85} />
          <circle cx={724} cy={50} r={14} fill="#0c1226" />

          {/* background ridges */}
          <polygon
            points="0,300 90,220 210,250 330,180 460,230 580,150 700,210 800,170 800,300"
            fill="#141b33"
          />
          {/* main mountain */}
          <polygon
            points="0,300 120,248 250,205 390,150 530,95 652,36 705,70 800,130 800,300"
            fill="#1a2140"
          />
          {/* snow cap */}
          <polygon points="616,53 652,36 686,58 668,62 652,52 636,64" fill="#dbe6f5" opacity={0.9} />

          {/* ascent path */}
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" />

          {/* waypoints — labels alternate left-above / right-below of the path
              (perpendicular to the slope) so neighbors never collide */}
          {state.waypoints.map((w, i) => {
            const p = WP_POS[i];
            const last = i === state.waypoints.length - 1;
            const leftAbove = i % 2 === 1 || last;
            return (
              <g key={w.name}>
                <title>
                  {w.name} · {(w.kg / 1000).toLocaleString()} t
                  {w.reached && w.reachedDate ? ` · reached ${shortDate(w.reachedDate)}` : ""}
                </title>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={w.reached ? "#059669" : "rgba(255,255,255,0.14)"}
                  stroke="#0c1226"
                  strokeWidth={2}
                />
                <text
                  x={leftAbove ? p.x - 9 : p.x + 9}
                  y={leftAbove ? p.y - 8 : p.y + 16}
                  textAnchor={leftAbove ? "end" : "start"}
                  fontSize={10}
                  fill={w.reached ? "#a7b7d4" : "#5a6785"}
                  className="select-none"
                >
                  {w.name} · {w.kg / 1000}t
                </text>
              </g>
            );
          })}

          {/* the climber's flag */}
          <g>
            <circle cx={flag.x} cy={flag.y} r={9} fill="#8b5cf6" opacity={0.25}>
              <animate attributeName="r" values="7;12;7" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 20} stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
            <path d={`M${flag.x} ${flag.y - 20} L${flag.x + 14} ${flag.y - 15} L${flag.x} ${flag.y - 10} Z`} fill="#8b5cf6" />
            <circle cx={flag.x} cy={flag.y} r={3.5} fill="#e2e8f0" />
          </g>
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{fmtWeight(state.totalKg, unit)}</span> hauled so far
          {state.lastReachedIndex >= 0 && (
            <span className="text-slate-400">
              {" "}· {state.waypoints[state.lastReachedIndex].name} reached
            </span>
          )}
        </p>
        {state.nextName && (
          <p className="text-sm text-slate-400">
            Next camp: <span className="text-slate-200">{state.nextName}</span> in{" "}
            <span className="font-medium text-glow-emerald">{fmtWeight(state.kgToNext, unit)}</span>
          </p>
        )}
      </div>
      {state.nextName && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-glow-violet to-glow-cyan"
            style={{ width: `${Math.round(state.progressToNext * 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
