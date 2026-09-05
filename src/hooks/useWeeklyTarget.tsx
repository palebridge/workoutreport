import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { readPreference, writePreference } from "./storage";

interface TargetCtx {
  target: number;
  setTarget: (n: number) => void;
}

const Ctx = createContext<TargetCtx | null>(null);
const KEY = "wr.weeklyTarget";

/** Allowed weekly session goals shown in the selector. */
export const TARGET_OPTIONS = [2, 3, 4, 5] as const;
const DEFAULT_TARGET = 3;

export function WeeklyTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<number>(() => {
    const saved = Number(readPreference(KEY));
    return TARGET_OPTIONS.includes(saved as (typeof TARGET_OPTIONS)[number])
      ? saved
      : DEFAULT_TARGET;
  });

  useEffect(() => {
    writePreference(KEY, String(target));
  }, [target]);

  const value = useMemo<TargetCtx>(() => ({ target, setTarget }), [target]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWeeklyTarget(): TargetCtx {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useWeeklyTarget must be used within WeeklyTargetProvider");
  return ctx;
}
