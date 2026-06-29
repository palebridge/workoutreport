import { useUnit } from "../hooks/useUnit";

export function UnitToggle() {
  const { unit, setUnit } = useUnit();
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs font-medium">
      {(["kg", "lb"] as const).map((u) => (
        <button
          key={u}
          onClick={() => setUnit(u)}
          className={`rounded-full px-3 py-1 transition ${
            unit === u ? "bg-white/15 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
          aria-pressed={unit === u}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
