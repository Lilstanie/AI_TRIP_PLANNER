import { describe, expect, it } from "vitest";
import type { AgentLabCompletedRunArtifact, TripPlan } from "@trip/shared";
import {
  findAgentLabScenario,
  measureAgentLabRun,
  recomputeAgentLabMetrics,
  runAgentLab,
} from "../src/agent-lab";

const scenario = findAgentLabScenario("tokyo-couple");
const clone = (): TripPlan => structuredClone(scenario.fixturePlan);
const measure = (plan: TripPlan, brief = plan.brief) =>
  measureAgentLabRun({ ...scenario, brief }, plan, []);
const itinerary = (plan: TripPlan) =>
  plan.sections.find((section) => section.id === "itinerary")!.proposal!;

describe("measureAgentLabRun", () => {
  it("reports usage as unavailable, never as zero", () => {
    const { usage } = measure(clone());
    expect(usage.status).toBe("unavailable");
    if (usage.status === "unavailable") expect(usage.reason).toMatch(/no model/i);
    expect(JSON.stringify(usage)).not.toMatch(/"(tokens|cost|costAud)"/);
  });

  it("counts repeated stops after the first visit, ignoring case and spacing", () => {
    const plan = clone();
    const items = itinerary(plan).items;
    expect(measure(plan).duplicateStops).toBe(0);
    items[1]!.location = "  meiji shrine ";
    items[2]!.location = "Meiji Shrine";
    expect(measure(plan).duplicateStops).toBe(2);
  });

  it("flags placeholder stops and leaves named places alone", () => {
    const plan = clone();
    expect(measure(plan).genericStops).toBe(0);
    const items = itinerary(plan).items;
    items[0]!.location = "Mock attraction near Tokyo";
    items[1]!.location = undefined;
    items[2]!.location = "Tokyo";
    expect(measure(plan).genericStops).toBe(3);
  });

  it("is not applicable to a single city and checks every city of a multi-city trip", () => {
    expect(measure(clone()).multiCityConsistent).toBeNull();
    const plan = clone();
    const brief = { ...plan.brief, destination: "Tokyo & Kyoto" };
    expect(measure(plan, brief).multiCityConsistent).toBe(false);
    const hotel = plan.sections.find((section) => section.id === "accommodation")!.proposal!;
    hotel.items.push({ kind: "hotel", detail: "Kyoto stay", estCost: 0, location: "Kyoto" });
    expect(measure(plan, brief).multiCityConsistent).toBe(false);
    itinerary(plan).items.push({
      kind: "activity",
      detail: "Fushimi Inari",
      location: "Kyoto",
      day: 5,
    });
    itinerary(plan).items[0]!.location = "Tokyo";
    hotel.items[0]!.location = "Tokyo";
    expect(measure(plan, brief).multiCityConsistent).toBe(true);
  });

  it("counts a section as grounded only when its source is evidence, not a fallback", () => {
    const plan = clone();
    expect(measure(plan).groundedSections).toBe(5);
    plan.sections[0]!.proposal!.source = {
      kind: "fallback",
      label: "Local fallback",
      freshness: "x",
    };
    plan.sections[1]!.proposal!.source = { kind: "unavailable", label: "none", freshness: "x" };
    expect(measure(plan).groundedSections).toBe(3);
  });

  it("has no stop reason without a loop", () => {
    expect(measure(clone()).stopReason).toBeNull();
  });
});

describe("recomputable metrics", () => {
  const timing = ({
    durationMs: _d,
    latencyMs: _l,
    ...rest
  }: AgentLabCompletedRunArtifact["metrics"]) => rest;
  const combos = [
    ["tokyo-couple", "single-agent-baseline"],
    ["tokyo-couple", "multi-agent-no-revision"],
    ["tokyo-couple", "multi-agent-targeted-revision"],
    ["tokyo-couple-tight-budget", "single-agent-baseline"],
    ["tokyo-couple-tight-budget", "multi-agent-no-revision"],
    ["tokyo-couple-tight-budget", "multi-agent-targeted-revision"],
  ] as const;

  it.each(combos)(
    "recomputes %s / %s from the plan and the trace alone",
    async (scenarioId, strategyId) => {
      const artifact = await runAgentLab(
        { scenarioId, strategyId, dataMode: "fixture" },
        { paceMs: 0 },
      );
      expect(recomputeAgentLabMetrics(artifact)).toEqual(timing(artifact.metrics));
    },
  );
});
