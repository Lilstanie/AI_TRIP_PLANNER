import type { TripPlan } from "@trip/shared";
import { draftFor, type Snapshot } from "@/lib/workspace/workspace";
export const plan: TripPlan = {
  tripId: "test-trip",
  brief: {
    tripId: "test-trip",
    userId: "local",
    destination: "Sydney",
    dates: ["2026-10-01", "2026-10-04"],
    groupSize: 2,
    budgetTotal: 2000,
  },
  round: 1,
  budgetTotal: 2000,
  estTotal: 200,
  overrunPct: -90,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Test day plan",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Test day plan",
        items: [{ kind: "activity", detail: "Museum", estCost: 200 }],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};
export const snapshot: Snapshot = {
  version: 3,
  id: "saved-copy",
  savedAt: "2026-09-16T00:00:00Z",
  plan,
  draft: draftFor(plan.brief),
  messages: [],
  input: "unfinished",
};
