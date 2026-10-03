// Planning-loop evidence for the deep Weather Port (#128).
//
// Failure inventory:
// - the registered fixture scenario cannot complete through the Agent Lab API;
// - its destination weather guidance or provenance changes;
// - the Plan gains a Conflict or loses its five sections;
// - the streamed Artifact cannot be saved and re-read for review.
//
// The fixture Maps Port has no coordinates, so the destination specialist keeps
// monthly weather context. The provider matrix separately exercises the Weather
// Port's three date horizons with coordinates and a controlled clock.
//
//   pnpm --filter @trip/web dev   (with USE_MOCK_TOOLS=true and no model or provider keys)
//   node apps/web/tests/e2e/weather-provider-planning.e2e.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUN = process.env.RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-");
const OUT = resolve(process.cwd(), "output/e2e/weather-provider-planning", RUN);
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
const destination = artifact?.plan?.sections?.find((section) => section.id === "destination-guide");
const weather = destination?.proposal?.items?.find((item) => item.kind === "weather-packing");

writeFileSync(`${OUT}/run.ndjson`, body);
writeFileSync(`${OUT}/artifact.json`, JSON.stringify(artifact, null, 2));
const savedArtifact = JSON.parse(readFileSync(`${OUT}/artifact.json`, "utf8"));

const checks = {
  completed:
    response.ok &&
    artifact?.status === "completed" &&
    artifact?.scenarioId === "tokyo-kyoto-multi-city" &&
    artifact?.strategyId === "multi-agent-no-revision",
  weather:
    weather?.detail ===
      "For November, use this as planning context only and check an official short-range forecast shortly before departure. Pack: Weather-appropriate layers, Comfortable walking shoes, Medication and copies of prescriptions, Travel documents and suitable power adapters." &&
    destination?.proposal?.assumptions?.includes(
      "Weather is general model context, not a forecast; entry, health and safety guidance requires official verification.",
    ),
  provenance:
    destination?.proposal?.source?.kind === "fallback" &&
    destination?.proposal?.source?.label === "Local fallback" &&
    destination?.proposal?.source?.freshness ===
      "The model guide was unavailable or invalid; deterministic destination guidance was used from the gathered place evidence.",
  plan:
    artifact?.plan?.tripId === "agent-lab-tokyo-kyoto-multi-city" &&
    artifact?.plan?.round === 1 &&
    artifact?.plan?.sections?.length === 5 &&
    artifact?.plan?.estTotal === 3930 &&
    artifact?.plan?.conflicts?.length === 0 &&
    artifact?.metrics?.unresolvedConflicts === 0,
  artifact:
    terminal?.type === "complete" &&
    artifact?.schemaVersion === 1 &&
    artifact?.versions?.fixture === "tokyo-kyoto-multi-city-v1" &&
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
