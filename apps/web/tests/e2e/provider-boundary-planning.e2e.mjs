import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const output = resolve(process.cwd(), "output/e2e/provider-boundary-planning");
mkdirSync(output, { recursive: true });

async function run(label, scenarioId, strategyId) {
  const response = await fetch(`${base}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, strategyId, dataMode: "fixture" }),
  });
  const body = await response.text();
  const frames = body.split("\n").filter(Boolean).map(JSON.parse);
  const terminal = frames.at(-1);
  writeFileSync(resolve(output, `${label}.ndjson`), body);
  writeFileSync(
    resolve(output, `${label}.artifact.json`),
    JSON.stringify(terminal?.artifact, null, 2),
  );
  return {
    response,
    terminal,
    artifact: terminal?.artifact,
    saved: JSON.parse(readFileSync(resolve(output, `${label}.artifact.json`), "utf8")),
  };
}

const [multi, plain, revised] = await Promise.all([
  run("multi-city", "tokyo-kyoto-multi-city", "multi-agent-no-revision"),
  run("tight-plain", "tokyo-couple-tight-budget", "multi-agent-no-revision"),
  run("tight-revised", "tokyo-couple-tight-budget", "multi-agent-targeted-revision"),
]);

const proposal = (artifact, id) =>
  artifact?.plan?.sections?.find((section) => section.id === id)?.proposal;
const events = (artifact, type) =>
  artifact?.events?.map((entry) => entry.event).filter((event) => event.type === type) ?? [];
const checks = {
  completed: [multi, plain, revised].every(
    ({ response, terminal, artifact, saved }) =>
      response.ok &&
      terminal?.type === "complete" &&
      artifact?.status === "completed" &&
      artifact?.schemaVersion === 1 &&
      JSON.stringify(saved) === JSON.stringify(artifact) &&
      artifact?.dataMode === "fixture" &&
      artifact?.events?.every((entry) => entry.dataMode === "fixture"),
  ),
  plan:
    multi.artifact?.plan?.tripId === "agent-lab-tokyo-kyoto-multi-city" &&
    multi.artifact?.plan?.brief?.origin === "Sydney" &&
    multi.artifact?.plan?.brief?.destination === "Tokyo & Kyoto" &&
    multi.artifact?.plan?.brief?.groupSize === 2 &&
    multi.artifact?.plan?.brief?.budgetTotal === 6500 &&
    JSON.stringify(multi.artifact?.plan?.brief?.dates) ===
      JSON.stringify(["2026-11-10", "2026-11-17"]) &&
    multi.artifact?.plan?.sections?.length === 5 &&
    multi.artifact?.plan?.estTotal === 3930 &&
    multi.artifact?.plan?.conflicts?.length === 0 &&
    multi.artifact?.metrics?.multiCityConsistent === true,
  provenance:
    proposal(multi.artifact, "transport")?.source?.kind === "mock" &&
    proposal(multi.artifact, "accommodation")?.source?.kind === "mock" &&
    proposal(multi.artifact, "destination-guide")?.source?.kind === "fallback",
  conflict:
    plain.artifact?.plan?.round === 1 &&
    plain.artifact?.metrics?.unresolvedConflicts > 0 &&
    plain.artifact?.metrics?.withinBudget === false,
  revision:
    revised.artifact?.plan?.round === 2 &&
    revised.artifact?.metrics?.unresolvedConflicts === 0 &&
    revised.artifact?.metrics?.withinBudget === true &&
    events(revised.artifact, "lab_revision_started")?.[0]?.agent === "transport" &&
    events(revised.artifact, "lab_revision_scored")?.[0]?.kept === true &&
    events(revised.artifact, "lab_loop_stopped")?.[0]?.reason === "converged",
  artifactStructure: [multi, plain, revised].every(({ artifact }) =>
    Boolean(
      artifact?.runId &&
      artifact?.startedAt &&
      artifact?.completedAt &&
      artifact?.versions?.fixture &&
      artifact?.versions?.evaluator === "scenario-rules-v2" &&
      artifact?.metrics?.checks?.length &&
      artifact?.events?.length &&
      artifact.events.every(
        (entry, index) =>
          entry.runId === artifact.runId &&
          entry.sequence === index + 1 &&
          entry.scenarioId === artifact.scenarioId,
      ) &&
      events(artifact, "lab_run_completed").length === 1,
    ),
  ),
};
const summary = { passed: Object.values(checks).every(Boolean), checks };
writeFileSync(resolve(output, "summary.json"), JSON.stringify(summary, null, 2));
for (const [name, passed] of Object.entries(checks))
  console.log(`${passed ? "ok  " : "FAIL"} ${name}`);
console.log(`\nArtifacts: ${output}`);
if (!summary.passed) process.exitCode = 1;
