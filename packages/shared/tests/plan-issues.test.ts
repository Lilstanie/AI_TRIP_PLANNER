import { describe, expect, it } from "vitest";
import { planIssue, planIssueCopy, type PlanIssueKind } from "../src/plan-issues";

const SAMPLES: { [K in PlanIssueKind]: Parameters<typeof planIssue<K>>[1] } = {
  budgetInfeasible: { floor: "AUD 3,100.00", budget: "AUD 2,000.00" },
  overBudget: { percent: "12.50", overrun: "AUD 250.00" },
  beforeArrival: { day: 1, arrivalDay: 1, time: "14:30" },
  timeOverlap: { day: 2, start: "10:00", end: "12:00", otherStart: "11:00", otherEnd: "13:00" },
  routeTiming: { day: 3, from: "外滩", to: "豫园", need: 35, have: 15 },
  routeFailed: { day: 4 },
  routeUnavailable: { day: 5, from: "上海", to: "杭州" },
  stopRouteProblem: { day: 6, from: "外滩", to: "豫园", problem: "no route returned" },
  hopRouteProblem: {
    day: 7,
    from: "上海",
    to: "杭州",
    problem: "driving estimate cannot verify public transport timing",
  },
  overnightCity: { day: 8 },
  noGroundedPlaces: {},
  flightUnavailable: { from: "珀斯", to: "巴厘岛" },
  flightNoFare: { from: "珀斯", to: "巴厘岛" },
  hopTooLong: { day: 9, from: "上海", to: "杭州", mode: "train" },
  routeTooLong: { day: 10 },
  noDaytimeSlot: { day: 11 },
  makeRouteFeasible: {},
  cutCost: { agent: "accommodation", saving: "AUD 120.00", limit: "AUD 800.00" },
  afterArrival: { day: 1, time: "14:30" },
  keepClear: { day: 2, start: "10:00", end: "12:00", agent: "transport", place: "外滩" },
  raiseBudget: { floor: "AUD 3,100.00" },
};

describe("planIssueCopy", () => {
  it("writes every plan issue in Chinese, alone and joined", () => {
    const english = (Object.keys(SAMPLES) as PlanIssueKind[]).map((kind) =>
      planIssue(kind, SAMPLES[kind] as never),
    );
    for (const text of [...english, english.join("; ")]) {
      const chinese = planIssueCopy(text, "zh", () => "住宿");
      expect(chinese.replace(/AUD|train/g, "")).not.toMatch(/[A-Za-z]/);
    }
    expect(planIssueCopy(english.join("; "), "zh").split("；")).toHaveLength(english.length);
  });

  it("leaves English and unknown text unchanged", () => {
    const text = `${planIssue("routeFailed", { day: 4 })}; the model's own words`;
    expect(planIssueCopy(text, "en")).toBe(text);
    expect(planIssueCopy(text, "zh")).toBe(
      "第 4 天路线服务出错，路程未能核实；the model's own words",
    );
  });
});
