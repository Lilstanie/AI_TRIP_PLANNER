import { TripPlan, type TripBrief, type UserPreference } from "@trip/shared";
import type { AgentLabScenario } from "./scenarios";

// Seven nights from Sydney: three in Tokyo, then a train to Kyoto on 2026-11-13 and four there. The
// transport hop, the stays, the day-by-day itinerary and the total must all agree on that one move.
const brief: TripBrief = {
  tripId: "agent-lab-tokyo-kyoto-multi-city",
  userId: "agent-lab",
  destination: "Tokyo & Kyoto",
  origin: "Sydney",
  dates: ["2026-11-10", "2026-11-17"],
  groupSize: 2,
  budgetTotal: 6500,
  preferences: ["No early starts"],
};

const preferences: UserPreference[] = [
  { key: "schedule", value: "no early starts", source: "filter" },
];

const source = {
  kind: "mock",
  label: "Agent Lab fixture",
  freshness: "Fixed scenario v1",
} as const;

const tokyoDay = (day: number, detail: string, location: string) => ({
  kind: "activity",
  detail: `${detail} in Tokyo`,
  day,
  startTime: "11:00",
  endTime: "15:00",
  location: `${location}, Tokyo`,
});
const kyotoDay = (day: number, detail: string, location: string) => ({
  kind: "activity",
  detail: `${detail} in Kyoto`,
  day,
  startTime: "11:00",
  endTime: "15:00",
  location: `${location}, Kyoto`,
});

/** The scripted single-agent recording: one consistent plan around the 2026-11-13 move. */
function scriptedPlan(): TripPlan {
  const estTotal = 3930;
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
        summary: "Three Tokyo days, then four in Kyoto after the train on day four.",
        estCost: 0,
        proposal: {
          agent: "itinerary",
          summary: "Three Tokyo days, then four in Kyoto after the train on day four.",
          items: [
            tokyoDay(1, "Meiji Shrine and Harajuku walk", "Meiji Shrine"),
            tokyoDay(2, "Asakusa and the Sumida riverside", "Asakusa"),
            tokyoDay(3, "Ueno museums and park", "Ueno Park"),
            kyotoDay(4, "Fushimi Inari shrine walk", "Fushimi Inari"),
            kyotoDay(5, "Arashiyama bamboo grove and river", "Arashiyama"),
            kyotoDay(6, "Gion and Kiyomizu-dera", "Kiyomizu-dera"),
            kyotoDay(7, "Nishiki Market and the Philosopher's Path", "Nishiki Market"),
          ],
          assumptions: ["Activity admission prices are not estimated without ticket evidence."],
          conflictsWith: [],
          source,
        },
      },
      {
        id: "transport",
        label: "Getting there and around",
        status: "draft",
        summary: "Return flights for two and one train from Tokyo to Kyoto on 13 November.",
        estCost: 1770,
        proposal: {
          agent: "transport",
          summary: "Return flights for two and one train from Tokyo to Kyoto on 13 November.",
          items: [
            {
              kind: "flight",
              detail:
                "MockAir Flexible: Sydney to Tokyo, returning 2026-11-17; whole-group fare; 2 passengers; round-trip group total in AUD; fictional mock fare.",
              estCost: 1680,
              day: 1,
              location: "Sydney",
            },
            {
              kind: "transport",
              detail: "train from Tokyo to Kyoto on 2026-11-13; 140 minutes; mock Tokyo -> Kyoto.",
              estCost: 90,
              day: 4,
              startTime: "09:00",
              endTime: "11:20",
              location: "Tokyo",
            },
          ],
          assumptions: ["Fixture prices are planning evidence, not live fares."],
          conflictsWith: [],
          floorCost: 1330,
          source,
        },
      },
      {
        id: "accommodation",
        label: "Where to stay",
        status: "draft",
        summary: "Three nights in Tokyo, then four in Kyoto from the day of the train.",
        estCost: 1460,
        proposal: {
          agent: "accommodation",
          summary: "Three nights in Tokyo, then four in Kyoto from the day of the train.",
          items: [
            {
              kind: "hotel",
              detail:
                "Mock Tokyo Saver — Outer district; 2026-11-10 to 2026-11-13; 1 room(s) × 3 night(s) × AUD 220.00 per room/night = AUD 660.00; no free cancellation.",
              estCost: 660,
              day: 1,
              location: "Tokyo",
            },
            {
              kind: "hotel",
              detail:
                "Mock Kyoto Saver — Outer district; 2026-11-13 to 2026-11-17; 1 room(s) × 4 night(s) × AUD 200.00 per room/night = AUD 800.00; no free cancellation.",
              estCost: 800,
              day: 4,
              location: "Kyoto",
            },
          ],
          assumptions: ["One room for two travellers in the deterministic fixture."],
          conflictsWith: [],
          floorCost: 1460,
          source,
        },
      },
      {
        id: "destination-guide",
        label: "Destination guide",
        status: "draft",
        summary: "Practical guidance for both cities.",
        estCost: 0,
        proposal: {
          agent: "destination-guide",
          summary: "Practical guidance for both cities.",
          items: [
            {
              kind: "note",
              detail:
                "Carry a little cash in both cities and avoid peak commuter trains with luggage.",
              location: "Tokyo & Kyoto",
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
        summary: "A daily meal allowance for two across seven planning days.",
        estCost: 700,
        proposal: {
          agent: "dining",
          summary: "A daily meal allowance for two across seven planning days.",
          items: [
            {
              kind: "meal-budget",
              detail: "7 planning day(s) × 2 traveller(s) × AUD 50.00 per person/day.",
              estCost: 700,
            },
          ],
          assumptions: ["Fixture meal costs are A$ estimates for the whole travelling party."],
          conflictsWith: [],
          source,
        },
      },
    ],
    conflicts: [],
  });
}

export const tokyoKyotoMultiCity: AgentLabScenario = {
  id: "tokyo-kyoto-multi-city",
  title: "Tokyo and Kyoto, multi-city",
  summary:
    "Seven nights from Sydney with A$6,500: the train, the stays and each day's activities must agree on one move.",
  fixtureVersion: "tokyo-kyoto-multi-city-v1",
  brief,
  rules: { earliestStartTime: "10:00", vegetarianMeals: false, sectionCount: 5 },
  preferences,
  fixturePlan: scriptedPlan(),
};
