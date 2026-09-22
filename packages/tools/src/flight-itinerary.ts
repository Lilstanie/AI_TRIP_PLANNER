import type { FlightLeg, FlightSegment } from "@trip/shared";

/**
 * Turning Google Flights' own shape into this project's.
 *
 * Kept apart from the search so the parsing can be tested against recorded
 * provider shapes without spending the monthly search allowance on it.
 */

interface RawAirport {
  name?: unknown;
  id?: unknown;
  time?: unknown;
}
interface RawSegment {
  departure_airport?: RawAirport;
  arrival_airport?: RawAirport;
  duration?: unknown;
  airline?: unknown;
  airline_logo?: unknown;
  flight_number?: unknown;
  airplane?: unknown;
  travel_class?: unknown;
}
interface RawLayover {
  id?: unknown;
  name?: unknown;
  duration?: unknown;
}
export interface RawItinerary {
  flights?: RawSegment[];
  layovers?: RawLayover[];
  total_duration?: unknown;
  price?: unknown;
  type?: unknown;
  departure_token?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const minutes = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

function place(raw: RawAirport | undefined) {
  const code = text(raw?.id);
  const name = text(raw?.name);
  return code && name ? { code, name } : undefined;
}

function segment(raw: RawSegment): FlightSegment | undefined {
  const from = place(raw.departure_airport);
  const to = place(raw.arrival_airport);
  const departsAt = text(raw.departure_airport?.time);
  const arrivesAt = text(raw.arrival_airport?.time);
  const durationMin = minutes(raw.duration);
  const airline = text(raw.airline);
  const flightNumber = text(raw.flight_number);
  // Every one of these appears on a boarding pass. A segment missing any of
  // them cannot be shown as a flight, so it is dropped rather than rendered
  // with a blank where a gate or a time belongs.
  if (!from || !to || !departsAt || !arrivesAt || !durationMin || !airline || !flightNumber)
    return undefined;
  const logo = text(raw.airline_logo);
  return {
    from,
    to,
    departsAt,
    arrivesAt,
    durationMin,
    airline,
    flightNumber,
    ...(logo?.startsWith("http") ? { airlineLogo: logo } : {}),
    ...(text(raw.airplane) ? { aircraft: text(raw.airplane) } : {}),
    ...(text(raw.travel_class) ? { cabin: text(raw.travel_class) } : {}),
  };
}

/** One direction of an itinerary, or undefined when the provider's shape is unusable. */
export function legFrom(raw: RawItinerary): FlightLeg | undefined {
  const segments = (raw.flights ?? []).map(segment).filter((value): value is FlightSegment => !!value);
  if (!segments.length || segments.length !== (raw.flights ?? []).length) return undefined;
  const layovers = (raw.layovers ?? []).flatMap((stop) => {
    const stopPlace = place({ id: stop.id, name: stop.name });
    const durationMin = minutes(stop.duration);
    return stopPlace && durationMin ? [{ place: stopPlace, durationMin }] : [];
  });
  // Prefer the provider's own total; fall back to the segments plus the waits
  // between them, which is the same number when both are present.
  const total =
    minutes(raw.total_duration) ??
    segments.reduce((sum, leg) => sum + leg.durationMin, 0) +
      layovers.reduce((sum, stop) => sum + stop.durationMin, 0);
  return { segments, layovers, durationMin: total };
}

export const isRoundTrip = (raw: RawItinerary): boolean => text(raw.type) === "Round trip";
export const departureToken = (raw: RawItinerary): string | undefined => text(raw.departure_token);
