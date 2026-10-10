import type { DateRange } from "react-day-picker";

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoDateRange(range: DateRange): { start: string; end: string } | undefined {
  if (!range.from || !range.to) return undefined;
  const [start, end] =
    range.from.getTime() <= range.to.getTime() ? [range.from, range.to] : [range.to, range.from];
  return { start: toIsoDate(start), end: toIsoDate(end) };
}
