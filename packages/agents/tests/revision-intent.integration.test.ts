import { mkdir, writeFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import {
  AgentProposal,
  type AgentContext,
  type RevisionRequest,
  type TripBrief,
} from "@trip/shared";
import { transportAgent } from "../src/transport";
import { accommodationAgent } from "../src/accommodation";
import { createDiningAgent } from "../src/dining";
import { runWithModelsDisabled } from "../src/models";

const brief: TripBrief = {
  tripId: "revision-intent",
  userId: "traveller",
  origin: "Sydney",
  destination: "Tokyo & Kyoto",
  dates: ["2026-12-10", "2026-12-12"],
  groupSize: 2,
  budgetTotal: 10000,
};
const context: AgentContext = {
  tripId: brief.tripId,
  round: 2,
  tools: {
    booking: {
      searchFlights: async () => [
        { carrier: "Economy", price: 1200 },
        { carrier: "Flexible", price: 1600 },
      ],
      searchStays: async () => [
        {
          name: "Standard",
          area: "Central",
          pricePerNight: 100,
          rating: 8.7,
          freeCancellation: true,
        },
        { name: "Economy", area: "Outer", pricePerNight: 60, rating: 7.6, freeCancellation: false },
      ],
    },
    maps: {
      route: async () => [{ mode: "train", durationMin: 140, price: 90, note: "fixture" }],
      places: async () => [],
    },
  },
  mem: {
    getLongTerm: async () => [],
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    setLongTerm: async () => {},
    promote: async () => {},
  },
};
type Scenario = {
  name: string;
  revision?: Pick<RevisionRequest, "kind" | "reason" | "constraints" | "targetSaving">;
  budget: boolean;
  schedule: boolean;
};
const scenarios: Scenario[] = [
  { name: "initial planning", budget: false, schedule: false },
  {
    name: "unrelated request",
    revision: { kind: "request", reason: "keep the confirmed preferences", constraints: [] },
    budget: false,
    schedule: false,
  },
  {
    name: "typed budget without keywords",
    revision: {
      kind: "budget",
      reason: "the total exceeds the agreed limit",
      constraints: [],
      targetSaving: 100,
    },
    budget: true,
    schedule: false,
  },
  {
    name: "typed budget ignores schedule wording",
    revision: { kind: "budget", reason: "time overlap", constraints: [] },
    budget: true,
    schedule: false,
  },
  {
    name: "typed time without keywords",
    revision: { kind: "time", reason: "the journey clashes with another stop", constraints: [] },
    budget: false,
    schedule: true,
  },
  ...(["time", "geography", "infeasible"] as const).map((kind) => ({
    name: `typed ${kind} ignores budget wording and targetSaving`,
    revision: {
      kind,
      reason: "cost overrun",
      constraints: ["cut budget; reduce cost; cheaper schedule"],
      targetSaving: 100,
    },
    budget: false,
    schedule: kind === "time",
  })),
  ...["budget", "cost", "cheaper", "overrun", "cut", "reduce"].flatMap((word) => [
    {
      name: `request reason: ${word}`,
      revision: { kind: "request" as const, reason: word, constraints: [] },
      budget: true,
      schedule: false,
    },
    {
      name: `request constraint: ${word}`,
      revision: { kind: "request" as const, reason: "please revise", constraints: [word] },
      budget: true,
      schedule: false,
    },
  ]),
  {
    name: "request schedule reason",
    revision: { kind: "request", reason: "time overlap", constraints: [] },
    budget: false,
    schedule: true,
  },
  {
    name: "request schedule constraint",
    revision: { kind: "request", reason: "please revise", constraints: ["reschedule"] },
    budget: false,
    schedule: true,
  },
  {
    name: "mixed traveller request",
    revision: { kind: "request", reason: "cheaper and earlier schedule", constraints: [] },
    budget: true,
    schedule: true,
  },
];
const observations: unknown[] = [];
afterAll(async () => {
  const directory = new URL("../../../output/revision-intent/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("proposals.json", directory),
    JSON.stringify({ brief, observations }, null, 2),
  );
});

describe("revision intent through specialist proposals", () => {
  it.each(scenarios)("$name", async ({ name, revision, budget, schedule }) => {
    const specialists = [
      transportAgent,
      accommodationAgent,
      createDiningAgent({ generator: false }),
    ];
    const proposals = await runWithModelsDisabled(() =>
      Promise.all(
        specialists.map((specialist) =>
          specialist.invoke({
            brief,
            context,
            ...(revision
              ? { revision: { ...revision, tripId: brief.tripId, targetAgent: specialist.name } }
              : {}),
          }),
        ),
      ),
    );
    observations.push({ name, revision, proposals });
    for (const proposal of proposals) expect(AgentProposal.safeParse(proposal).success).toBe(true);
    const [transport, accommodation, dining] = proposals;
    expect.soft(transport!.items[0]!.estCost, "flight fare").toBe(budget ? 1200 : 1600);
    expect
      .soft(transport!.items[1]!.startTime, "ground departure")
      .toBe(schedule ? "06:00" : "09:00");
    expect
      .soft(
        accommodation!.items.reduce((sum, item) => sum + (item.estCost ?? 0), 0),
        "stay total",
      )
      .toBe(budget ? 120 : 200);
    expect.soft(dining!.items[0]!.estCost, "meal envelope").toBe(budget ? 336 : 480);
  });

  it("retains the best stay within the revised share and the allocated meal allowance", async () => {
    const revision = {
      kind: "budget" as const,
      reason: "the total exceeds the agreed limit",
      constraints: [],
      tripId: brief.tripId,
    };
    const [accommodation, dining] = await runWithModelsDisabled(() =>
      Promise.all([
        accommodationAgent.invoke({
          brief,
          context,
          revision: { ...revision, targetAgent: "accommodation" },
          allocation: { budget: 200, basis: "revised share" },
        }),
        createDiningAgent({ generator: false }).invoke({
          brief,
          context,
          revision: { ...revision, targetAgent: "dining" },
          allocation: { budget: 300, basis: "revised share" },
        }),
      ]),
    );
    observations.push({ name: "explicit allocations", proposals: [accommodation, dining] });
    expect(accommodation.items.reduce((sum, item) => sum + (item.estCost ?? 0), 0)).toBe(200);
    expect(accommodation.items.every((item) => item.detail?.includes("Standard"))).toBe(true);
    expect(dining.items[0]!.estCost).toBe(300);
  });
});
