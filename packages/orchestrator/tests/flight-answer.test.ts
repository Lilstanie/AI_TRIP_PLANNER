import { describe, it, expect, vi } from "vitest";
import { answerFlightQuery } from "../src/flight-answer";
import type { BookingPort } from "@trip/shared";

const query = {
  from: "Sydney",
  to: "Seoul",
  depart: "2026-11-25",
  passengers: 2,
  cheapestFirst: true,
};
const booking = (searchFlights: BookingPort["searchFlights"]): BookingPort => ({
  searchFlights,
  searchStays: vi.fn(async () => []),
});

describe("answerFlightQuery", () => {
  it("returns fares cheapest first and names the cheapest in the reply", async () => {
    const answer = await answerFlightQuery(
      query,
      booking(async () => [
        { carrier: "Qantas", price: 980, stops: 0, durationMin: 620 },
        { carrier: "Jetstar", price: 367, stops: 1 },
        { carrier: "Korean Air", price: 720 },
      ]),
    );
    expect(answer.options.map((o) => o.carrier)).toEqual(["Jetstar", "Korean Air", "Qantas"]);
    expect(answer.reply).toContain("Jetstar");
    expect(answer.reply).toContain("367");
    // Whole-party framing is stated, never left for the reader to assume.
    expect(answer.reply).toMatch(/whole-party/i);
  });

  it("calls the provider once, with exactly what was asked", async () => {
    const searchFlights = vi.fn(async () => []);
    await answerFlightQuery({ ...query, return: "2026-12-02" }, booking(searchFlights));
    expect(searchFlights).toHaveBeenCalledTimes(1);
    expect(searchFlights).toHaveBeenCalledWith({
      from: "Sydney",
      to: "Seoul",
      depart: "2026-11-25",
      return: "2026-12-02",
      passengers: 2,
    });
  });

  it("reports a provider failure instead of inventing a price", async () => {
    const answer = await answerFlightQuery(
      query,
      booking(async () => {
        throw new Error("no mapping for Wagga Wagga");
      }),
    );
    expect(answer.options).toEqual([]);
    expect(answer.reply).toContain("no mapping for Wagga Wagga");
    expect(answer.reply).not.toMatch(/\bA\$\d/);
  });

  it("says so plainly when the provider had nothing", async () => {
    const answer = await answerFlightQuery(query, booking(async () => []));
    expect(answer.options).toEqual([]);
    expect(answer.reply).toMatch(/No fares/i);
  });

  it("drops fares a provider returned malformed", async () => {
    const answer = await answerFlightQuery(
      query,
      booking(async () => [
        { carrier: "", price: 100 },
        { carrier: "Real Air", price: Number.NaN },
        { carrier: "Good Air", price: 500 },
      ]),
    );
    expect(answer.options.map((o) => o.carrier)).toEqual(["Good Air"]);
  });
});
