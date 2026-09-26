// End-to-end check of what the five specialists produce together: posts fixed briefs to /api/chat
// in "plan" mode and applies plan-level sanity checks (dates, budget, sections, provenance,
// unresolved conflicts). Every NDJSON stream, final plan and a summary.json land under
// output/e2e/plan-quality/<run>/ as a repeatable, reviewable artifact.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [DATA_MODE=live|mock] [RUNS=3] [ONLY=id,id] [BASE_URL=...] node apps/web/tests/e2e/plan-quality.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MODE = process.env.DATA_MODE ?? "live";
const RUNS = Number(process.env.RUNS ?? 1);
const ONLY = process.env.ONLY?.split(",").map((id) => id.trim());
const RUN = `${new Date().toISOString().replace(/[:.]/g, "-")}-${MODE}`;
const OUT = resolve(process.cwd(), "output/e2e/plan-quality", RUN);
mkdirSync(OUT, { recursive: true });

const SCENARIOS = [
  {
    id: "tokyo-couple",
    brief: {
      destination: "Tokyo",
      origin: "Sydney",
      dates: ["2026-11-10", "2026-11-14"],
      groupSize: 2,
      budgetTotal: 6000,
      preferences: ["Vegetarian food", "No early starts"],
    },
  },
  {
    id: "paris-family-tight",
    // Return flights alone exceed this budget: the plan should say so in round 1.
    infeasible: true,
    brief: {
      destination: "Paris",
      origin: "Melbourne",
      dates: ["2026-12-01", "2026-12-06"],
      groupSize: 4,
      budgetTotal: 5000,
      party: { adults: 2, children: 2, infants: 0, seniors: 0, pets: 0 },
    },
  },
  {
    id: "bali-solo",
    brief: {
      destination: "Bali",
      origin: "Perth",
      dates: ["2026-10-20", "2026-10-26"],
      groupSize: 1,
      budgetTotal: 2500,
      preferences: ["Surfing", "Quiet areas"],
    },
  },
  {
    // About 4% above the cheapest flights and stay found for these dates, so
    // the plan only fits if every section spends close to its floor.
    id: "tokyo-tight",
    brief: {
      destination: "Tokyo",
      origin: "Sydney",
      dates: ["2026-11-10", "2026-11-14"],
      groupSize: 2,
      budgetTotal: 4800,
    },
  },
  {
    // Two cities: an inter-city hop the transport and day plan must agree on.
    id: "tokyo-kyoto",
    brief: {
      destination: "Tokyo & Kyoto",
      origin: "Sydney",
      dates: ["2026-11-10", "2026-11-17"],
      groupSize: 2,
      budgetTotal: 9000,
    },
  },
].filter(({ id }) => !ONLY || ONLY.includes(id));

const days = ([a, b]) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

async function plan({ id, brief }, run) {
  const tripId = `e2e-${id}`;
  const started = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": MODE },
    body: JSON.stringify({
      tripId,
      mode: "plan",
      message: "Plan this trip",
      brief: { tripId, userId: "e2e", ...brief },
    }),
  });
  const text = await res.text();
  writeFileSync(`${OUT}/${id}-${run}.ndjson`, text);
  const frames = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const final = frames.find((f) => f.type === "complete" || f.type === "error");
  const ms = Date.now() - started;
  if (!final || final.type === "error") return { id, ms, error: final?.error ?? `HTTP ${res.status}` };
  const p = final.response.plan;
  writeFileSync(`${OUT}/${id}-${run}.plan.json`, JSON.stringify(p, null, 2));
  return { id, ms, plan: p, reply: final.response.reply, frames };
}

