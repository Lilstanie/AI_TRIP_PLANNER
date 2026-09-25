// End-to-end check of what the five specialists produce together: posts fixed briefs to /api/chat
// in "plan" mode and applies plan-level sanity checks (dates, budget, sections, provenance,
// unresolved conflicts). Every NDJSON stream, final plan and a summary.json land under
// output/e2e/plan-quality/<run>/ as a repeatable, reviewable artifact.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [DATA_MODE=live|mock] [BASE_URL=...] node apps/web/tests/e2e/plan-quality.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MODE = process.env.DATA_MODE ?? "live";
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
];

const days = ([a, b]) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;

async function plan({ id, brief }) {
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
  writeFileSync(`${OUT}/${id}.ndjson`, text);
  const frames = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const final = frames.find((f) => f.type === "complete" || f.type === "error");
  const ms = Date.now() - started;
  if (!final || final.type === "error") return { id, ms, error: final?.error ?? `HTTP ${res.status}` };
  const p = final.response.plan;
  writeFileSync(`${OUT}/${id}.plan.json`, JSON.stringify(p, null, 2));
  return { id, ms, plan: p, reply: final.response.reply, frames };
}

function checks({ plan: p, frames }, brief) {
  const out = [];
  const check = (ok, message) => out.push({ ok: Boolean(ok), message });
  const ids = p.sections.map((s) => s.id);
  check(p.sections.length === 5, `5 sections (got ${ids.join(", ")})`);
  check(p.overrunPct <= 0, `within budget (est ${p.estTotal} / ${p.budgetTotal}, ${p.overrunPct.toFixed(1)}%)`);
  check(!p.conflicts?.length, `no unresolved conflicts (${p.conflicts?.length ?? 0})`);
  check(
    Math.abs(p.sections.reduce((n, s) => n + s.estCost, 0) - p.estTotal) < 1,
    "section costs add up to estTotal",
  );
  const failed = frames.filter((f) => f.type === "agent_failed");
  check(!failed.length, `no agent_failed events (${failed.length})`);
  for (const s of p.sections) {
    check(s.estCost > 0 || /destination/i.test(s.id), `${s.id} has a cost (${s.estCost})`);
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
  const repeats = stops.filter(
    (a, i) => stops.findIndex((b) => b.day === a.day && b.location === a.location) !== i,
  );
  check(!repeats.length, `no place repeated within a day (${repeats.map((a) => `d${a.day} ${a.location}`).join(", ") || "ok"})`);
  const generic = stops.filter((a) =>
    [brief.destination, "neighborhood", "neighbourhood"].includes(a.location.trim().toLowerCase()) ||
    a.location.trim().toLowerCase() === brief.destination.toLowerCase(),
  );
  check(!generic.length, `no generic stops (${generic.map((a) => a.location).join(", ") || "ok"})`);
  check(p.round >= 1, `rounds run: ${p.round}`);
  check(days(brief.dates) > 0, `trip is ${days(brief.dates)} days`);
  return out;
}

const summary = [];
for (const scenario of SCENARIOS) {
  console.log(`\n== ${scenario.id}`);
  const result = await plan(scenario);
  if (result.error) {
    console.log(`FAIL planning error: ${result.error}`);
    summary.push({ id: scenario.id, ms: result.ms, error: result.error });
    continue;
  }
  const list = checks(result, scenario.brief);
  for (const c of list) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.message}`);
  summary.push({
    id: scenario.id,
    ms: result.ms,
    round: result.plan.round,
    estTotal: result.plan.estTotal,
    budgetTotal: result.plan.budgetTotal,
    conflicts: result.plan.conflicts ?? [],
    checks: list,
  });
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(`\nArtifacts: ${OUT}`);
