import { describe, expect, it } from "vitest";
import type { AgentProposal, TripBrief } from "@trip/shared";
import { detectConflicts, isInfeasible } from "../src/conflicts";

const brief: TripBrief = {
  tripId: "kind-test",
  userId: "user-test",
  destination: "Sydney",
  dates: ["2026-10-01", "2026-10-05"],
  groupSize: 2,
  budgetTotal: 100,
};

function proposal(
  agent: AgentProposal["agent"],
  items: AgentProposal["items"],
  extra: Partial<AgentProposal> = {},
): AgentProposal {
  return { agent, summary: agent, items, assumptions: [], conflictsWith: [], ...extra };
}

describe("revision request kinds", () => {
  it("types an over-budget request as budget", () => {
    const requests = detectConflicts(
      [
        proposal("accommodation", [{ kind: "hotel", detail: "Stay", estCost: 80 }]),
        proposal("dining", [{ kind: "meal", detail: "Dinner", estCost: 80 }]),
      ],
      brief,
    );
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((request) => request.kind === "budget")).toBe(true);
  });

  it("types an overlapping schedule as time", () => {
    const requests = detectConflicts(
      [
        proposal("itinerary", [
          {
            kind: "activity",
            detail: "Walk",
            estCost: 0,
            day: 1,
            startTime: "10:00",
            endTime: "12:00",
          },
          {
            kind: "activity",
            detail: "Tour",
            estCost: 0,
            day: 1,
            startTime: "11:00",
            endTime: "13:00",
          },
        ]),
      ],
      brief,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.kind).toBe("time");
  });

  it("types a floor above the budget as infeasible", () => {
    const requests = detectConflicts(
      [
        proposal("accommodation", [{ kind: "hotel", detail: "Stay", estCost: 120 }], {
          floorCost: 120,
        }),
      ],
      brief,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]!.kind).toBe("infeasible");
    expect(isInfeasible(requests[0]!)).toBe(true);
  });
});
