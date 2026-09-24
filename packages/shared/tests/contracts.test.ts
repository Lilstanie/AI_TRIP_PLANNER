import { describe, expect, it } from "vitest";
import { PartialTripBrief } from "../src/chat";
import { MAX_TRIP_PREFERENCE_LENGTH, MAX_TRIP_PREFERENCES, TripBrief } from "../src/contracts";

const brief = {
  tripId: "t",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-04"],
  groupSize: 2,
  budgetTotal: 2000,
};

describe("trip preferences", () => {
  it("is optional, so briefs saved before it existed still parse", () => {
    const parsed = TripBrief.parse(brief);
    expect(parsed.preferences).toBeUndefined();
  });

  it("keeps the traveller's own words, trimmed", () => {
    const parsed = TripBrief.parse({
      ...brief,
      preferences: ["  vegetarian food ", "No early starts"],
    });
    expect(parsed.preferences).toEqual(["vegetarian food", "No early starts"]);
  });

  it("refuses a blank entry, an overlong entry and too many entries", () => {
    expect(TripBrief.safeParse({ ...brief, preferences: [" "] }).success).toBe(false);
    expect(
      TripBrief.safeParse({
        ...brief,
        preferences: ["x".repeat(MAX_TRIP_PREFERENCE_LENGTH + 1)],
      }).success,
    ).toBe(false);
    const many = Array.from({ length: MAX_TRIP_PREFERENCES + 1 }, (_, i) => `wish ${i}`);
    expect(TripBrief.safeParse({ ...brief, preferences: many }).success).toBe(false);
  });

  it("travels in a half-built brief too", () => {
    expect(PartialTripBrief.parse({ preferences: ["Quiet hotels"] })).toEqual({
      preferences: ["Quiet hotels"],
    });
  });

  it("leaves the older nationality and accommodation fields as they were", () => {
    const parsed = TripBrief.parse({
      ...brief,
      nationality: "Australian",
      accommodation: { roomAllocation: "individual", minRating: 8, freeCancellation: true },
    });
    expect(parsed.nationality).toBe("Australian");
    expect(parsed.accommodation).toEqual({
      roomAllocation: "individual",
      minRating: 8,
      freeCancellation: true,
    });
  });
});
