import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MODE = "mock";
const RUN = `${new Date().toISOString().replace(/[:.]/g, "-")}-mock-no-model`;
const OUT = resolve(process.cwd(), "output/e2e/planner-correctness", RUN);
mkdirSync(OUT, { recursive: true });
const estimateText = (amount) =>
  amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const scenarios = [
  {
    id: "inclusive-duration",
    message: "3 days in Hobart from 1 Mar 2027, 2 adults, budget AUD 100 total",
    dates: ["2027-03-01", "2027-03-03"],
    check(plan) {
      const days =
        plan.sections
          .find((section) => section.id === "itinerary")
          ?.proposal?.items.map((item) => item.day) ?? [];
      return [
        [
          JSON.stringify(plan.brief.dates) === JSON.stringify(this.dates),
          `3 days from start date resolves to inclusive dates ${this.dates.join(" to ")} (got ${plan.brief.dates})`,
        ],
        [
          Math.max(0, ...days) <= 3,
          `the 3-day trip has no departure-day stop (got days ${days.join(", ") || "none"})`,
        ],
      ];
    },
  },
  {
    id: "thin-data-reuse-disclosure",
    message: "Hobart, 3 days from 2026-12-01, 2 adults, budget AUD 1500",
    dates: ["2026-12-01", "2026-12-03"],
    check(plan, reply) {
      const stops =
        plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
      const locations = new Set(stops.map((stop) => stop.location.toLocaleLowerCase()));
      return [
        [
          locations.size === stops.length ||
            /reuses the same stop.+not distinct activities/i.test(reply),
          `thin evidence either keeps places distinct or explicitly identifies reuse (${stops.map((stop) => `d${stop.day} ${stop.location}`).join("; ") || "no stops"}; ${JSON.stringify(reply)})`,
        ],
      ];
    },
  },
  {
    id: "unknown-price-budget",
    message: "Sydney 2 days from 2026-12-01, 2 adults, budget AUD 100 total",
    dates: ["2026-12-01", "2026-12-02"],
    check(plan, reply) {
      const unpriced = plan.sections
        .filter((section) => section.id === "itinerary")
        .flatMap((section) => section.proposal?.items ?? [])
        .filter((item) => item.estCost === undefined).length;
      const estimate = `AUD ${estimateText(plan.estTotal)}`;
      return [
        [
          !/\bfree\b|no ticket needed|AUD\s*0(?:\.00)?/i.test(reply),
          `unknown costs are not asserted free or zero (${JSON.stringify(reply)})`,
        ],
        [
          reply.includes(estimate),
          `reply known estimate matches plan total ${estimate} (${JSON.stringify(reply)})`,
        ],
        [
          unpriced === 0 || /unknown|unpriced|not included|not counted/i.test(reply),
          `reply states the unknown price boundary for ${unpriced} unpriced stops (${JSON.stringify(reply)})`,
        ],
      ];
    },
  },
  {
    id: "activity-total-reconciliation",
    message: "Plan 3 days in Tokyo for 2 adults, budget AUD 3000, from 2027-03-10",
    dates: ["2027-03-10", "2027-03-12"],
    check(plan, reply) {
      const unpriced = plan.sections
        .filter((section) => section.id === "itinerary")
        .flatMap((section) => section.proposal?.items ?? [])
        .filter((item) => item.estCost === undefined).length;
      const estimate = `AUD ${estimateText(plan.estTotal)}`;
      return [
        [
          reply.includes(estimate),
          `reply total matches plan estimate ${estimate} (${JSON.stringify(reply)})`,
        ],
        [
          unpriced === 0 || /unknown|unpriced|not included|not counted/i.test(reply),
          `reply qualifies the total when ${unpriced} activity prices are unknown (${JSON.stringify(reply)})`,
        ],
        [
          !/comfortably under|AUD\s*1,493/i.test(reply),
          `reply does not imply unknown ticket price is included or leave estimate unreconciled (${JSON.stringify(reply)})`,
        ],
      ];
    },
  },
];

const results = [];
for (const [index, scenario] of scenarios.entries()) {
  const response = await globalThis.fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": MODE },
    body: JSON.stringify({
      tripId: `e2e-planner-correctness-${RUN}-${index}`,
      message: scenario.message,
      known: {},
      interfaceLanguage: "en",
    }),
  });
  const text = await response.text();
  writeFileSync(`${OUT}/${scenario.id}.ndjson`, text);
  const frames = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const final = frames.findLast((frame) =>
    ["complete", "error", "needs_info", "ask_user"].includes(frame.type),
  );
  const plan = final?.response?.plan;
  const reply = final?.response?.reply ?? final?.question ?? "";
  if (plan) writeFileSync(`${OUT}/${scenario.id}.plan.json`, JSON.stringify(plan, null, 2));
  const checks = plan
    ? scenario.check(plan, reply)
    : [
        [
          false,
          `request produces a plan (${final?.type ?? response.status}: ${reply || text.slice(0, 200)})`,
        ],
      ];
  for (const [ok, message] of checks) {
    results.push({ scenario: scenario.id, ok, message });
    console.log(`${ok ? "PASS" : "FAIL"} ${scenario.id}: ${message}`);
  }
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify(
    {
      run: RUN,
      mode: MODE,
      model: "none-configured",
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);
console.log(`\n${results.length - failed.length}/${results.length} checks passed → ${OUT}`);
process.exit(failed.length ? 1 : 0);
