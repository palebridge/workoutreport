import { motion } from "framer-motion";
import type { Achievement, PRRecord } from "../data/metrics";
import { fmtWeight, shortDate } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { Card } from "./ui";

export function Achievements({
  achievements,
  records,
}: {
  achievements: Achievement[];
  records: PRRecord[];
}) {
  const { unit } = useUnit();
  const earned = achievements.filter((a) => a.earned).length;
  const topRecords = records.slice(0, 4);

  return (
    <Card
      title={<>🏆 Trophy Case</>}
      hint={`${earned} of ${achievements.length} badges earned`}
    >
      {topRecords.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Personal Records
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {topRecords.map((r) => (
              <div
                key={r.templateId}
                className="rounded-xl border border-glow-amber/20 bg-glow-amber/5 p-3"
              >
                <div className="truncate text-xs text-slate-300" title={r.title}>
                  {r.title}
                </div>
                <div className="mt-1 font-display text-lg font-semibold text-glow-amber">
                  {fmtWeight(r.best1RMKg, unit, 1)}
                </div>
                <div className="text-[10px] text-slate-500">
                  est. 1RM · {shortDate(r.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {achievements.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
            title={a.description}
            className={`relative overflow-hidden rounded-2xl border p-3 text-center transition ${
              a.earned
                ? "border-white/15 bg-white/[0.06]"
                : "border-white/5 bg-white/[0.02] opacity-60"
            }`}
          >
            <div className={`text-2xl ${a.earned ? "" : "grayscale"}`}>{a.emoji}</div>
            <div className="mt-1 truncate text-xs font-medium text-slate-200">{a.title}</div>
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-500">
              {a.description}
            </div>
            {!a.earned && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-glow-violet/70"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
            {a.earned && (
              <div className="absolute right-1.5 top-1.5 text-[10px] text-glow-emerald">✓</div>
            )}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
