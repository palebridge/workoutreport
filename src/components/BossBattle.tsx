import type { BossReport } from "../data/game";
import { useUnit } from "../hooks/useUnit";
import { fmtWeight } from "../data/metrics";
import { Card, EmptyHint, Pill } from "./ui";

/** The month's volume target, dressed up as a monster with an HP bar. */
export function BossBattle({ report }: { report: BossReport }) {
  const { unit } = useUnit();
  const boss = report.current;

  if (!boss) {
    return (
      <Card title={<>⚔️ Boss Battle</>}>
        <EmptyHint>Log a workout and this month's boss will reveal itself…</EmptyHint>
      </Card>
    );
  }

  const hpPct = boss.hp > 0 ? Math.round((boss.hpLeft / boss.hp) * 100) : 0;

  return (
    <Card
      title={<>⚔️ Boss Battle</>}
      hint={`${boss.monthLabel} — every kg you lift is damage dealt.`}
      accent={!boss.slain ? <Pill>{boss.daysLeft}d left</Pill> : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={`text-6xl leading-none transition ${boss.slain ? "opacity-40 grayscale" : "animate-float"}`}
          aria-hidden
        >
          {boss.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold text-white">{boss.displayName}</div>
          <p className="mt-0.5 text-xs italic text-slate-500">“{boss.flavor}”</p>

          {/* HP meter — status red; the track is a darker step of the same ramp */}
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>❤️ Boss HP</span>
              <span>
                {fmtWeight(boss.hpLeft, unit)} / {fmtWeight(boss.hp, unit)}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#3a1515]">
              <div
                className="h-full rounded-full bg-[#d03b3b] transition-all duration-700"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {boss.slain ? (
            <div className="mt-3 rounded-xl border border-glow-emerald/30 bg-glow-emerald/10 px-3 py-2 text-center text-sm font-semibold text-emerald-300">
              ⚔️ VICTORY — {boss.displayName.split(",")[0]} has been slain!
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              <span className="font-medium text-slate-200">{fmtWeight(boss.hpLeft, unit)}</span> of
              lifting left to slay it this month.
            </p>
          )}
        </div>
      </div>

      {/* Battle log */}
      {boss.log.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Battle log
          </div>
          <ul className="space-y-1">
            {boss.log.slice(0, 5).map((e, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{e.label}</span>
                <span className="text-slate-300">
                  ⚡ {fmtWeight(e.damage, unit)} damage
                  {e.crit && <span className="ml-1.5 font-semibold text-glow-amber">★ CRIT</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trophy shelf of past bosses */}
      {report.shelf.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            Past bosses
          </div>
          <div className="flex flex-wrap gap-2">
            {report.shelf.map((s, i) => (
              <span
                key={i}
                title={`${s.name} · ${s.monthLabel} · ${s.slain ? "slain" : "escaped"}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  s.slain
                    ? "border-glow-emerald/25 bg-glow-emerald/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-slate-500 grayscale"
                }`}
              >
                <span>{s.emoji}</span>
                {s.monthLabel} {s.slain ? "⚔️" : "💨"}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
