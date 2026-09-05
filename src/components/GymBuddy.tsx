import { useEffect, useState } from "react";
import type { BuddyMood, BuddyState } from "../data/game";
import { Card, Pill } from "./ui";
import { readPreference, writePreference } from "../hooks/storage";

const NAME_KEY = "wr.buddyName";
const DEFAULT_NAME = "Rhino";

const MOOD_EMOJI: Record<BuddyMood, string> = {
  celebrating: "🎉",
  pumped: "💪",
  content: "😌",
  sleepy: "😴",
  sad: "🥺",
};

/** The dashboard's resident creature — its body and mood come from the data. */
export function GymBuddy({ state }: { state: BuddyState }) {
  const [name, setName] = useState(
    () => readPreference(NAME_KEY) || DEFAULT_NAME,
  );
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    writePreference(NAME_KEY, name);
  }, [name]);

  return (
    <Card
      title={<>🐾 Gym Buddy</>}
      hint="A little character from your training story."
      accent={
        <Pill>
          {MOOD_EMOJI[state.mood]} {state.mood}
        </Pill>
      }
    >
      <div className="flex items-center gap-5">
        <div className="w-[150px] shrink-0 animate-float">
          <BuddySvg state={state} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editing ? (
              <input
                autoFocus
                aria-label="Buddy name"
                defaultValue={name}
                maxLength={16}
                onBlur={(e) => {
                  setName(e.target.value.trim() || DEFAULT_NAME);
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-32 rounded-lg border border-white/10 bg-ink-900/70 px-2 py-1 font-display text-lg font-semibold text-white outline-none focus:border-glow-violet/50"
              />
            ) : (
              <>
                <span className="truncate font-display text-xl font-semibold text-white">
                  {name}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  title="Rename your buddy"
                  aria-label="Rename your buddy"
                  className="text-xs text-slate-500 transition hover:text-slate-300"
                >
                  ✏️
                </button>
              </>
            )}
            <Pill className="!text-glow-violet">
              Stage {state.stage} · {state.stageName}
            </Pill>
          </div>

          <p className="mt-2 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm italic text-slate-300">
            “{state.moodLine}”
          </p>

          {state.nextEvolution ? (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>
                  Evolves into{" "}
                  <span className="text-slate-300">
                    {state.nextEvolution.name}
                  </span>
                </span>
                <span>{Math.round(state.nextEvolution.progress * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-glow-violet to-glow-indigo"
                  style={{
                    width: `${Math.round(state.nextEvolution.progress * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-glow-amber">
              ★ Final form ★
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Hand-drawn parametric creature. Arms/legs/torso scale with the muscle-balance
 * shares; the face follows the mood; small accessories mark the stage.
 */
function BuddySvg({ state }: { state: BuddyState }) {
  const { armScale: a, legScale: l, torsoScale: t, mood, stage } = state;
  const stageScale = [0.82, 0.95, 1.08, 1.2][stage - 1] ?? 1;
  const flexing = mood === "pumped" || mood === "celebrating";

  return (
    <svg
      viewBox="0 0 200 210"
      className="h-auto w-full"
      role="img"
      aria-label="Your gym buddy"
    >
      <g
        transform={`translate(100 108) scale(${stageScale}) translate(-100 -108)`}
      >
        {/* legs */}
        <ellipse cx={82} cy={172} rx={9 * l} ry={20 * l} fill="#6d5bd0" />
        <ellipse cx={118} cy={172} rx={9 * l} ry={20 * l} fill="#6d5bd0" />
        {/* feet */}
        <ellipse cx={80} cy={190} rx={11 * l} ry={5} fill="#5747b8" />
        <ellipse cx={120} cy={190} rx={11 * l} ry={5} fill="#5747b8" />

        {/* arms — hang at rest, curl up when flexing */}
        {flexing ? (
          <>
            <ellipse
              cx={52}
              cy={112}
              rx={11 * a}
              ry={20 * a}
              transform="rotate(-135 52 112)"
              fill="#7c6ae0"
            />
            <ellipse
              cx={148}
              cy={112}
              rx={11 * a}
              ry={20 * a}
              transform="rotate(135 148 112)"
              fill="#7c6ae0"
            />
            <circle cx={42} cy={96} r={8 * a} fill="#7c6ae0" />
            <circle cx={158} cy={96} r={8 * a} fill="#7c6ae0" />
          </>
        ) : (
          <>
            <ellipse
              cx={56}
              cy={128}
              rx={10 * a}
              ry={22 * a}
              transform="rotate(20 56 128)"
              fill="#7c6ae0"
            />
            <ellipse
              cx={144}
              cy={128}
              rx={10 * a}
              ry={22 * a}
              transform="rotate(-20 144 128)"
              fill="#7c6ae0"
            />
          </>
        )}

        {/* torso + head as one blob */}
        <ellipse cx={100} cy={128} rx={40 * t} ry={38 * t} fill="#8b5cf6" />
        <circle cx={100} cy={72} r={34} fill="#8b5cf6" />

        {/* belly patch */}
        <ellipse
          cx={100}
          cy={134}
          rx={22 * t}
          ry={20 * t}
          fill="#a487f8"
          opacity={0.55}
        />

        {/* stage accessories */}
        {stage >= 2 && (
          <path
            d="M68 58 Q100 44 132 58 L132 50 Q100 36 68 50 Z"
            fill="#e11d48"
          />
        )}
        {stage >= 3 && (
          <g>
            <rect x={88} y={95} width={24} height={4} rx={2} fill="#cbd5e1" />
            <rect x={82} y={90} width={8} height={14} rx={2} fill="#64748b" />
            <rect x={110} y={90} width={8} height={14} rx={2} fill="#64748b" />
          </g>
        )}
        {stage >= 4 && (
          <path
            d="M78 40 L86 26 L94 38 L100 22 L106 38 L114 26 L122 40 Z"
            fill="#f5c542"
          />
        )}

        {/* ears/horns */}
        <circle cx={72} cy={48} r={9} fill="#7c6ae0" />
        <circle cx={128} cy={48} r={9} fill="#7c6ae0" />

        {/* face */}
        <Face mood={mood} />
      </g>

      {/* mood effects outside the body transform */}
      {mood === "sleepy" && (
        <text x={150} y={48} fill="#94a3b8" fontSize={16} fontStyle="italic">
          z z
        </text>
      )}
      {mood === "celebrating" && (
        <g>
          <circle cx={30} cy={40} r={3} fill="#f5c542" />
          <circle cx={172} cy={58} r={3} fill="#22d3ee" />
          <circle cx={44} cy={78} r={2.5} fill="#e11d48" />
          <circle cx={162} cy={26} r={2.5} fill="#34d399" />
          <circle cx={22} cy={110} r={2} fill="#f472b6" />
        </g>
      )}
    </svg>
  );
}

function Face({ mood }: { mood: BuddyMood }) {
  switch (mood) {
    case "celebrating":
      return (
        <g>
          <text x={80} y={76} fontSize={16} textAnchor="middle" fill="#fbbf24">
            ★
          </text>
          <text x={120} y={76} fontSize={16} textAnchor="middle" fill="#fbbf24">
            ★
          </text>
          <path
            d="M85 86 Q100 100 115 86"
            stroke="#2d2258"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "pumped":
      return (
        <g>
          <path
            d="M74 62 L90 68"
            stroke="#2d2258"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <path
            d="M126 62 L110 68"
            stroke="#2d2258"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={84} cy={73} r={4.5} fill="#2d2258" />
          <circle cx={116} cy={73} r={4.5} fill="#2d2258" />
          <path
            d="M88 88 Q100 96 112 88"
            stroke="#2d2258"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "content":
      return (
        <g>
          <circle cx={84} cy={72} r={4.5} fill="#2d2258" />
          <circle cx={116} cy={72} r={4.5} fill="#2d2258" />
          <path
            d="M90 87 Q100 93 110 87"
            stroke="#2d2258"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    case "sleepy":
      return (
        <g>
          <path
            d="M78 72 Q84 76 90 72"
            stroke="#2d2258"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M110 72 Q116 76 122 72"
            stroke="#2d2258"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={100} cy={90} rx={5} ry={4} fill="#2d2258" />
        </g>
      );
    case "sad":
      return (
        <g>
          <circle cx={84} cy={74} r={4.5} fill="#2d2258" />
          <circle cx={116} cy={74} r={4.5} fill="#2d2258" />
          <path
            d="M78 64 L92 68"
            stroke="#2d2258"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <path
            d="M122 64 L108 68"
            stroke="#2d2258"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <path
            d="M90 92 Q100 84 110 92"
            stroke="#2d2258"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={122} cy={84} r={2.5} fill="#7dd3fc" />
        </g>
      );
  }
}
