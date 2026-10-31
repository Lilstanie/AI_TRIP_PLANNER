import type { ProposalItem, TripPlan } from "@trip/shared";
import { translate, type AppLocale } from "../i18n/locale";
import { itineraryActivities } from "./itinerary";
import { dayCount, dayRows, type TimelineRow } from "./timeline";

export const DAY_MS = 86_400_000;

export type CalendarCategory = "activity" | "flight" | "stay" | "transport";

export type CalendarEntry = {
  key: string;
  category: CalendarCategory;
  title: string;
  detail: string;
  date: string;
  day: number;
  startTime?: string;
  endTime?: string;
  activity?: ProposalItem;
  allDay: boolean;
  overlap: boolean;
};

export type CalendarDay = {
  day: number;
  date: string;
  entries: CalendarEntry[];
};

export function dateTime(date: string | undefined) {
  if (!date) return undefined;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) ? time : undefined;
}

function dateKey(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function tripDate(plan: TripPlan, day: number) {
  const start = dateTime(plan.brief.dates[0]);
  return start === undefined ? undefined : dateKey(start + (day - 1) * DAY_MS);
}

export type StaySpan = {
  key: string;
  title: string;
  column: number;
  length: number;
  nights: number;
};

export function weekStays(plan: TripPlan, days: CalendarDay[], weekDays: number[]): StaySpan[] {
  const stayOn = (time: number) => {
    const day = tripDay(plan, time);
    return day === undefined
      ? undefined
      : days[day - 1]?.entries.find((entry) => entry.category === "stay" && entry.allDay);
  };
  const nights = (title: string) =>
    days.filter((day) =>
      day.entries.some((entry) => entry.category === "stay" && entry.title === title),
    ).length;
  const spans: StaySpan[] = [];
  weekDays.forEach((time, column) => {
    const stay = stayOn(time);
    if (!stay) return;
    const last = spans.at(-1);
    if (last && last.title === stay.title && last.column + last.length === column) last.length += 1;
    else
      spans.push({
        key: `${stay.key}-${column}`,
        title: stay.title,
        column,
        length: 1,
        nights: nights(stay.title),
      });
  });
  return spans;
}

export function tripDay(plan: TripPlan, time: number) {
  const start = dateTime(plan.brief.dates[0]);
  if (start === undefined) return undefined;
  const day = Math.floor((time - start) / DAY_MS) + 1;
  return day >= 1 && day <= dayCount(plan) ? day : undefined;
}

export function weekStart(time: number) {
  const weekday = new Date(time).getUTCDay();
  return time - ((weekday + 6) % 7) * DAY_MS;
}

export function monthStart(time: number) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function nextMonth(time: number) {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export function weekStarts(plan: TripPlan) {
  const start = dateTime(plan.brief.dates[0]);
  const end = dateTime(plan.brief.dates[1]);
  if (start === undefined || end === undefined || start > end) return [];
  const first = weekStart(start);
  const last = weekStart(end);
  const values = [];
  for (let time = first; time <= last; time += 7 * DAY_MS) {
    values.push(time < start ? start : time);
  }
  return values;
}

export function monthStarts(plan: TripPlan) {
  const start = dateTime(plan.brief.dates[0]);
  const end = dateTime(plan.brief.dates[1]);
  if (start === undefined || end === undefined || start > end) return [];
  const last = monthStart(end);
  const values = [];
  for (let time = monthStart(start); time <= last; time = nextMonth(time)) values.push(time);
  return values;
}

function titleOf(row: TimelineRow<ProposalItem>) {
  if (row.type === "stop") return row.activity.location?.trim() || row.activity.detail;
  if (row.type === "fixed") return row.title;
  if ("from" in row.selection) return `${row.selection.from} → ${row.selection.to}`;
  const candidate = row.selection.candidates.find((value) => value.id === row.selection.selectedId);
  return (candidate && "name" in candidate ? candidate.name : undefined) ?? row.selection.city;
}

function categoryOf(row: TimelineRow<ProposalItem>): CalendarCategory {
  if (row.type === "stop") return "activity";
  if (row.type === "booking") return row.kind;
  if (row.kind === "stay") return "stay";
  return row.kind === "flight" ? "flight" : "transport";
}

function detailOf(row: TimelineRow<ProposalItem>, locale: AppLocale) {
  if (row.type === "stop") return row.activity.detail;
  if (row.type === "fixed") return row.detail;
  if (row.kind === "flight")
    return translate(locale, row.role === "out" ? "returnFlight" : "flight");
  return row.night
    ? translate(locale, "nightIndexOfTotal", {
        index: row.night.index,
        total: row.night.of,
      })
    : translate(locale, "stay");
}

function entryOf(
  row: TimelineRow<ProposalItem>,
  day: number,
  date: string,
  locale: AppLocale,
): CalendarEntry {
  const activity = row.type === "stop" ? row.activity : undefined;
  const startTime =
    row.type === "stop" ? row.activity.startTime : row.type === "fixed" ? row.startTime : undefined;
  const endTime =
    row.type === "stop" ? row.activity.endTime : row.type === "fixed" ? row.endTime : undefined;
  return {
    key: row.type === "stop" ? `activity-${row.activity.id ?? row.activity.detail}` : row.key,
    category: categoryOf(row),
    title: titleOf(row),
    detail: detailOf(row, locale),
    date,
    day,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(activity ? { activity } : {}),
    allDay: !startTime,
    overlap: false,
  };
}

function interval(entry: CalendarEntry) {
  if (!entry.startTime) return undefined;
  const [startHour, startMinute] = entry.startTime.split(":").map(Number);
  const [endHour, endMinute] = (entry.endTime ?? entry.startTime).split(":").map(Number);
  return {
    start: startHour! * 60 + startMinute!,
    end: endHour! * 60 + endMinute!,
  };
}

export function timedLayout(day: CalendarDay) {
  const items = day.entries
    .flatMap((entry) => {
      const range = entry.allDay ? undefined : interval(entry);
      if (!range) return [];
      const end = entry.endTime ? Math.max(range.end, range.start + 30) : range.start + 60;
      return [{ entry, start: range.start, end: Math.min(end, 1440), lane: 0 }];
    })
    .sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  for (const item of items) {
    const free = laneEnds.findIndex((end) => end <= item.start);
    item.lane = free < 0 ? laneEnds.length : free;
    laneEnds[item.lane] = item.end;
  }
  return { items, lanes: Math.max(1, laneEnds.length) };
}

export function calendarDays(plan: TripPlan, locale: AppLocale = "en"): CalendarDay[] {
  const scheduled = itineraryActivities(plan).filter((item) => item.day !== undefined);
  return Array.from({ length: dayCount(plan) }, (_, index) => {
    const day = index + 1;
    const date = tripDate(plan, day)!;
    const activities = scheduled.filter((item) => item.day === day);
    const entries = dayRows(plan, day, activities, locale).map((row) =>
      entryOf(row, day, date, locale),
    );
    const timed = entries.filter((entry) => !entry.allDay);
    for (const entry of timed) {
      const current = interval(entry);
      if (!current || !entry.endTime) continue;
      entry.overlap = timed.some((candidate) => {
        const other = candidate.key === entry.key ? undefined : interval(candidate);
        return (
          !!candidate.endTime && !!other && current.start < other.end && other.start < current.end
        );
      });
    }
    return { day, date, entries };
  });
}
