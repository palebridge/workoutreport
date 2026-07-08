import type { Insight } from "../data/metrics";
import { Card } from "./ui";

/** Computed "what should I know / do next" observations from the data. */
export function Insights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <Card title={<>🧠 Coach's Notes</>} hint="Auto-read from your training data — no AI, just arithmetic.">
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {insights.map((i) => (
          <li
            key={i.id}
            className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
          >
            <span className="mt-0.5 text-lg leading-none">{i.emoji}</span>
            <span className="text-sm leading-snug text-slate-300">{i.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
