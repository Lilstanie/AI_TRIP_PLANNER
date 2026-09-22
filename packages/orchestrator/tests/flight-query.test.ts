import { describe, it, expect } from "vitest";
import { parseFlightQuery } from "../src/flight-query";

describe("parseFlightQuery", () => {
  it("reads the question this feature exists for", () => {
    expect(
      parseFlightQuery("what is sydney to seoul flight on 11/25/2026 on cheapest price"),
    ).toEqual({
      from: "sydney",
      to: "seoul",
      depart: "2026-11-25",
      passengers: 1,
      cheapestFirst: true,
    });
  });

  it("reads the other ways people ask", () => {
    expect(parseFlightQuery("cheapest flight from Melbourne to Tokyo on 2 Nov 2026")).toMatchObject(
      { from: "Melbourne", to: "Tokyo", depart: "2026-11-02", cheapestFirst: true },
    );
    expect(parseFlightQuery("flights Sydney to Singapore 2026-11-02 for 3 people")).toMatchObject({
      from: "Sydney",
      to: "Singapore",
      passengers: 3,
    });
    expect(parseFlightQuery("悉尼到首尔的机票 2026-11-02")).toMatchObject({
      from: "悉尼",
      to: "首尔",
      depart: "2026-11-02",
    });
  });

  it("treats a second date as the return leg", () => {
    expect(
      parseFlightQuery("flight from Sydney to Tokyo 2026-11-02 to 2026-11-09"),
    ).toMatchObject({ depart: "2026-11-02", return: "2026-11-09" });
  });

  it("leaves planning requests to the planner", () => {
    // The expensive mistake: answering one of these with a bare fare would skip
    // the itinerary, stay, dining and budget work the traveller asked for.
    expect(
      parseFlightQuery("Plan a 4-day trip to Sydney for 2 people from 2026-11-02 to 2026-11-06"),
    ).toBeUndefined();
    expect(
      parseFlightQuery("Plan a trip to Tokyo on 2026-11-02 and book the cheapest flight"),
    ).toBeUndefined();
  });

  it("leaves an edit to an open trip with the planner", () => {
    // These name a flight, two cities and a date, and are still requests to
    // change a trip rather than questions about a price.
    for (const message of [
      "change the flight from Sydney to Tokyo on 25 Nov 2026",
      "swap the flight from Sydney to Tokyo on 25 Nov 2026 for a cheaper one",
      "把 2026-11-25 悉尼到东京的机票换成更便宜的",
    ])
      expect(parseFlightQuery(message), message).toBeUndefined();
  });

  it("declines anything it cannot answer outright", () => {
    // No date: a fare needs one, so this is a conversation, not a lookup.
    expect(parseFlightQuery("what is the cheapest flight from Sydney to Seoul")).toBeUndefined();
    // No flight language at all.
    expect(parseFlightQuery("Sydney to Seoul on 2026-11-02")).toBeUndefined();
    // Nowhere to go.
    expect(parseFlightQuery("cheapest flight on 2026-11-02")).toBeUndefined();
    // Same city both ends.
    expect(parseFlightQuery("flight from Sydney to Sydney on 2026-11-02")).toBeUndefined();
    // Ambiguous date is not a usable date.
    expect(parseFlightQuery("flight Sydney to Seoul on 11/02/2026")).toBeUndefined();
  });
});
