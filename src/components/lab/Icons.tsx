export type IconName =
  | "overview"
  | "explore"
  | "lab"
  | "journey"
  | "arrow"
  | "lock"
  | "refresh"
  | "close"
  | "info"
  | "plus"
  | "minus"
  | "chevron";
const paths: Record<IconName, string[]> = {
  overview: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  explore: ["M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14", "m15 15 6 6"],
  lab: ["M9 3h6M10 3v7L4 20h16l-6-10V3M8 14h8"],
  journey: ["m3 20 7-15 4 8 3-5 5 12H3", "m8 9 2 3 2-3"],
  arrow: ["M4 12h16m-6-6 6 6-6 6"],
  lock: ["M6 10h12v11H6z", "M8 10V6a4 4 0 0 1 8 0v4"],
  refresh: ["M20 8a8 8 0 1 0 0 8M20 3v5h-5"],
  close: ["m6 6 12 12M6 18 18 6"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7v1"],
  plus: ["M12 5v14M5 12h14"],
  minus: ["M5 12h14"],
  chevron: ["m9 5 7 7-7 7"],
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        workout<span className="text-muted">report</span>
        <sup>®</sup>
      </span>
    </span>
  );
}
