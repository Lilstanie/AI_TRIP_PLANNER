// Planning-loop evidence for the deep Booking Port (#130).
//
// Failure inventory:
// - the registered multi-city scenario cannot complete through the public Agent Lab API;
// - fixture flight or stay facts change, disappear or lose their Booking provenance;
// - the final Plan gains a conflict or loses multi-city consistency;
// - the stream does not finish with the same artifact saved for review.
//
//   pnpm --filter @trip/web dev   (with USE_MOCK_TOOLS=true and no model or provider keys)
//   node apps/web/tests/e2e/booking-provider-planning.e2e.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUN = process.env.RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-");
const OUT = resolve(process.cwd(), "output/e2e/booking-provider-planning", RUN);
mkdirSync(OUT, { recursive: true });

const response = await fetch(`${BASE}/api/agent-lab/runs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    scenarioId: "tokyo-kyoto-multi-city",
    strategyId: "multi-agent-no-revision",
    dataMode: "fixture",
  }),
});
const body = await response.text();
const frames = body
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const terminal = frames.at(-1);
const artifact = terminal?.artifact;
const transport = artifact?.plan?.sections?.find((section) => section.id === "transport")?.proposal;
const accommodation = artifact?.plan?.sections?.find(
  (section) => section.id === "accommodation",
)?.proposal;
const flight = transport?.flights?.[0];
const tokyoStay = accommodation?.stays?.find((stay) => stay.city === "Tokyo");
const kyotoStay = accommodation?.stays?.find((stay) => stay.city === "Kyoto");

writeFileSync(`${OUT}/run.ndjson`, body);
writeFileSync(`${OUT}/artifact.json`, JSON.stringify(artifact, null, 2));
const savedArtifact = JSON.parse(readFileSync(`${OUT}/artifact.json`, "utf8"));

const checks = {
  completed:
    response.ok &&
    artifact?.status === "completed" &&
    artifact?.scenarioId === "tokyo-kyoto-multi-city" &&
    artifact?.strategyId === "multi-agent-no-revision",
  flight:
    flight?.from === "Sydney" &&
    flight?.to === "Tokyo" &&
    flight?.passengers === 2 &&
    flight?.selectedId === "0-1" &&
    flight?.candidates?.[0]?.carrier === "MockAir Economy" &&
    flight?.candidates?.[0]?.price === 1240 &&
    flight?.candidates?.[1]?.carrier === "MockAir Flexible" &&
    flight?.candidates?.[1]?.price === 1680,
  stays:
    tokyoStay?.checkIn === "2026-11-10" &&
    tokyoStay?.checkOut === "2026-11-13" &&
    tokyoStay?.selectedId === "stay-1-0" &&
    tokyoStay?.candidates?.[0]?.name === "Mock Tokyo Saver" &&
    tokyoStay?.candidates?.[0]?.pricePerNight === 220 &&
    kyotoStay?.checkIn === "2026-11-13" &&
    kyotoStay?.checkOut === "2026-11-17" &&
    kyotoStay?.selectedId === "stay-4-0" &&
    kyotoStay?.candidates?.[0]?.name === "Mock Kyoto Saver" &&
    kyotoStay?.candidates?.[0]?.pricePerNight === 200,
  provenance:
    transport?.source?.kind === "mock" &&
    transport?.source?.label === "Mock booking and route data" &&
    accommodation?.source?.kind === "mock" &&
    accommodation?.source?.label === "Mock booking fixture",
  plan:
    artifact?.plan?.tripId === "agent-lab-tokyo-kyoto-multi-city" &&
    artifact?.plan?.round === 1 &&
    artifact?.plan?.budgetTotal === 6500 &&
    artifact?.plan?.estTotal === 3930 &&
    JSON.stringify(
      artifact?.plan?.sections?.map((section) => [section.id, section.status, section.estCost]),
    ) ===
      JSON.stringify([
        ["itinerary", "draft", 0],
        ["transport", "draft", 1770],
        ["accommodation", "draft", 1460],
        ["destination-guide", "draft", 0],
        ["dining", "draft", 700],
      ]) &&
    artifact?.plan?.conflicts?.length === 0 &&
    artifact?.metrics?.multiCityConsistent === true &&
    artifact?.metrics?.unresolvedConflicts === 0,
  artifact:
    terminal?.type === "complete" &&
    artifact?.schemaVersion === 1 &&
    artifact?.versions?.fixture === "tokyo-kyoto-multi-city-v1" &&
    artifact?.versions?.evaluator === "scenario-rules-v2" &&
    JSON.stringify(savedArtifact) === JSON.stringify(artifact),
};

writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ passed: Object.values(checks).every(Boolean), checks }, null, 2),
);

for (const [name, passed] of Object.entries(checks)) {
  console.log(`${passed ? "ok  " : "FAIL"} ${name}`);
}
console.log(`\nArtifacts: ${OUT}`);
if (Object.values(checks).some((passed) => !passed)) process.exit(1);
