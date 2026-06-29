import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Unit } from "../data/metrics";

interface UnitCtx {
  unit: Unit;
  setUnit: (u: Unit) => void;
  toggle: () => void;
}

const Ctx = createContext<UnitCtx | null>(null);
const KEY = "wr.unit";

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<Unit>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === "lb" ? "lb" : "kg";
  });

  useEffect(() => {
    localStorage.setItem(KEY, unit);
  }, [unit]);

  const value = useMemo<UnitCtx>(
    () => ({ unit, setUnit, toggle: () => setUnit((u) => (u === "kg" ? "lb" : "kg")) }),
    [unit],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnit(): UnitCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUnit must be used within UnitProvider");
  return ctx;
}
