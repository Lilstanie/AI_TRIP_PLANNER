import type { DateRange } from "react-day-picker";

/** Local calendar fields, not toISOString — UTC conversion can shift the
 *  date near midnight depending on the viewer's timezone, silently sending
 *  the wrong day. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * A picked range as the two ISO date strings the rest of the app already
 * uses (Draft.start/end, TripBrief.dates) — chronologically ordered even if
 * the picker reports the two clicks backwards. Shared by every caller of
 * DateRangePicker so "how do I turn a DateRange into YYYY-MM-DD" only has
 * one implementation.
 */
export function isoDateRange(range: DateRange): { start: string; end: string } | undefined {
  if (!range.from || !range.to) return undefined;
  const [start, end] =
    range.from.getTime() <= range.to.getTime() ? [range.from, range.to] : [range.to, range.from];
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/**
 * Format a calendar-picked range into the exact "YYYY-MM-DD to YYYY-MM-DD"
 * shape `extractBriefPatchLocally` (@trip/orchestrator) already recognizes —
 * picking dates needs no backend change, it just produces the same message
 * shape a traveller could have typed by hand.
 */
export function formatTravelDatesMessage(range: DateRange): string | undefined {
  const iso = isoDateRange(range);
  return iso && `Travel dates: ${iso.start} to ${iso.end}`;
}
