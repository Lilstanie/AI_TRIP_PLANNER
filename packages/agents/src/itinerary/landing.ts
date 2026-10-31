import {
  inboundDeparture,
  outboundArrival,
  type AgentProposal,
  type TripBrief,
} from "@trip/shared";
import type { TransferWindow } from "./transfer-windows";

export interface Landing {
  day: number;
  time: string;
  earliestStart?: string;
}

const AIRPORT_EXIT_MINUTES = 90;
const LAST_ARRIVAL_DAY_START = 17 * 60 + 30;
const ARRIVAL_STOP_MINUTES = 150;
const AIRPORT_CHECK_IN_MINUTES = 180;
const FIRST_DEPARTURE_DAY_END = 10 * 60 + 30;

export interface Departure {
  day: number;
  time: string;
  latestEnd?: string;
}

export function departureFor(
  brief: TripBrief,
  proposals: readonly AgentProposal[],
): Departure | undefined {
  const flight = inboundDeparture(brief, proposals);
  if (!flight) return undefined;
  const latest = minutes(flight.time) - AIRPORT_CHECK_IN_MINUTES;
  return latest >= FIRST_DEPARTURE_DAY_END ? { ...flight, latestEnd: clock(latest) } : flight;
}

export function departureWindow(departure: Departure, city: string): TransferWindow {
  return {
    day: departure.day,
    from: city,
    to: "home",
    startTime: departure.latestEnd ?? "00:00",
    endTime: "23:59",
  };
}

export function departureNote(departure: Departure): string {
  return departure.latestEnd
    ? `The return flight leaves on day ${departure.day} at ${departure.time}; stops that day end by ${departure.latestEnd}, leaving time to reach the airport.`
    : `The return flight leaves on day ${departure.day} at ${departure.time}; no stop is planned that day.`;
}

export function landingFor(
  brief: TripBrief,
  proposals: readonly AgentProposal[],
): Landing | undefined {
  const arrival = outboundArrival(brief, proposals);
  if (!arrival) return undefined;
  const earliest = minutes(arrival.time) + AIRPORT_EXIT_MINUTES;
  return earliest <= LAST_ARRIVAL_DAY_START
    ? { ...arrival, earliestStart: clock(earliest) }
    : arrival;
}

function clock(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function beforeLanding(
  activity: { day: number; startTime: string },
  landing: Landing | undefined,
): boolean {
  if (!landing || activity.day > landing.day) return false;
  if (activity.day < landing.day || !landing.earliestStart) return true;
  return minutes(activity.startTime) < minutes(landing.earliestStart);
}

export function landingNote(landing: Landing): string {
  return landing.earliestStart
    ? `The outbound flight lands on day ${landing.day} at ${landing.time}; stops start from ${landing.earliestStart}, leaving time to clear the airport, and earlier days are spent travelling.`
    : `The outbound flight lands on day ${landing.day} at ${landing.time}; no stop is planned before day ${landing.day + 1}.`;
}

export function arrivalSlots(
  slots: ReadonlyArray<{ startTime: string; endTime: string }>,
  landing: Landing,
): Array<{ startTime: string; endTime: string }> {
  const earliest = minutes(landing.earliestStart!);
  const later = slots.filter((slot) => minutes(slot.startTime) >= earliest);
  return later.length
    ? later
    : [{ startTime: landing.earliestStart!, endTime: clock(earliest + ARRIVAL_STOP_MINUTES) }];
}

export function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour! * 60 + minute!;
}
