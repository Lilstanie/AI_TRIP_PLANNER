import type { FlightLeg, TripPlan } from "@trip/shared";
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

type Booking = {
  key: string;
  date: string;
  start?: string;
  end?: string;
  endDate?: string;
  summary: string;
};

function clock(value: string | undefined): string | undefined {
  return value ? /^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/.exec(value)?.[1] : undefined;
}

function flightLeg(
  key: string,
  route: string,
  carrier: string,
  date: string,
  leg: FlightLeg | undefined,
  word: string,
): Booking {
  const first = leg?.segments[0];
  const last = leg?.segments.at(-1);
  const start = clock(first?.departsAt);
  const end = clock(last?.arrivesAt);
  const sameDay = last?.arrivesAt.slice(0, 10) === date;
  return {
    key,
    date: first?.departsAt.slice(0, 10) ?? date,
    ...(start && end && sameDay ? { start, end } : {}),
    summary: `${word} ${route} · ${[carrier, first?.flightNumber].filter(Boolean).join(" ")}`,
  };
}

function bookings(plan: TripPlan, locale: "en" | "zh"): Booking[] {
  const proposal = (id: string) => plan.sections.find((section) => section.id === id)?.proposal;
  const word = locale === "zh" ? "航班" : "Flight";
  const result: Booking[] = [];
  for (const flight of proposal("transport")?.flights ?? []) {
    const chosen = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
    if (!chosen) continue;
    result.push(
      flightLeg(
        `flight-${flight.id}`,
        `${flight.from} → ${flight.to}`,
        chosen.carrier,
        flight.depart,
        chosen.outbound,
        word,
      ),
    );
    const back = chosen.inbound?.segments[0]?.departsAt.slice(0, 10);
    if (chosen.inbound && back)
      result.push(
        flightLeg(
          `flight-${flight.id}-return`,
          `${flight.to} → ${flight.from}`,
          chosen.carrier,
          back,
          chosen.inbound,
          word,
        ),
      );
  }
  for (const stay of proposal("accommodation")?.stays ?? []) {
    const chosen = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
    if (chosen)
      result.push({
        key: `stay-${stay.id}`,
        date: stay.checkIn,
        endDate: stay.checkOut,
        summary: chosen.name,
      });
  }
  return result;
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
  const booked = bookings(plan, locale);
  for (const day of days) {
    const date = dateForDay(plan.brief.dates[0], day);
    lines.push("", `${date} · ${locale === "zh" ? `第 ${day} 天` : `Day ${day}`}`);
    for (const booking of booked.filter((entry) => entry.date === date))
      lines.push(
        booking.endDate
          ? `${locale === "zh" ? "入住" : "Check in"}: ${booking.summary}`
          : `${booking.start ? `${booking.start} ` : ""}${booking.summary}`,
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

export function tripCalendar(plan: TripPlan, locale: "en" | "zh" = "en"): string {
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
  for (const booking of bookings(plan, locale)) {
    const date = booking.date.replaceAll("-", "");
    const next = new Date(`${booking.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeCalendar(`${plan.tripId}-${booking.key}@ai-trip-planner`)}`,
      `DTSTAMP:${stamp}`,
    );
    if (booking.start && booking.end)
      lines.push(
        `DTSTART:${date}T${booking.start.replace(":", "")}00`,
        `DTEND:${date}T${booking.end.replace(":", "")}00`,
      );
    else
      lines.push(
        `DTSTART;VALUE=DATE:${date}`,
        `DTEND;VALUE=DATE:${(booking.endDate ?? next.toISOString().slice(0, 10)).replaceAll("-", "")}`,
      );
    lines.push(`SUMMARY:${escapeCalendar(booking.summary)}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
