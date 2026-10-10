import { describe, expect, it } from "vitest";
import {
  AgentLabRunRequest,
  type AgentLabEventPayload,
  type AgentLabScenarioId,
  type AgentLabStrategyId,
  type TripPlan,
} from "@trip/shared";
import {
  AGENT_LAB_EVALUATOR_VERSION,
  agentLabScenarioSummaries,
  evaluateAgentLabPlan,
  findAgentLabScenario,
  runAgentLab,
} from "../src/agent-lab";

const paris = findAgentLabScenario("paris-family-infeasible");
const kyoto = findAgentLabScenario("tokyo-kyoto-multi-city");
const tokyo = findAgentLabScenario("tokyo-couple");
const clone = (plan: TripPlan): TripPlan => structuredClone(plan);
const failed = (scenario: typeof paris, plan: TripPlan) =>
  evaluateAgentLabPlan(scenario, plan)
    .checks.filter((check) => !check.passed)
    .map((check) => check.id);
const ids = (scenario: typeof paris, plan: TripPlan) =>
  evaluateAgentLabPlan(scenario, plan).checks.map((check) => check.id);
const items = (plan: TripPlan, section: string) =>
  plan.sections.find((candidate) => candidate.id === section)!.proposal!.items;
const hop = (plan: TripPlan) =>
  items(plan, "transport").find((item) => /Tokyo.*Kyoto/.test(item.detail))!;
const stay = (plan: TripPlan, city: string) =>
  items(plan, "accommodation").find((item) => item.detail.includes(city))!;
const DATES = /\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/;
const setStay = (plan: TripPlan, city: string, from: string, to: string) => {
  const item = stay(plan, city);
  item.detail = item.detail.replace(DATES, `${from} to ${to}`);
};
const setHopDate = (plan: TripPlan, date: string) => {
  const item = hop(plan);
  item.detail = item.detail.replace(/\d{4}-\d{2}-\d{2}/, date);
};

const infeasibleReport = (minimum: string) => ({
  tripId: "agent-lab-paris-family-infeasible",
  targetAgent: "transport" as const,
  reason: `infeasible budget: the cheapest flights and stays found already cost AUD ${minimum}, above the AUD 3000.00 budget`,
  constraints: [`raise the budget to at least AUD ${minimum} (from the options found)`],
});

describe("scenario registry", () => {
  it("registers both benchmark scenarios and accepts them in a run request", () => {
    const registered = agentLabScenarioSummaries.map((summary) => summary.id);
    expect(registered).toContain("paris-family-infeasible");
    expect(registered).toContain("tokyo-kyoto-multi-city");
    for (const scenarioId of ["paris-family-infeasible", "tokyo-kyoto-multi-city"]) {
      expect(
        AgentLabRunRequest.safeParse({
          scenarioId,
          strategyId: "single-agent-baseline",
          dataMode: "fixture",
        }).success,
      ).toBe(true);
    }
  });

  it("declares a supported minimum above the Paris budget", () => {
    const minimum = paris.rules.infeasibleBudget?.minimumSupportedCost ?? 0;
    expect(paris.brief.budgetTotal).toBe(3000);
    expect(paris.brief.groupSize).toBe(4);
    expect(minimum).toBeGreaterThan(paris.brief.budgetTotal);
  });
});

