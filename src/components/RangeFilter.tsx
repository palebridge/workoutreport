export type RangeWeeks = 0 | 4 | 12; // 0 = all time

const OPTIONS: { value: RangeWeeks; label: string }[] = [
  { value: 0, label: "All time" },
  { value: 12, label: "Last 12 weeks" },
  { value: 4, label: "Last 4 weeks" },
];

/**
 * One filter row that scopes every chart below it (dataviz rule: filters live
 * in a single row above the content, never inside a chart card).
 */
export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeWeeks;
  onChange: (v: RangeWeeks) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        Analysis
      </span>
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`rounded-full px-3 py-1.5 transition ${
              value === o.value ? "bg-white/15 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className="hidden flex-1 border-t border-white/5 sm:block" />
    </div>
  );
}
