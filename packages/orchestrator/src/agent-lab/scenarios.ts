import { parisFamilyInfeasible } from "./paris-family";
import { tokyoKyotoMultiCity } from "./tokyo-kyoto";
import { TripBrief, TripPlan, type AgentLabScenarioId, type UserPreference } from "@trip/shared";

export interface AgentLabScenarioRules {
  earliestStartTime: string;
  vegetarianMeals: boolean;
  sectionCount: number;

  infeasibleBudget?: { minimumSupportedCost: number };
}

export interface AgentLabScenario {
  id: AgentLabScenarioId;
  title: string;
  summary: string;
  fixtureVersion: string;
  brief: TripBrief;
  rules: AgentLabScenarioRules;
  expectedOutcome: "complete" | "partial" | "safe-stop";
  mustPassCheckIds: readonly string[];

  preferences: UserPreference[];
  fixturePlan: TripPlan;
}

const tokyoBrief: TripBrief = {
  tripId: "agent-lab-tokyo-couple",
  userId: "agent-lab",
  destination: "Tokyo",
  origin: "Sydney",
  dates: ["2026-11-10", "2026-11-14"],
  groupSize: 2,
  budgetTotal: 6000,
  preferences: ["Vegetarian food", "No early starts"],
};

function scriptedBaselinePlan(brief: TripBrief): TripPlan {
  const nights = Math.round(
    (Date.parse(`${brief.dates[1]}T00:00:00Z`) - Date.parse(`${brief.dates[0]}T00:00:00Z`)) /
      86_400_000,
  );
  const stayCost = nights * 380;
  const diningCost = nights * 160;
  const dinnerCost = nights * 120;
  const cafeCost = nights * 40;
  const estTotal = 1800 + stayCost + diningCost;
  const itineraryDays = nights + 1;
  const nightLabel = nights === 1 ? "night" : "nights";
  const dayLabel = itineraryDays === 1 ? "day" : "days";
  const activities = [
    {
      kind: "activity" as const,
      detail: "Meiji Shrine and Harajuku walk",
      day: 1,
      startTime: "10:30",
      endTime: "13:00",
      location: "Meiji Shrine",
    },
    {
      kind: "activity" as const,
      detail: "Asakusa and Sumida riverside",
      day: 2,
      startTime: "10:00",
      endTime: "14:00",
      location: "Asakusa",
    },
    {
      kind: "activity" as const,
      detail: "Ueno museums and park",
      day: 3,
      startTime: "10:30",
      endTime: "15:00",
      location: "Ueno Park",
    },
    {
      kind: "activity" as const,
      detail: "Shibuya and Daikanyama afternoon",
      day: 4,
      startTime: "11:00",
      endTime: "17:00",
      location: "Shibuya",
    },
  ].slice(0, itineraryDays);
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
        summary: `${itineraryDays} relaxed Tokyo ${dayLabel} with neighbourhoods grouped to limit backtracking.`,
        estCost: 0,
        proposal: {
          agent: "itinerary",
          summary: `${itineraryDays} relaxed Tokyo ${dayLabel} with neighbourhoods grouped to limit backtracking.`,
          items: activities,
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
        summary: `${nights} ${nightLabel} in Shinjuku with straightforward rail access.`,
        estCost: stayCost,
        proposal: {
          agent: "accommodation",
          summary: `${nights} ${nightLabel} in Shinjuku with straightforward rail access.`,
          items: [
            {
              kind: "hotel",
              detail: `Shinjuku hotel fixture · ${nights} ${nightLabel} · one room`,
              estCost: stayCost,
              day: 1,
              location: "Shinjuku",
            },
          ],
          assumptions: ["A$380 per room per night in the deterministic fixture."],
          conflictsWith: [],
          floorCost: stayCost,
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
        summary: `Vegetarian-friendly meals for ${nights} ${nightLabel}.`,
        estCost: diningCost,
        proposal: {
          agent: "dining",
          summary: `Vegetarian-friendly meals for ${nights} ${nightLabel}.`,
          items: [
            {
              kind: "meal",
              detail: `${nights} vegetarian-friendly dinner ${nights === 1 ? "allowance" : "allowances"} for two travellers`,
              estCost: dinnerCost,
              day: 1,
              location: "Tokyo",
            },
            {
              kind: "meal",
              detail: "Vegetarian-friendly lunch and café allowance",
              estCost: cafeCost,
              day: Math.min(nights, 2),
              location: "Tokyo",
            },
          ],
          assumptions: ["Fixture meal costs are A$ estimates for the whole travelling party."],
          conflictsWith: [],
          floorCost: diningCost,
          source: { kind: "mock", label: "Agent Lab fixture", freshness: "Fixed scenario v1" },
        },
      },
    ],
    conflicts: [],
  });
}

const rules: AgentLabScenarioRules = {
  earliestStartTime: "10:00",
  vegetarianMeals: true,
  sectionCount: 5,
};

const preferences: UserPreference[] = [
  { key: "dietary", value: "vegetarian", source: "filter" },
  { key: "schedule", value: "no early starts", source: "filter" },
];

