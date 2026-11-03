import { describe, expect, it } from "vitest";
import { constraintCopy } from "@/lib/chat/constraint-copy";

const fromOrchestrator = [
  "make the route geographically feasible",
  "cut accommodation cost by A$120.00, to at most A$960.00",
  "schedule destination activities after arrival on day 1 at 14:30",
  "on day 2 keep clear of 09:30-12:00, held by itinerary (巴厘岛); reschedule without changing trip dates",
  "on day 3 keep clear of 18:00-19:30, held by dining; reschedule without changing trip dates",
  "raise the budget to at least A$4,200.00 (from the options found, before activities and meals), or change dates, origin or destination",
];

describe("constraintCopy", () => {
  it("translates every coordinator constraint template into Chinese", () => {
    for (const constraint of fromOrchestrator)
      expect(constraintCopy(constraint, "zh")).not.toMatch(/[a-z]{3,}/);
  });

  it("keeps English constraints and unknown text as written", () => {
    expect(constraintCopy(fromOrchestrator[0]!, "en")).toBe(fromOrchestrator[0]);
    expect(constraintCopy("keep the beach day", "zh")).toBe("keep the beach day");
  });
});
