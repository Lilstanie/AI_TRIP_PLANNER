import type { FlightLeg, FlightSegment } from "@trip/shared";

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

export function legFrom(raw: RawItinerary): FlightLeg | undefined {
  const segments = (raw.flights ?? [])
    .map(segment)
    .filter((value): value is FlightSegment => !!value);
  if (!segments.length || segments.length !== (raw.flights ?? []).length) return undefined;
  const layovers = (raw.layovers ?? []).flatMap((stop) => {
    const stopPlace = place({ id: stop.id, name: stop.name });
    const durationMin = minutes(stop.duration);
    return stopPlace && durationMin ? [{ place: stopPlace, durationMin }] : [];
  });

  const total =
    minutes(raw.total_duration) ??
    segments.reduce((sum, leg) => sum + leg.durationMin, 0) +
      layovers.reduce((sum, stop) => sum + stop.durationMin, 0);
  return { segments, layovers, durationMin: total };
}

export const isRoundTrip = (raw: RawItinerary): boolean => text(raw.type) === "Round trip";
export const departureToken = (raw: RawItinerary): string | undefined => text(raw.departure_token);
