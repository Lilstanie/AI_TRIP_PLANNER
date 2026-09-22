import { describe, it, expect } from "vitest";
import { legFrom, isRoundTrip, departureToken } from "../src/flight-itinerary";

/** The shape a live SYD → HND round-trip search actually returned. */
const raw = {
  flights: [
    {
      departure_airport: { name: "Sydney Airport", id: "SYD", time: "2026-11-25 11:30" },
      arrival_airport: {
        name: "Ninoy Aquino International Airport",
        id: "MNL",
        time: "2026-11-25 16:45",
      },
      duration: 495,
      airplane: "Airbus A330",
      airline: "Philippine Airlines",
      airline_logo: "https://www.gstatic.com/flights/airline_logos/70px/PR.png",
      travel_class: "Economy",
      flight_number: "PR 212",
    },
    {
      departure_airport: {
        name: "Ninoy Aquino International Airport",
        id: "MNL",
        time: "2026-11-25 19:10",
      },
      arrival_airport: { name: "Haneda Airport", id: "HND", time: "2026-11-26 00:15" },
      duration: 245,
      airline: "Philippine Airlines",
      travel_class: "Economy",
      flight_number: "PR 424",
    },
  ],
  layovers: [{ id: "MNL", name: "Ninoy Aquino International Airport", duration: 145 }],
  total_duration: 885,
  type: "Round trip",
  departure_token: "abc123",
};

describe("legFrom", () => {
  it("keeps everything a boarding pass shows", () => {
    const leg = legFrom(raw)!;
    expect(leg.segments).toHaveLength(2);
    expect(leg.segments[0]).toMatchObject({
      from: { code: "SYD", name: "Sydney Airport" },
      to: { code: "MNL" },
      departsAt: "2026-11-25 11:30",
      arrivesAt: "2026-11-25 16:45",
      durationMin: 495,
      airline: "Philippine Airlines",
      flightNumber: "PR 212",
      aircraft: "Airbus A330",
      cabin: "Economy",
    });
    expect(leg.segments[0]!.airlineLogo).toMatch(/^https:/);
    expect(leg.layovers).toEqual([
      { place: { code: "MNL", name: "Ninoy Aquino International Airport" }, durationMin: 145 },
    ]);
    expect(leg.durationMin).toBe(885);
  });

  it("falls back to segments plus waits when no total is given", () => {
    const leg = legFrom({ ...raw, total_duration: undefined })!;
    expect(leg.durationMin).toBe(495 + 245 + 145);
  });

  it("drops the whole leg when a segment is missing something a traveller needs", () => {
    // A segment with no flight number or no arrival time cannot be shown as a
    // flight, and showing the rest of the leg without it would misstate the
    // journey — so the leg is unusable, not partially usable.
    for (const broken of [
      { ...raw.flights[1], flight_number: undefined },
      { ...raw.flights[1], arrival_airport: { name: "Haneda Airport", id: "HND" } },
      { ...raw.flights[1], duration: 0 },
    ])
      expect(legFrom({ ...raw, flights: [raw.flights[0]!, broken] })).toBeUndefined();
  });

  it("has nothing to report for an empty itinerary", () => {
    expect(legFrom({})).toBeUndefined();
    expect(legFrom({ flights: [] })).toBeUndefined();
  });

  it("reads the round-trip marker and the token that fetches its return", () => {
    expect(isRoundTrip(raw)).toBe(true);
    expect(isRoundTrip({ ...raw, type: "One way" })).toBe(false);
    expect(departureToken(raw)).toBe("abc123");
    expect(departureToken({ ...raw, departure_token: "" })).toBeUndefined();
  });
});
