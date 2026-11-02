import { describe, expect, it } from "vitest";
import type { AgentProposal } from "@trip/shared";
import { scopedItineraryEdit } from "../src/planning/edit-scope";

const plan = (stops: [number, string][]): AgentProposal => ({
  agent: "itinerary",
  summary: "plan",
  items: stops.map(([day, location]) => ({
    kind: "activity",
    day,
    location,
    startTime: "10:00",
    detail: location,
  })),
  assumptions: [],
  conflictsWith: [],
});

describe("an edit to named days", () => {
  const before = plan([
    [1, "Gardens"],
    [2, "Beach"],
    [3, "Lookout"],
  ]);

  it("keeps the day's stops when every new stop repeats a kept day", () => {
    const after = plan([
      [1, "Gardens"],
      [2, "Beach"],
      [3, "Gardens"],
      [3, "Beach"],
    ]);
    expect(scopedItineraryEdit(before, after, [3]).items.map(({ location }) => location)).toEqual([
      "Gardens",
      "Beach",
      "Lookout",
    ]);
  });

  it("uses the new stops when the edit brought any", () => {
    const after = plan([
      [3, "Beach"],
      [3, "Bungy"],
    ]);
    expect(scopedItineraryEdit(before, after, [3]).items.map(({ location }) => location)).toEqual([
      "Gardens",
      "Beach",
      "Bungy",
    ]);
  });
});
