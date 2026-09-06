import { animate, useInView, useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ----------------------------------------------------------------------------
// Card shell with a gentle fade-up on first reveal
// ----------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  title,
  hint,
  accent,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  hint?: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`card ${className}`}
    >
      {(title || accent) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          </div>
          {accent}
        </header>
      )}
      {children}
    </motion.section>
  );
}

// ----------------------------------------------------------------------------
// Number that counts up when it scrolls into view
// ----------------------------------------------------------------------------

export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  duration = 1.1,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      if (ref.current) ref.current.textContent = format(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, duration, format, reducedMotion]);

  return <span ref={ref}>{format(0)}</span>;
}

// ----------------------------------------------------------------------------
// Misc primitives
// ----------------------------------------------------------------------------

export function Pill({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={`pill ${className}`} title={title}>
      {children}
    </span>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

/**
 * Tiny tooltip used by the Recharts components. The value leads (strong,
 * high-contrast) and the series name follows in secondary ink; each row is
 * keyed by a short line stroke in the series color.
 */
export function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-xs shadow-card backdrop-blur">
      {label != null && (
        <div className="mb-1 font-medium text-slate-300">{label}</div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-[2px] w-3 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="font-semibold text-white">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
          <span className="text-slate-400">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
