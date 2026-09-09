import { describe, expect, it } from "vitest";
import { SavedTrip, TripListResponse, TripSession } from "./trip";

const plan = {
  tripId: "trip-sydney",
  planVersion: "plan-v1",
  brief: {
    tripId: "trip-sydney",
    userId: "demo-user",
    destination: "Sydney",
    dates: ["2026-10-01", "2026-10-05"],
    groupSize: 2,
    budgetTotal: 3000,
  },
  round: 1,
  budgetTotal: 3000,
  estTotal: 1800,
  overrunPct: -40,
  sections: [],
  hitl: [],
};

describe("saved-trip contracts", () => {
  it("accepts a saved latest plan and its restored conversation", () => {
    const trip = SavedTrip.parse({
      tripId: "trip-sydney",
      userId: "demo-user",
      title: "Sydney",
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:01:00.000Z",
      plan,
    });

    expect(
      TripSession.parse({
        trip,
        turns: [
          { role: "user", content: "Plan Sydney" },
          { role: "assistant", content: "Your plan is ready." },
        ],
      }).turns,
    ).toHaveLength(2);
    expect(
      TripListResponse.parse({
        trips: [{ ...trip, plan: undefined, destination: "Sydney", planVersion: "plan-v1" }],
      }).trips[0],
    ).toMatchObject({ destination: "Sydney", planVersion: "plan-v1" });
  });

  it("allows metadata to exist while the first plan is still being generated", () => {
    expect(
      SavedTrip.parse({
        tripId: "trip-pending",
        userId: "demo-user",
        title: "Melbourne",
        createdAt: "2026-09-09T00:00:00.000Z",
        updatedAt: "2026-09-09T00:00:00.000Z",
        plan: null,
      }).plan,
    ).toBeNull();
  });
});
