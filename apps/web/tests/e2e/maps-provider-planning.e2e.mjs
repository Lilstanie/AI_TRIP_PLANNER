import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/e2e/maps-provider-planning");
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
const route = transport?.items?.find(
  (item) => /Tokyo/.test(item.detail) && /Kyoto/.test(item.detail),
);

writeFileSync(`${OUT}/run.ndjson`, body);
writeFileSync(`${OUT}/artifact.json`, JSON.stringify(artifact, null, 2));
const savedArtifact = JSON.parse(readFileSync(`${OUT}/artifact.json`, "utf8"));

const checks = {
  completed:
    response.ok &&
    artifact?.status === "completed" &&
    artifact?.scenarioId === "tokyo-kyoto-multi-city" &&
    artifact?.strategyId === "multi-agent-no-revision",
  route:
    route?.kind === "transport" &&
    route?.day === 4 &&
    route?.detail ===
      "train from Tokyo to Kyoto on 2026-11-13; 140 minutes; mock Tokyo -> Kyoto. Ways to make this hop: drive 35 min, from A$8.00; train 52 min, fare not published" &&
    route?.estCost === 90,
  provenance:
    transport?.source?.kind === "mock" &&
    transport?.source?.label === "Mock booking and route data",
  plan:
    artifact?.plan?.sections?.length === 5 &&
    artifact?.plan?.conflicts?.length === 0 &&
    artifact?.metrics?.multiCityConsistent === true &&
    artifact?.metrics?.unresolvedConflicts === 0,
  artifact:
    terminal?.type === "complete" &&
    artifact?.schemaVersion === 1 &&
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
