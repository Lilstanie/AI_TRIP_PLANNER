import type { TripPlan } from "@trip/shared";
import { itineraryActivities, visitingOrder } from "./itinerary";
import { stayingAt } from "./timeline";

function dateForDay(start: string, day: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0, 10);
}

function scheduled(plan: TripPlan) {
  const days =
    (Date.parse(`${plan.brief.dates[1]}T00:00:00Z`) -
      Date.parse(`${plan.brief.dates[0]}T00:00:00Z`)) /
      86400000 +
    1;
  return visitingOrder(itineraryActivities(plan)).filter(
    (item) =>
      item.day !== undefined && Number.isInteger(item.day) && item.day > 0 && item.day <= days,
  );
}

export function tripText(plan: TripPlan, locale: "en" | "zh" = "en"): string {
  const stops = scheduled(plan);
  const lines = [plan.brief.destination, `${plan.brief.dates[0]} – ${plan.brief.dates[1]}`];
  const count =
    (Date.parse(`${plan.brief.dates[1]}T00:00:00Z`) -
      Date.parse(`${plan.brief.dates[0]}T00:00:00Z`)) /
      86400000 +
    1;
  const days = Array.from({ length: Math.max(0, count) }, (_, index) => index + 1);
  for (const day of days) {
    lines.push(
      "",
      `${dateForDay(plan.brief.dates[0], day)} · ${locale === "zh" ? `第 ${day} 天` : `Day ${day}`}`,
    );
    const stay = stayingAt(plan, day);
    if (stay) lines.push(stay);
    for (const item of stops.filter((stop) => stop.day === day)) {
      const time = item.startTime && item.endTime ? `${item.startTime}–${item.endTime} ` : "";
      lines.push(
        `${time}${item.detail}${item.location && item.location !== item.detail ? ` · ${item.location}` : ""}`,
      );
      if (item.note) lines.push(item.note);
    }
  }
  const stays =
    plan.sections.find((section) => section.id === "accommodation")?.proposal?.items ?? [];
  if (stays.length)
    lines.push("", locale === "zh" ? "住宿" : "Accommodation", ...stays.map((stay) => stay.detail));
  return lines.join("\n");
}

function escapeCalendar(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r", "");
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let width = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (width + length > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += length;
  }
  return result;
}

export function tripCalendar(plan: TripPlan): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Trip Planner//Trip//EN",
    "CALSCALE:GREGORIAN",
  ];
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  for (const [index, item] of scheduled(plan).entries()) {
    const date = dateForDay(plan.brief.dates[0], item.day!).replaceAll("-", "");
    const nextDate = dateForDay(plan.brief.dates[0], item.day! + 1).replaceAll("-", "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeCalendar(`${plan.tripId}-${item.id === undefined ? `index-${index}` : `id-${item.id}`}@ai-trip-planner`)}`,
      `DTSTAMP:${stamp}`,
    );
    if (item.startTime && item.endTime) {
      lines.push(
        `DTSTART:${date}T${item.startTime.replace(":", "")}00`,
        `DTEND:${date}T${item.endTime.replace(":", "")}00`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${nextDate}`);
    }
    lines.push(`SUMMARY:${escapeCalendar(item.detail)}`);
    if (item.location) lines.push(`LOCATION:${escapeCalendar(item.location)}`);
    if (item.note) lines.push(`DESCRIPTION:${escapeCalendar(item.note)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
