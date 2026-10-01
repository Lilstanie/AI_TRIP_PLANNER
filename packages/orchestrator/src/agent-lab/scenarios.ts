import { TripPlan, type AgentLabScenarioId, type TripBrief } from "@trip/shared";

// Constraints a plan for this scenario is measured against. They mirror the brief's preferences so the
// evaluator never hard-codes one scenario's facts.
export interface AgentLabScenarioRules {
  /** Earliest allowed activity start, "HH:MM". */
  earliestStartTime: string;
  vegetarianMeals: boolean;
  sectionCount: number;
}

export interface AgentLabScenario {
  id: AgentLabScenarioId;
  title: string;
  summary: string;
  fixtureVersion: string;
  brief: TripBrief;
  rules: AgentLabScenarioRules;
  fixturePlan: TripPlan;
}

const brief: TripBrief = {
  tripId: "agent-lab-tokyo-couple",
  userId: "agent-lab",
  destination: "Tokyo",
  origin: "Sydney",
  dates: ["2026-11-10", "2026-11-14"],
  groupSize: 2,
  budgetTotal: 6000,
  preferences: ["Vegetarian food", "No early starts"],
};

const fixturePlan = TripPlan.parse({
  tripId: brief.tripId,
  brief,
  round: 1,
  budgetTotal: 6000,
  estTotal: 3960,
  overrunPct: -34,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Four relaxed Tokyo days with neighbourhoods grouped to limit backtracking.",
      estCost: 0,
      proposal: {
        agent: "itinerary",
        summary: "Four relaxed Tokyo days with neighbourhoods grouped to limit backtracking.",
        items: [
          {
            kind: "activity",
            detail: "Meiji Shrine and Harajuku walk",
            day: 1,
            startTime: "10:30",
            endTime: "13:00",
            location: "Meiji Shrine",
          },
          {
            kind: "activity",
            detail: "Asakusa and Sumida riverside",
            day: 2,
            startTime: "10:00",
            endTime: "14:00",
            location: "Asakusa",
          },
          {
            kind: "activity",
            detail: "Ueno museums and park",
            day: 3,
            startTime: "10:30",
            endTime: "15:00",
            location: "Ueno Park",
          },
          {
            kind: "activity",
            detail: "Shibuya and Daikanyama afternoon",
            day: 4,
            startTime: "11:00",
            endTime: "17:00",
            location: "Shibuya",
          },
        ],
        assumptions: [
          "Activity admission prices are not estimated without ticket evidence.",
          "No day begins before 10:00, matching the registered traveller preference.",
        ],
        conflictsWith: [],
        source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
      },
    },
    {
      id: "transport",
      label: "Getting there and around",
      status: "draft",
      summary: "Return flight estimate plus airport and local transit for two travellers.",
      estCost: 1800,
      proposal: {
        agent: "transport",
        summary: "Return flight estimate plus airport and local transit for two travellers.",
        items: [
          {
            kind: "flight",
            detail: "Sydney to Tokyo return flight fixture for two travellers",
            estCost: 1680,
            day: 1,
            location: "Tokyo",
          },
          {
            kind: "transit",
            detail: "Airport transfers and local transit allowance",
            estCost: 120,
            day: 1,
            location: "Tokyo",
          },
        ],
        assumptions: ["Fixture prices are planning evidence, not live fares."],
        conflictsWith: [],
        floorCost: 1800,
        source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
      },
    },
    {
      id: "accommodation",
      label: "Where to stay",
      status: "draft",
      summary: "Four nights in Shinjuku with straightforward rail access.",
      estCost: 1520,
      proposal: {
        agent: "accommodation",
        summary: "Four nights in Shinjuku with straightforward rail access.",
        items: [
          {
            kind: "hotel",
            detail: "Shinjuku hotel fixture · four nights · one room",
            estCost: 1520,
            day: 1,
            location: "Shinjuku",
          },
        ],
        assumptions: ["A$380 per room per night in the deterministic fixture."],
        conflictsWith: [],
        floorCost: 1520,
        source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
      },
    },
    {
      id: "destination-guide",
      label: "Destination guide",
      status: "draft",
      summary: "Practical neighbourhood, etiquette and cashless-payment guidance.",
      estCost: 0,
      proposal: {
        agent: "destination-guide",
        summary: "Practical neighbourhood, etiquette and cashless-payment guidance.",
        items: [
          {
            kind: "note",
            detail: "Carry a small amount of cash and avoid peak commuter trains with luggage.",
            location: "Tokyo",
          },
        ],
        assumptions: ["Guidance is fixed for this engineering demonstration."],
        conflictsWith: [],
        source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
      },
    },
    {
      id: "dining",
      label: "Food",
      status: "draft",
      summary: "Vegetarian-friendly meals near each day's final neighbourhood.",
      estCost: 640,
      proposal: {
        agent: "dining",
        summary: "Vegetarian-friendly meals near each day's final neighbourhood.",
        items: [
          {
            kind: "meal",
            detail: "Four vegetarian-friendly dinner allowances for two travellers",
            estCost: 480,
            day: 1,
            location: "Tokyo",
          },
          {
            kind: "meal",
            detail: "Vegetarian-friendly lunch and café allowance",
            estCost: 160,
            day: 2,
            location: "Tokyo",
          },
        ],
        assumptions: ["Fixture meal costs are A$ estimates for the whole travelling party."],
        conflictsWith: [],
        floorCost: 640,
        source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
      },
    },
  ],
  conflicts: [],
});

export const agentLabScenarios: readonly AgentLabScenario[] = [
  {
    id: "tokyo-couple",
    title: "Tokyo couple",
    summary: "A five-day trip from Sydney for two travellers with a A$6,000 budget.",
    fixtureVersion: "tokyo-couple-v1",
    brief,
    rules: { earliestStartTime: "10:00", vegetarianMeals: true, sectionCount: 5 },
    fixturePlan,
  },
];

export const agentLabScenarioSummaries = agentLabScenarios.map(({ id, title, summary }) => ({
  id,
  title,
  summary,
}));

export function findAgentLabScenario(id: AgentLabScenarioId): AgentLabScenario {
  const scenario = agentLabScenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown Agent Lab scenario: ${id}`);
  return scenario;
}