describe("infeasible-budget checks", () => {
  it("measures the scripted baseline as over budget without having reported the shortfall", () => {
    const result = evaluateAgentLabPlan(paris, clone(paris.fixturePlan));
    expect(result.withinBudget).toBe(false);
    expect(result.budgetHeadroom).toBeLessThan(0);
    expect(failed(paris, paris.fixturePlan)).toEqual(["infeasibility-reported"]);
  });

  it("does not count checks no strategy can meet", () => {
    expect(ids(paris, paris.fixturePlan)).not.toContain("budget");
    expect(ids(paris, paris.fixturePlan)).not.toContain("no-conflicts");
  });

  it("fails a plan priced below the cheapest supported options", () => {
    const plan = clone(paris.fixturePlan);
    plan.estTotal = 2900;
    plan.sections.find((section) => section.id === "transport")!.estCost = 1500;
    expect(failed(paris, plan)).toContain("evidence-floor");
  });

  it("passes a plan that reports the shortfall with the supported minimum", () => {
    const plan = clone(paris.fixturePlan);
    const minimum = (paris.rules.infeasibleBudget!.minimumSupportedCost as number).toFixed(2);
    plan.conflicts = [infeasibleReport(minimum)];
    expect(failed(paris, plan)).toEqual([]);
  });

  it("fails a report that names a different minimum", () => {
    const plan = clone(paris.fixturePlan);
    plan.conflicts = [infeasibleReport("3500.00")];
    expect(failed(paris, plan)).toContain("infeasibility-reported");
  });

  it("fails when the only conflict is a repairable overrun", () => {
    const plan = clone(paris.fixturePlan);
    plan.conflicts = [
      { ...infeasibleReport("3880.00"), reason: "over budget by AUD 880.00", constraints: [] },
    ];
    expect(failed(paris, plan)).toContain("infeasibility-reported");
  });

  it("fails a plan that drops a section to fit", () => {
    const plan = clone(paris.fixturePlan);
    plan.sections = plan.sections.filter((section) => section.id !== "dining");
    expect(failed(paris, plan)).toContain("sections");
  });

  it("does not apply the infeasible checks to a feasible scenario", () => {
    expect(ids(tokyo, tokyo.fixturePlan)).not.toContain("evidence-floor");
    expect(ids(tokyo, tokyo.fixturePlan)).not.toContain("infeasibility-reported");
  });
});

