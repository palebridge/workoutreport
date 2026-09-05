export type DateRange = { start: string; end: string };
export interface AnalysisContext {
  range: DateRange;
  comparison: DateRange | null;
  timezone: string;
  now: string;
  includeWarmups: boolean;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localDay(iso: string, timezone: string): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(iso));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function dayDistance(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
      86400000,
  );
}
export function weekStart(day: string): string {
  return addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function daysBetween(range: DateRange): string[] {
  if (range.end < range.start) return [];
  return Array.from(
    { length: dayDistance(range.start, range.end) + 1 },
    (_, i) => addDays(range.start, i),
  );
}
export function precedingRange(range: DateRange): DateRange {
  const length = dayDistance(range.start, range.end) + 1;
  return {
    start: addDays(range.start, -length),
    end: addDays(range.start, -1),
  };
}
export function inRange(
  iso: string,
  range: DateRange,
  timezone: string,
): boolean {
  const day = localDay(iso, timezone);
  return day >= range.start && day <= range.end;
}
export function displayDay(
  day: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
}
export function defaultTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