function checks({ plan: p, frames, reply }, { brief, infeasible }) {
  const out = [];
  const check = (ok, message) => out.push({ ok: Boolean(ok), message });
  const ids = p.sections.map((s) => s.id);
  check(p.sections.length === 5, `5 sections (got ${ids.join(", ")})`);
  if (infeasible) {
    const only = p.conflicts?.length === 1 ? p.conflicts[0] : undefined;
    check(/infeasible budget/.test(only?.reason ?? ""), `reported infeasible (${JSON.stringify(p.conflicts ?? []).slice(0, 160)})`);
    check(p.round === 1, `stopped in round 1 (${p.round})`);
    // The traveller has to hear the number, not just "over budget".
    const minimum = Number(/AUD ([\d.]+)/.exec(only?.constraints?.[0] ?? "")?.[1]);
    const said = [...(reply ?? "").matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replaceAll(",", "")));
    check(
      Number.isFinite(minimum) && said.some((n) => Math.abs(n - minimum) <= minimum * 0.05),
      `reply names the minimum budget ~${minimum} (${JSON.stringify(reply).slice(0, 200)})`,
    );
  } else {
    check(p.overrunPct <= 0, `within budget (est ${p.estTotal} / ${p.budgetTotal}, ${p.overrunPct.toFixed(1)}%)`);
    check(!p.conflicts?.length, `no unresolved conflicts (${p.conflicts?.length ?? 0})`);
  }
  check(
    Math.abs(p.sections.reduce((n, s) => n + s.estCost, 0) - p.estTotal) < 1,
    "section costs add up to estTotal",
  );
  const failed = frames.filter((f) => f.type === "agent_failed");
  check(!failed.length, `no agent_failed events (${failed.length})`);
  for (const s of p.sections) {
    // No source publishes admission prices, so an activity with a price was invented.
    if (s.id === "itinerary")
      check(
        (s.proposal?.items ?? []).every((item) => item.estCost === undefined),
        "no activity carries an invented price",
      );
    const json = JSON.stringify(s.proposal ?? {});
    const dates = [...json.matchAll(/20\d\d-\d\d-\d\d(?!T)/g)].map((m) => m[0]);
    const outside = dates.filter((d) => d < brief.dates[0] || d > brief.dates[1]);
    check(!outside.length, `${s.id} dates inside the trip (${[...new Set(outside)].join(", ") || "ok"})`);
    const prov = [...json.matchAll(/"(?:provenance|source|dataSource)":"(\w+)"/g)].map((m) => m[1]);
    check(!prov.includes("mock") || MODE === "mock", `${s.id} has no mock data in live mode`);
  }
  // Feasible is not the same as good: a revision can clear every conflict by
  // falling back to a template or repeating a stop, so quality is checked too.
  const itinerary = p.sections.find((s) => s.id === "itinerary")?.proposal;
  const stops = itinerary?.items ?? [];
  check(itinerary?.source?.kind !== "fallback", `itinerary is model-planned (${itinerary?.source?.kind})`);
  const guide = p.sections.find((s) => s.id === "destination-guide")?.proposal;
  check(guide?.source?.kind !== "fallback", `destination guide is model-written (${guide?.source?.kind})`);
  const dining = p.sections.find((s) => s.id === "dining")?.proposal;
  check(dining?.source?.kind !== "fallback", `dining is model-written (${dining?.source?.kind})`);
  if (MODE === "live") {
    // A fixture under a provider label is the provenance lie this suite exists to catch.
    const fixtures = frames.filter((f) => /fixture/i.test(f.resultSummary ?? ""));
    check(!fixtures.length, `no fixture data in live mode (${fixtures.map((f) => f.resultSummary).join(", ") || "ok"})`);
  }
  const repeats = stops.filter(
    (a, i) => stops.findIndex((b) => b.day === a.day && b.location === a.location) !== i,
  );
  check(!repeats.length, `no place repeated within a day (${repeats.map((a) => `d${a.day} ${a.location}`).join(", ") || "ok"})`);
  const generic = stops.filter((a) =>
    [brief.destination, "neighborhood", "neighbourhood"].includes(a.location.trim().toLowerCase()) ||
    a.location.trim().toLowerCase() === brief.destination.toLowerCase(),
  );
  check(!generic.length, `no generic stops (${generic.map((a) => a.location).join(", ") || "ok"})`);
  if (brief.destination.includes("&")) {
    // The day plan must move city on the day transport does, and never go back.
    const cityLine = itinerary?.assumptions?.find((a) => a.startsWith("Cities by day:")) ?? "";
    const hopDays = (p.sections.find((s) => s.id === "transport")?.proposal?.items ?? [])
      .filter((i) => / → /.test(i.location ?? "") && !i.location.startsWith(brief.origin))
      .map((i) => i.day);
    const planDays = [...cityLine.matchAll(/day (\d+) [^;]+ → /g)].map((m) => Number(m[1]));
    check(
      hopDays.length > 0 && JSON.stringify(hopDays) === JSON.stringify(planDays),
      `day plan moves city with transport (transport ${hopDays}, day plan ${planDays})`,
    );
    // And the traveller sleeps where they are: each later stay checks in on its hop day.
    const checkIns = (p.sections.find((s) => s.id === "accommodation")?.proposal?.items ?? [])
      .map((i) => i.day)
      .slice(1);
    check(
      hopDays.length > 0 && JSON.stringify(hopDays) === JSON.stringify(checkIns),
      `stays change city with transport (transport ${hopDays}, check-ins ${checkIns})`,
    );
  }
  check(p.round >= 1, `rounds run: ${p.round}`);
  check(days(brief.dates) > 0, `trip is ${days(brief.dates)} days`);
  return out;
}

const summary = [];
for (let run = 1; run <= RUNS; run += 1)
for (const scenario of SCENARIOS) {
  console.log(`\n== ${scenario.id} (run ${run})`);
  const result = await plan(scenario, run);
  if (result.error) {
    console.log(`FAIL planning error: ${result.error}`);
    summary.push({ id: scenario.id, run, ms: result.ms, error: result.error });
    continue;
  }
  const list = checks(result, scenario);
  for (const c of list) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.message}`);
  summary.push({
    id: scenario.id,
    run,
    passed: list.every((c) => c.ok),
    ms: result.ms,
    round: result.plan.round,
    estTotal: result.plan.estTotal,
    budgetTotal: result.plan.budgetTotal,
    conflicts: result.plan.conflicts ?? [],
    checks: list,
  });
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log("\nscenario            passed  median s  rounds");
for (const { id } of SCENARIOS) {
  const rows = summary.filter((row) => row.id === id);
  const times = rows.map((row) => row.ms / 1000).sort((a, b) => a - b);
  console.log(
    `${id.padEnd(20)}${`${rows.filter((row) => row.passed).length}/${rows.length}`.padEnd(8)}${times[Math.floor(times.length / 2)].toFixed(0).padEnd(10)}${rows.map((row) => row.round ?? "err").join(",")}`,
  );
}
console.log(`\nArtifacts: ${OUT}`);