describe("multi-city checks", () => {
  it("passes every check for the registered fixture", () => {
    expect(failed(kyoto, kyoto.fixturePlan)).toEqual([]);
    for (const id of [
      "hop-date",
      "itinerary-by-city",
      "stay-transition",
      "trip-dates",
      "total-consistent",
    ]) {
      expect(ids(kyoto, kyoto.fixturePlan)).toContain(id);
    }
  });

  it("does not count an early train transfer as an early activity", () => {
    expect(hop(kyoto.fixturePlan).startTime).toBe("09:00");
    expect(failed(kyoto, kyoto.fixturePlan)).not.toContain("no-early-starts");
    const plan = clone(kyoto.fixturePlan);
    items(plan, "itinerary")[0]!.startTime = "07:00";
    expect(failed(kyoto, plan)).toContain("no-early-starts");
  });

  it("does not apply multi-city checks to a single-city trip", () => {
    expect(
      ids(tokyo, tokyo.fixturePlan).filter((id) => /hop|stay-trans|trip-dates/.test(id)),
    ).toEqual([]);
  });

  it.each([
    [
      "on the first day",
      (plan: TripPlan) => {
        hop(plan).day = 1;
        setHopDate(plan, "2026-11-10");
      },
    ],
    [
      "after the last night",
      (plan: TripPlan) => {
        hop(plan).day = 9;
        setHopDate(plan, "2026-11-18");
      },
    ],
    ["on a date that disagrees with its day", (plan: TripPlan) => setHopDate(plan, "2026-11-14")],
  ])("fails a hop %s", (_name, mutate) => {
    const plan = clone(kyoto.fixturePlan);
    mutate(plan);
    expect(failed(kyoto, plan)).toContain("hop-date");
  });

  it("fails a missing hop", () => {
    const plan = clone(kyoto.fixturePlan);
    const transport = items(plan, "transport");
    transport.splice(transport.indexOf(hop(plan)), 1);
    expect(failed(kyoto, plan)).toContain("hop-date");
  });

  it("fails an activity in the wrong city for its day", () => {
    const plan = clone(kyoto.fixturePlan);
    const late = items(plan, "itinerary").find((item) => item.day === 5)!;
    late.location = "Tokyo Tower";
    late.detail = "Tokyo Tower visit";
    expect(failed(kyoto, plan)).toContain("itinerary-by-city");
  });

  it("fails a day with no activity", () => {
    const plan = clone(kyoto.fixturePlan);
    const itinerary = items(plan, "itinerary");
    itinerary.splice(
      itinerary.findIndex((item) => item.day === 6),
      1,
    );
    expect(failed(kyoto, plan)).toContain("itinerary-by-city");
  });

  it.each([
    [
      "a gap before the second city",
      (plan: TripPlan) => setStay(plan, "Kyoto", "2026-11-14", "2026-11-17"),
    ],
    [
      "an overlap at the hop",
      (plan: TripPlan) => setStay(plan, "Tokyo", "2026-11-10", "2026-11-14"),
    ],
    [
      "a second stay that starts before the hop",
      (plan: TripPlan) => setStay(plan, "Kyoto", "2026-11-12", "2026-11-17"),
    ],
  ])("fails %s", (_name, mutate) => {
    const plan = clone(kyoto.fixturePlan);
    mutate(plan);
    expect(failed(kyoto, plan)).toContain("stay-transition");
  });

  it("fails a city with no stay", () => {
    const plan = clone(kyoto.fixturePlan);
    const stays = items(plan, "accommodation");
    stays.splice(stays.indexOf(stay(plan, "Kyoto")), 1);
    expect(failed(kyoto, plan)).toContain("stay-transition");
  });

  it("fails the cities in the wrong order", () => {
    const plan = clone(kyoto.fixturePlan);
    setStay(plan, "Kyoto", "2026-11-10", "2026-11-13");
    setStay(plan, "Tokyo", "2026-11-13", "2026-11-17");
    expect(failed(kyoto, plan)).toContain("stay-transition");
  });

  it("fails stays that do not span the trip dates", () => {
    const plan = clone(kyoto.fixturePlan);
    setStay(plan, "Kyoto", "2026-11-13", "2026-11-16");
    expect(failed(kyoto, plan)).toContain("trip-dates");
  });

  it("fails a plan whose dates differ from the brief's", () => {
    const plan = clone(kyoto.fixturePlan);
    plan.brief = { ...plan.brief, dates: [plan.brief.dates[0], "2026-11-18"] };
    expect(failed(kyoto, plan)).toContain("trip-dates");
  });

  it("fails section costs that do not add up to the total", () => {
    const plan = clone(kyoto.fixturePlan);
    plan.estTotal += 100;
    expect(failed(kyoto, plan)).toContain("total-consistent");
  });

  it("fails a plan whose budget differs from the brief's", () => {
    const plan = clone(kyoto.fixturePlan);
    plan.budgetTotal = 9999;
    expect(failed(kyoto, plan)).toContain("total-consistent");
  });

  it("takes its cities from the brief, not from the words Tokyo and Kyoto", () => {
    const rename = <T>(value: T): T =>
      JSON.parse(JSON.stringify(value).replace(/Tokyo/g, "Osaka").replace(/Kyoto/g, "Nara"));
    const scenario = { ...rename(kyoto), id: kyoto.id };
    expect(scenario.brief.destination).toBe("Osaka & Nara");
    expect(failed(scenario, scenario.fixturePlan)).toEqual([]);
    const broken = clone(scenario.fixturePlan);
    items(broken, "itinerary").find((item) => item.day === 5)!.location = "Osaka Castle";
    expect(failed(scenario, broken)).toContain("itinerary-by-city");
  });
});

const payloads = (events: { event: AgentLabEventPayload }[]) => events.map((run) => run.event);
const run = (scenarioId: AgentLabScenarioId, strategyId: AgentLabStrategyId) =>
  runAgentLab({ scenarioId, strategyId, dataMode: "fixture" }, { paceMs: 0 });

