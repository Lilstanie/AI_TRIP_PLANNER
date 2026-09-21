import { describe, it, expect } from "vitest";
import { parseTripDate, isAmbiguous } from "../src/dates";
import { extractBriefPatchLocally } from "../src/chat-offline";

describe("parseTripDate", () => {
  it("reads the shapes that cannot mean two things", () => {
    expect(parseTripDate("2026-11-02")).toEqual({ iso: "2026-11-02" });
    expect(parseTripDate("2 Nov 2026")).toEqual({ iso: "2026-11-02" });
    expect(parseTripDate("2 November 2026")).toEqual({ iso: "2026-11-02" });
    expect(parseTripDate("Nov 2 2026")).toEqual({ iso: "2026-11-02" });
    expect(parseTripDate("November 2, 2026")).toEqual({ iso: "2026-11-02" });
  });

  it("uses whichever component settles a numeric date", () => {
    // No 13th month, so this can only be day/month.
    expect(parseTripDate("13/05/2026")).toEqual({ iso: "2026-05-13" });
    // No 25th month either way round.
    expect(parseTripDate("05/25/2026")).toEqual({ iso: "2026-05-25" });
    expect(parseTripDate("13.05.2026")).toEqual({ iso: "2026-05-13" });
  });

  it("reports ambiguity rather than guessing a month", () => {
    // 2 November or 11 February? Guessing moves the trip by months and prices
    // the wrong flights, with nothing downstream to catch it.
    expect(isAmbiguous(parseTripDate("11/02/2026"))).toBe(true);
    expect(isAmbiguous(parseTripDate("01/02/2026"))).toBe(true);
  });

  it("rejects dates that are not on the calendar", () => {
    expect(parseTripDate("31/02/2026")).toBeUndefined();
    expect(parseTripDate("2026-02-31")).toBeUndefined();
    expect(parseTripDate("32/13/2026")).toBeUndefined();
    expect(parseTripDate("nonsense")).toBeUndefined();
  });
});

describe("date ranges in a sentence", () => {
  it("reads a range written in any supported shape", () => {
    for (const written of [
      "2026-11-02 to 2026-11-06",
      "2 Nov 2026 to 6 Nov 2026",
      "Nov 2, 2026 until Nov 6, 2026",
      "13/05/2026 to 20/05/2026",
    ]) {
      const patch = extractBriefPatchLocally(`Plan a trip to Seoul for 2 people ${written}`);
      expect(patch.dates, written).toHaveLength(2);
      expect(patch.destination, written).toBe("Seoul");
    }
  });

  it("leaves an ambiguous range unset so the assistant asks", () => {
    const patch = extractBriefPatchLocally(
      "Plan a trip to Seoul for 2 people 11/02/2026 to 11/06/2026",
    );
    expect(patch.destination).toBe("Seoul");
    expect(patch.dates).toBeUndefined();
  });
});
