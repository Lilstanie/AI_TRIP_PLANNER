import { describe, expect, it } from "vitest";
import type { TripPlan } from "@trip/shared";
import { evaluateAgentLabPlan, findAgentLabScenario } from "../src/agent-lab";

const scenario = findAgentLabScenario("tokyo-couple");
const clone = (): TripPlan => structuredClone(scenario.fixturePlan);
const failed = (plan: TripPlan) =>
  evaluateAgentLabPlan(scenario, plan)
    .checks.filter((check) => !check.passed)
    .map((check) => check.id);

describe("evaluateAgentLabPlan", () => {
  it("passes every check for the registered fixture", () => {
    const result = evaluateAgentLabPlan(scenario, clone());
    expect(failed(scenario.fixturePlan)).toEqual([]);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetHeadroom).toBe(2040);
    expect(result.checks.length).toBeGreaterThanOrEqual(6);
    expect(new Set(result.checks.map((check) => check.id)).size).toBe(result.checks.length);
  });

  it("reports an overrun as over budget with negative headroom", () => {
    const plan = clone();
    plan.estTotal = 6500;
    const result = evaluateAgentLabPlan(scenario, plan);
    expect(result.withinBudget).toBe(false);
    expect(result.budgetHeadroom).toBe(-500);
    expect(failed(plan)).toEqual(["budget"]);
  });

  it("fails an activity that starts before the earliest allowed time", () => {
    const plan = clone();
    plan.sections[0]!.proposal!.items[0]!.startTime = "07:00";
    expect(failed(plan)).toEqual(["no-early-starts"]);
  });

  it("fails a meal that is not marked vegetarian-friendly", () => {
    const plan = clone();
    const dining = plan.sections.find((section) => section.id === "dining")!;
    dining.proposal!.items[0]!.detail = "Steakhouse dinner for two";
    expect(failed(plan)).toEqual(["vegetarian-meals"]);
  });

  it("fails a plan with a missing section", () => {
    const plan = clone();
    plan.sections = plan.sections.slice(0, 4);
    expect(failed(plan)).toContain("sections");
  });

  it("rejects one-night hotel dates that do not match the trip window", () => {
    const oneNight = findAgentLabScenario("tokyo-date-night-edge");
    const plan = structuredClone(oneNight.fixturePlan);
    const hotel = plan.sections
      .find((section) => section.id === "accommodation")!
      .proposal!.items.find((item) => item.kind === "hotel")!;
    hotel.detail = hotel.detail.replace("2026-11-10 to 2026-11-11", "2026-11-09 to 2026-11-10");

    expect(
      evaluateAgentLabPlan(oneNight, plan).checks.find((check) => check.id === "stay-date-range")
        ?.passed,
    ).toBe(false);
  });

  it("fails a plan that carries conflicts", () => {
    const plan = clone();
    plan.conflicts = [
      { tripId: plan.tripId, targetAgent: "transport", reason: "over budget", constraints: [] },
    ];
    expect(failed(plan)).toEqual(["no-conflicts"]);
  });

  it("fails a plan for a different destination using the scenario brief, not a literal", () => {
    const plan = clone();
    plan.brief = { ...plan.brief, destination: "Osaka" };
    expect(failed(plan)).toEqual(["destination"]);
  });

  it("allows timed activities in both cities on the correct sides of a transfer", () => {
    const multiCity = findAgentLabScenario("tokyo-kyoto-multi-city");
    const plan = structuredClone(multiCity.fixturePlan);
    const transfer = plan.sections.find((section) => section.id === "transport")!.proposal!
      .items[1]!;
    transfer.startTime = "12:00";
    transfer.endTime = "14:20";
    const itinerary = plan.sections.find((section) => section.id === "itinerary")!.proposal!;
    const arrival = itinerary.items.find((item) => item.day === 5)!;
    arrival.startTime = "14:30";
    arrival.endTime = "16:00";
    itinerary.items.push({
      kind: "activity",
      detail: "Morning visit in Tokyo",
      location: "Tokyo",
      day: 5,
      startTime: "10:00",
      endTime: "11:00",
    });

    expect(
      evaluateAgentLabPlan(multiCity, plan).checks.find((check) => check.id === "itinerary-by-city")
        ?.passed,
    ).toBe(true);
  });

  it("rejects untimed activities and transfer-day activities on the wrong side", () => {
    const multiCity = findAgentLabScenario("tokyo-kyoto-multi-city");
    const makePlan = () => {
      const plan = structuredClone(multiCity.fixturePlan);
      const transfer = plan.sections.find((section) => section.id === "transport")!.proposal!
        .items[1]!;
      transfer.startTime = "12:00";
      transfer.endTime = "14:20";
      const arrival = plan.sections
        .find((section) => section.id === "itinerary")!
        .proposal!.items.find((item) => item.day === 5)!;
      arrival.startTime = "14:30";
      arrival.endTime = "16:00";
      return { plan, arrival };
    };
    const rejected = (plan: TripPlan) =>
      evaluateAgentLabPlan(multiCity, plan).checks.find((check) => check.id === "itinerary-by-city")
        ?.passed;

    const untimed = makePlan();
    delete untimed.arrival.startTime;
    delete untimed.arrival.endTime;
    expect(rejected(untimed.plan)).toBe(false);

    const overlapping = makePlan();
    overlapping.arrival.startTime = "14:00";
    overlapping.arrival.endTime = "15:00";
    expect(rejected(overlapping.plan)).toBe(false);

    const beforeTransfer = makePlan();
    beforeTransfer.arrival.startTime = "11:00";
    beforeTransfer.arrival.endTime = "11:45";
    expect(rejected(beforeTransfer.plan)).toBe(false);

    const departureAfterTransfer = makePlan();
    departureAfterTransfer.plan.sections
      .find((section) => section.id === "itinerary")!
      .proposal!.items.push({
        kind: "activity",
        detail: "Afternoon visit in Tokyo",
        location: "Tokyo",
        day: 5,
        startTime: "15:00",
        endTime: "16:00",
      });
    expect(rejected(departureAfterTransfer.plan)).toBe(false);
  });

  it("rejects transfer-day city activities when the transfer has no times", () => {
    const multiCity = findAgentLabScenario("tokyo-kyoto-multi-city");
    const plan = structuredClone(multiCity.fixturePlan);
    const transfer = plan.sections.find((section) => section.id === "transport")!.proposal!
      .items[1]!;
    delete transfer.startTime;
    delete transfer.endTime;

    expect(
      evaluateAgentLabPlan(multiCity, plan).checks.find((check) => check.id === "itinerary-by-city")
        ?.passed,
    ).toBe(false);
  });

  it("requires separate meal entries for competing food preferences", () => {
    const tradeoff = findAgentLabScenario("tokyo-conflicting-preferences");
    const plan = structuredClone(tradeoff.fixturePlan);
    const meals = plan.sections.find((section) => section.id === "dining")!.proposal!.items;
    meals.splice(0, meals.length, {
      kind: "meal",
      detail: "Vegetarian and local meat specialties in one dinner",
      location: "Tokyo",
      day: 1,
    });

    expect(
      evaluateAgentLabPlan(tradeoff, plan).checks.find(
        (check) => check.id === "meal-preference-tradeoff",
      )?.passed,
    ).toBe(false);
  });
});