describe("Paris under every strategy", () => {
  it.each(["multi-agent-no-revision", "multi-agent-targeted-revision"] as const)(
    "%s stops at once, reports the minimum and does not revise",
    async (strategyId) => {
      const artifact = await run("paris-family-infeasible", strategyId);
      const events = payloads(artifact.events);
      const conflict = events.find((event) => event.type === "lab_conflict_detected");
      const minimum = paris.rules.infeasibleBudget!.minimumSupportedCost;
      expect(conflict).toMatchObject({ type: "lab_conflict_detected", infeasible: true });
      expect(JSON.stringify(conflict)).toContain(minimum.toFixed(2));
      expect(events.some((event) => event.type === "lab_revision_started")).toBe(false);
      expect(artifact.metrics.rounds).toBe(1);
      expect(artifact.metrics.stopReason).toBe("infeasible_budget");
      expect(artifact.metrics.unresolvedConflicts).toBe(1);
      expect(artifact.metrics.withinBudget).toBe(false);
      expect(artifact.plan.sections).toHaveLength(5);
      expect(artifact.plan.estTotal).toBeGreaterThanOrEqual(minimum);
      expect(artifact.metrics.checks.filter((check) => !check.passed)).toEqual([]);
    },
  );

  it("single-agent baseline overruns without reporting the shortfall or a stop", async () => {
    const artifact = await run("paris-family-infeasible", "single-agent-baseline");
    expect(artifact.metrics.withinBudget).toBe(false);
    expect(artifact.metrics.stopReason).toBeNull();
    expect(
      artifact.metrics.checks.filter((check) => !check.passed).map((check) => check.id),
    ).toEqual(["infeasibility-reported"]);
  });

  it("declares the minimum the workflow reports from the same evidence", async () => {
    const artifact = await run("paris-family-infeasible", "multi-agent-no-revision");
    const conflict = artifact.plan.conflicts?.[0];
    const reported = Number(/AUD ([\d.]+)/.exec(conflict?.reason ?? "")?.[1]);
    expect(reported).toBe(paris.rules.infeasibleBudget!.minimumSupportedCost);
  });
});

describe("Tokyo and Kyoto under every strategy", () => {
  it.each([
    "single-agent-baseline",
    "multi-agent-no-revision",
    "multi-agent-targeted-revision",
  ] as const)("%s passes every check and is consistent across cities", async (strategyId) => {
    const artifact = await run("tokyo-kyoto-multi-city", strategyId);
    expect(artifact.metrics.checks.filter((check) => !check.passed)).toEqual([]);
    expect(artifact.metrics.multiCityConsistent).toBe(true);
    expect(artifact.metrics.withinBudget).toBe(true);
    expect(artifact.metrics.unresolvedConflicts).toBe(0);
  });

  it("the revision strategy has nothing to repair and stays at one round", async () => {
    const artifact = await run("tokyo-kyoto-multi-city", "multi-agent-targeted-revision");
    expect(artifact.metrics.rounds).toBe(1);
    expect(artifact.metrics.stopReason).toBe("converged");
    expect(payloads(artifact.events).some((event) => event.type === "lab_revision_started")).toBe(
      false,
    );
  });
});

describe("versions", () => {
  it.each([
    ["paris-family-infeasible", paris],
    ["tokyo-kyoto-multi-city", kyoto],
  ] as const)("%s records its fixture and evaluator versions", async (scenarioId, scenario) => {
    const artifact = await run(scenarioId, "single-agent-baseline");
    expect(artifact.versions).toEqual({
      fixture: scenario.fixtureVersion,
      evaluator: AGENT_LAB_EVALUATOR_VERSION,
    });
    expect(scenario.fixtureVersion).toMatch(/-v\d+$/);
    expect(AGENT_LAB_EVALUATOR_VERSION).not.toBe("basic-plan-v1");
  });
});
