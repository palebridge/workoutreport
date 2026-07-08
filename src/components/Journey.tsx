import { useState } from "react";
import type { JourneyEvent } from "../data/metrics";
import { Card } from "./ui";

const INITIAL = 8;

const KIND_STYLE: Record<JourneyEvent["kind"], string> = {
  badge: "border-glow-amber/30 bg-glow-amber/10",
  pr: "border-glow-violet/30 bg-glow-violet/10",
  week: "border-glow-emerald/30 bg-glow-emerald/10",
  start: "border-white/15 bg-white/5",
};

/** Every milestone in order — badges unlocked, records beaten, goals hit. */
export function Journey({ events }: { events: JourneyEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return null;

  const visible = showAll ? events : events.slice(0, INITIAL);
  const hidden = events.length - visible.length;

  return (
    <Card title={<>📜 The Journey</>} hint="Every milestone so far, newest first.">
      <ol className="relative ml-4 space-y-4 border-l border-white/10 pl-6">
        {visible.map((e, i) => (
          <li key={`${e.date}-${e.title}-${i}`} className="relative">
            <span
              className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full border text-xs ${KIND_STYLE[e.kind]}`}
            >
              {e.emoji}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-slate-200">{e.title}</span>
              <span className="text-[10px] text-slate-500">
                {new Date(e.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            {e.detail && <div className="mt-0.5 text-xs text-slate-400">{e.detail}</div>}
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-400 transition hover:text-slate-200"
        >
          Show {hidden} earlier milestone{hidden > 1 ? "s" : ""}
        </button>
      )}
      {showAll && events.length > INITIAL && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs text-slate-400 transition hover:text-slate-200"
        >
          Collapse
        </button>
      )}
    </Card>
  );
}
