import { describe, expect, it } from "vitest";
import type { AgentLabRunEvent } from "@trip/shared";
import { eventCopy } from "@/lib/agent-lab/event-copy";

const conflictEvent = (targetSaving?: number) =>
  ({
    event: {
      type: "lab_conflict_detected",
      round: 1,
      score: 400,
      infeasible: false,
      conflicts: [
        {
          agent: "accommodation",
          reason: "Stays exceed their share of the budget",
          ...(targetSaving === undefined ? {} : { targetSaving }),
        },
      ],
      summary: "One conflict",
    },
  }) as unknown as AgentLabRunEvent;

describe("conflict copy", () => {
  it("states the saving target in whole Australian dollars", () => {
    expect(eventCopy(conflictEvent(1412.5)).list?.lines).toEqual([
      "accommodation: Stays exceed their share of the budget (asked to save A$1,413)",
    ]);
  });

  it("adds no saving note when the conflict has no target", () => {
    expect(eventCopy(conflictEvent()).list?.lines).toEqual([
      "accommodation: Stays exceed their share of the budget",
    ]);
  });
});
