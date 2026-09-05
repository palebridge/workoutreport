import { motion } from "framer-motion";
import type { Medal, PRWallEntry, TrophySummary } from "../data/metrics";
import { MEDALS, fmtWeight, prettyMuscle, shortDate } from "../data/metrics";
import { useUnit } from "../hooks/useUnit";
import { AnimatedNumber, Card } from "./ui";

const MEDAL_STYLE: Record<
  Medal,
  { label: string; dot: string; chip: string; ring: string; text: string }
> = {
  bronze: {
    label: "Bronze",
    dot: "#cd7f32",
    chip: "from-[#cd7f32]/35 to-[#7a4a1f]/10",
    ring: "border-[#cd7f32]/40",
    text: "text-[#e8a06a]",
  },
  silver: {
    label: "Silver",
    dot: "#c9d1dc",
    chip: "from-[#c9d1dc]/35 to-[#6d7683]/10",
    ring: "border-[#c9d1dc]/40",
    text: "text-[#d7dee7]",
  },
  gold: {
    label: "Gold",
    dot: "#f5c542",
    chip: "from-[#f5c542]/35 to-[#8a6a14]/10",
    ring: "border-[#f5c542]/45",
    text: "text-[#f5d878]",
  },
  platinum: {
    label: "Platinum",
    dot: "#a5e6ff",
    chip: "from-[#a5e6ff]/35 to-[#4a7f96]/10",
    ring: "border-[#a5e6ff]/45",
    text: "text-[#c4efff]",
  },
};

export function TrophyCase({
  trophy,
  wall,
}: {
  trophy: TrophySummary;
  wall: PRWallEntry[];
}) {
  const { unit } = useUnit();

  return (
    <Card
      title={<>🏆 Trophy Case</>}
      hint={`${trophy.earnedBadges} of ${trophy.totalBadges} badges earned across ${trophy.families.length} disciplines.`}
      accent={
        <div className="rounded-2xl border border-glow-amber/25 bg-glow-amber/10 px-3 py-1.5 text-center">
          <div className="font-display text-lg font-bold text-glow-amber">
            <AnimatedNumber value={trophy.score} />
          </div>
          <div className="text-[9px] uppercase tracking-widest text-amber-200/60">
            Trophy score
          </div>
        </div>
      }
    >
      {/* Hall of Fame */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Fame
          emoji="🏋️"
          label="Top recorded load"
          value={
            trophy.heaviest ? fmtWeight(trophy.heaviest.weightKg, unit, 1) : "—"
          }
          sub={trophy.heaviest ? trophy.heaviest.title : "log a weighted set"}
        />
        <Fame
          emoji="⚡"
          label="Best est. 1RM"
          value={trophy.best1RM ? fmtWeight(trophy.best1RM.kg, unit, 1) : "—"}
          sub={trophy.best1RM ? trophy.best1RM.title : ""}
        />
        <Fame
          emoji="⭐"
          label="Records beaten"
          value={String(trophy.prImprovements)}
          sub="own bests outdone"
        />
        <Fame
          emoji="🎖️"
          label="Badges"
          value={`${trophy.earnedBadges}/${trophy.totalBadges}`}
          sub="collected so far"
        />
      </div>

      {/* PR wall */}
      {wall.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Record Wall</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {wall.map((r) => {
              const fresh = Date.now() - Date.parse(r.date) < 14 * 86400000;
              return (
                <div
                  key={r.templateId}
                  className="relative rounded-2xl border border-glow-amber/15 bg-gradient-to-br from-glow-amber/[0.07] to-transparent p-3.5"
                >
                  {fresh && (
                    <span className="absolute right-2.5 top-2.5 rounded-full bg-glow-amber/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-glow-amber">
                      New
                    </span>
                  )}
                  <div
                    className="truncate pr-10 text-sm font-medium text-slate-200"
                    title={r.title}
                  >
                    {r.title}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                    {r.muscle ? prettyMuscle(r.muscle) : "—"} ·{" "}
                    {shortDate(r.date)}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <div className="font-display text-xl font-semibold text-glow-amber">
                        {fmtWeight(r.heaviestKg, unit, 1)}
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          × {r.heaviestReps}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        best est. 1RM {fmtWeight(r.best1RMKg, unit, 1)}
                      </div>
                    </div>
                    {r.timesImproved > 0 && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-emerald-300">
                        beaten ×{r.timesImproved}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tiered badge families */}
      <div className="mt-6">
        <SectionLabel>Badge Collection</SectionLabel>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {trophy.families.map((f, idx) => {
            const currentMedal: Medal | null =
              f.earnedTiers > 0 ? MEDALS[f.earnedTiers - 1] : null;
            const style = currentMedal ? MEDAL_STYLE[currentMedal] : null;
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.04, duration: 0.35 }}
                className={`rounded-2xl border p-3.5 ${
                  style
                    ? `${style.ring} bg-white/[0.04]`
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${
                      style
                        ? style.chip
                        : "from-white/5 to-transparent grayscale"
                    }`}
                  >
                    {f.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-200">
                        {f.label}
                      </span>
                      {/* Tier dots — one per medal, filled when earned */}
                      <span className="flex shrink-0 gap-1">
                        {MEDALS.map((m, i) => (
                          <span
                            key={m}
                            title={`${MEDAL_STYLE[m].label}: ${f.tiers[i].name} (${f.tiers[i].threshold.toLocaleString()})`}
                            className="h-2 w-2 rounded-full"
                            style={{
                              background:
                                i < f.earnedTiers
                                  ? MEDAL_STYLE[m].dot
                                  : "rgba(255,255,255,0.08)",
                            }}
                          />
                        ))}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 truncate text-xs ${style ? style.text : "text-slate-500"}`}
                    >
                      {currentMedal
                        ? `${MEDAL_STYLE[currentMedal].label} · ${f.tiers[f.earnedTiers - 1].name}`
                        : "Not yet unlocked"}
                    </div>
                  </div>
                </div>

                {f.next ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>
                        Next:{" "}
                        <span className="text-slate-400">
                          {f.next.tier.name}
                        </span>
                      </span>
                      <span>
                        {(f.format ?? ((v: number) => String(Math.round(v))))(
                          f.value,
                        )}{" "}
                        / {f.next.tier.threshold.toLocaleString()} {f.unit}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(f.next.progress * 100)}%`,
                          background: MEDAL_STYLE[f.next.medal].dot,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-widest text-glow-amber">
                    ★ Maxed out ★
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function Fame({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-glow-amber/20 bg-gradient-to-br from-glow-amber/[0.12] to-transparent p-3.5 text-center">
      <div className="text-xl">{emoji}</div>
      <div className="mt-1 font-display text-lg font-semibold text-white">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-amber-200/70">
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[10px] text-slate-500" title={sub}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}
