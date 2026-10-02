import { TripPlan, type TripBrief, type UserPreference } from "@trip/shared";
import type { AgentLabScenario } from "./scenarios";

// A family of four asks for a Paris trip they cannot afford. The same booking evidence every strategy
// sees puts the cheapest round-trip flights at A$2,480 (A$310 per traveller each way) and the cheapest
// two rooms for five nights at A$1,400, so no plan costs less than A$3,880 against a A$3,000 budget.
export const PARIS_MINIMUM_SUPPORTED_COST = 3880;

const brief: TripBrief = {
  tripId: "agent-lab-paris-family-infeasible",
  userId: "agent-lab",
  destination: "Paris",
  origin: "Sydney",
  dates: ["2026-11-10", "2026-11-15"],
  groupSize: 4,
  budgetTotal: 3000,
  preferences: ["Family friendly", "No early starts"],
};

const preferences: UserPreference[] = [
  { key: "schedule", value: "no early starts", source: "filter" },
];

const source = {
  kind: "mock",
  label: "Agent Lab fixture",
  freshness: "Fixed scenario v1",
} as const;

/**
 * The scripted single-agent recording: the cheapest options the shared evidence supports, with every
 * section present. A lone scripted agent has no conflict check, so it prices the trip honestly but
 * never says the budget cannot be met.
 */
function scriptedPlan(): TripPlan {
  const estTotal = PARIS_MINIMUM_SUPPORTED_COST;
  return TripPlan.parse({
    tripId: brief.tripId,
    brief,
    round: 1,
    budgetTotal: brief.budgetTotal,
    estTotal,
    overrunPct: ((estTotal - brief.budgetTotal) / brief.budgetTotal) * 100,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        status: "draft",
        summary:
          "Five unhurried Paris days with one anchor visit each and short walks between stops.",
        estCost: 0,
        proposal: {
          agent: "itinerary",
          summary:
            "Five unhurried Paris days with one anchor visit each and short walks between stops.",
          items: [
            {
              kind: "activity",
              detail: "Jardin du Luxembourg and the Left Bank",
              day: 1,
              startTime: "11:00",
              endTime: "15:00",
              location: "Jardin du Luxembourg",
            },
            {
              kind: "activity",
              detail: "Musée d'Orsay",
              day: 2,
              startTime: "10:30",
              endTime: "14:00",
              location: "Musée d'Orsay",
            },
            {
              kind: "activity",
              detail: "Montmartre and Sacré-Cœur",
              day: 3,
              startTime: "10:30",
              endTime: "15:00",
              location: "Montmartre",
            },
            {
              kind: "activity",
              detail: "Louvre highlights for children",
              day: 4,
              startTime: "10:00",
              endTime: "13:00",
              location: "Louvre Museum",
            },
            {
              kind: "activity",
              detail: "Champ de Mars and the Eiffel Tower",
              day: 5,
              startTime: "11:00",
              endTime: "16:00",
              location: "Champ de Mars",
            },
          ],
          assumptions: ["Admission prices are not estimated without ticket evidence."],
          conflictsWith: [],
          source,
        },
      },
      {
        id: "transport",
        label: "Getting there and around",
        status: "draft",
        summary: "Cheapest return economy flights for four travellers.",
        estCost: 2480,
        proposal: {
          agent: "transport",
          summary: "Cheapest return economy flights for four travellers.",
          items: [
            {
              kind: "flight",
              detail:
                "MockAir Economy: Sydney to Paris, returning 2026-11-15; whole-group fare; 4 passengers; round-trip group total in AUD; fictional mock fare.",
              estCost: 2480,
              day: 1,
              location: "Sydney",
            },
          ],
          assumptions: ["Fixture prices are planning evidence, not live fares."],
          conflictsWith: [],
          floorCost: 2480,
          source,
        },
      },
      {
        id: "accommodation",
        label: "Where to stay",
        status: "draft",
        summary: "Two rooms for five nights at the cheapest stay found.",
        estCost: 1400,
        proposal: {
          agent: "accommodation",
          summary: "Two rooms for five nights at the cheapest stay found.",
          items: [
            {
              kind: "hotel",
              detail:
                "Mock Paris Saver — Outer district; 2026-11-10 to 2026-11-15; 2 room(s) × 5 night(s) × AUD 140.00 per room/night = AUD 1400.00; no free cancellation.",
              estCost: 1400,
              day: 1,
              location: "Paris",
            },
          ],
          assumptions: ["Two rooms for four travellers in the deterministic fixture."],
          conflictsWith: [],
          floorCost: 1400,
          source,
        },
      },
      {
        id: "destination-guide",
        label: "Destination guide",
        status: "draft",
        summary: "Practical guidance for travelling with children in Paris.",
        estCost: 0,
        proposal: {
          agent: "destination-guide",
          summary: "Practical guidance for travelling with children in Paris.",
          items: [
            {
              kind: "note",
              detail:
                "Carry a card and a little cash, and keep children close on crowded Metro lines.",
              location: "Paris",
            },
          ],
          assumptions: ["Guidance is fixed for this engineering demonstration."],
          conflictsWith: [],
          source,
        },
      },
      {
        id: "dining",
        label: "Food",
        status: "draft",
        summary: "Family-friendly meals near each day's final stop; no meal prices are available.",
        estCost: 0,
        proposal: {
          agent: "dining",
          summary:
            "Family-friendly meals near each day's final stop; no meal prices are available.",
          items: [
            {
              kind: "meal",
              detail:
                "Family-friendly lunch near each day's anchor visit; cost not estimated without meal evidence",
              location: "Paris",
            },
          ],
          assumptions: ["The fixture evidence has no meal prices for Paris, so none are invented."],
          conflictsWith: [],
          source,
        },
      },
    ],
    conflicts: [],
  });
}

export const parisFamilyInfeasible: AgentLabScenario = {
  id: "paris-family-infeasible",
  title: "Paris family, infeasible budget",
  summary:
    "Four travellers from Sydney with A$3,000: the cheapest supported flights and stays already cost A$3,880.",
  fixtureVersion: "paris-family-infeasible-v1",
  brief,
  rules: {
    earliestStartTime: "10:00",
    vegetarianMeals: false,
    sectionCount: 5,
    infeasibleBudget: { minimumSupportedCost: PARIS_MINIMUM_SUPPORTED_COST },
  },
  preferences,
  fixturePlan: scriptedPlan(),
};