const tokyoBenchmarkBase: AgentLabScenario = {
  id: "tokyo-couple",
  title: "Tokyo couple",
  summary: "A five-day trip from Sydney for two travellers with a A$6,000 budget.",
  fixtureVersion: "tokyo-couple-v1",
  brief: tokyoBrief,
  rules,
  preferences,
  fixturePlan: scriptedBaselinePlan(tokyoBrief),
  expectedOutcome: "complete",
  mustPassCheckIds: ["sections", "destination"],
};

const tightBrief: TripBrief = {
  ...tokyoBrief,
  tripId: "agent-lab-tokyo-couple-tight-budget",
  budgetTotal: 2300,
};

export const agentLabScenarios: readonly AgentLabScenario[] = [
  {
    ...tokyoBenchmarkBase,
  },
  {
    id: "tokyo-couple-tight-budget",
    title: "Tokyo couple, tight budget",
    summary:
      "The same trip with a A$2,300 budget: the first plan overruns, but the cheapest options fit.",
    fixtureVersion: "tokyo-couple-tight-budget-v1",
    brief: tightBrief,
    rules,
    preferences,
    fixturePlan: scriptedBaselinePlan(tightBrief),
    expectedOutcome: "partial",
    mustPassCheckIds: ["sections", "destination"],
  },
  {
    ...parisFamilyInfeasible,
    expectedOutcome: "safe-stop",
    mustPassCheckIds: ["sections", "destination", "evidence-floor", "infeasibility-reported"],
  },
  {
    ...tokyoKyotoMultiCity,
    expectedOutcome: "complete",
    mustPassCheckIds: [
      "sections",
      "destination",
      "hop-date",
      "itinerary-by-city",
      "stay-transition",
      "trip-dates",
      "total-consistent",
    ],
  },
  scenarioVariant({
    id: "tokyo-couple-explicit-budget",
    title: "Tokyo with an explicit budget",
    baseBrief: tokyoBrief,
    changes: { budgetTotal: 6000 },
  }),
  scenarioVariant({
    id: "tokyo-couple-infeasible-budget",
    title: "Tokyo, below the evidence floor",
    baseBrief: tokyoBrief,
    changes: { budgetTotal: 1700 },
    expectedOutcome: "safe-stop",
  }),
  scenarioVariant({
    id: "tokyo-conflicting-preferences",
    title: "Tokyo with conflicting food preferences",
    baseBrief: tokyoBrief,
    changes: { preferences: ["vegetarian meals", "local meat specialties"] },
  }),
  scenarioVariant({
    id: "tokyo-date-night-edge",
    title: "Tokyo, one-night edge case",
    baseBrief: tokyoBrief,
    changes: { dates: ["2026-11-10", "2026-11-11"] },
  }),
  scenarioVariant({
    id: "tokyo-vague-brief",
    title: "Tokyo with a vague brief",
    baseBrief: tokyoBrief,
    changes: { preferences: ["something relaxing", "good local food"] },
  }),
  scenarioVariant({
    id: "tokyo-short-window",
    title: "Tokyo, four-day planning window",
    baseBrief: tokyoBrief,
    changes: { dates: ["2026-11-10", "2026-11-13"] },
  }),
  scenarioVariant({
    id: "paris-family-feasible",
    title: "Paris family with a feasible budget",
    baseBrief: parisFamilyInfeasible.brief,
    changes: { budgetTotal: 6500 },
    expectedOutcome: "complete",
    source: parisFamilyInfeasible,
  }),
  scenarioVariant({
    id: "kyoto-multi-city-tight-budget",
    title: "Tokyo and Kyoto with a tight budget",
    baseBrief: tokyoKyotoMultiCity.brief,
    changes: { budgetTotal: 4200 },
    expectedOutcome: "complete",
    source: tokyoKyotoMultiCity,
  }),
];

type ScenarioVariantConfig = {
  id: AgentLabScenarioId;
  title: string;
  baseBrief: TripBrief;
  changes: Partial<TripBrief>;
  expectedOutcome?: AgentLabScenario["expectedOutcome"];
  source?: AgentLabScenario;
};

function scenarioVariant({
  id,
  title,
  baseBrief,
  changes,
  expectedOutcome = "complete",
  source,
}: ScenarioVariantConfig): AgentLabScenario {
  const base = source ?? tokyoBenchmarkBase;
  const brief = TripBrief.parse({ ...baseBrief, ...changes, tripId: `agent-lab-${id}` });
  const sourcePlan = !source && changes.dates ? scriptedBaselinePlan(brief) : base.fixturePlan;
  const fixturePlan = TripPlan.parse({
    ...sourcePlan,
    tripId: brief.tripId,
    brief,
    budgetTotal: brief.budgetTotal,
    overrunPct: ((sourcePlan.estTotal - brief.budgetTotal) / brief.budgetTotal) * 100,
  });
  const scenarioRules =
    id === "paris-family-feasible"
      ? (Object.fromEntries(
          Object.entries(base.rules).filter(([key]) => key !== "infeasibleBudget"),
        ) as AgentLabScenarioRules)
      : base.rules;
  return {
    ...base,
    id,
    title,
    summary: `Versioned benchmark scenario: ${title.toLowerCase()}.`,
    fixtureVersion: `${id}-v1`,
    brief,
    rules: scenarioRules,
    fixturePlan,
    expectedOutcome,
    mustPassCheckIds: ["sections", "destination"],
  };
}

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
