import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-benchmark");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const frames = (body) =>
  body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

async function run(scenarioId, strategyId, faultProfileId) {
  const response = await fetch(`${BASE}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId,
      strategyId,
      dataMode: "fixture",
      ...(faultProfileId ? { faultProfileId } : {}),
    }),
  });
  const body = await response.text();
  const parsed = frames(body);
  const artifact = parsed.at(-1)?.artifact;
  if (!response.ok || !artifact)
    throw new Error(`Benchmark run failed: ${response.status} ${body}`);
  return { body, artifact };
}

async function runLive(scenarioId, strategyId) {
  const response = await fetch(`${BASE}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, strategyId, dataMode: "live" }),
  });
  const body = await response.text();
  const parsed = frames(body);
  if (!response.ok || parsed.at(-1)?.type === "rejected") {
    return {
      rejection: parsed.at(-1)?.reason ?? `http_${response.status}`,
      status: response.status,
    };
  }
  const artifact = parsed.at(-1)?.artifact;
  if (!artifact) return { rejection: "missing_artifact", status: response.status };
  writeFileSync(`${OUT}/live.${scenarioId}.${strategyId}.${artifact.runId}.ndjson`, body);
  writeFileSync(
    `${OUT}/live.${scenarioId}.${strategyId}.${artifact.runId}.artifact.json`,
    JSON.stringify(artifact, null, 2),
  );
  return { artifact };
}

const checksOf = (artifact) => (artifact.status === "completed" ? artifact.metrics.checks : []);
const actualOutcome = (artifact) => {
  if (artifact.status === "failed") return "failed";
  if (artifact.metrics.stopReason === "infeasible_budget") return "safe-stop";
  if (artifact.metrics.stopReason === "no_improvement") return "partial";
  if (artifact.events.some(({ event }) => event.type === "tool_failed")) return "partial";
  if (checksOf(artifact).some(({ passed }) => !passed)) return "partial";
  return "complete";
};
const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};
const medianLabel = (value) => (value === null ? "n/a" : `${value} ms`);
const stableArtifact = (artifact) => {
  const metrics = { ...artifact.metrics };
  delete metrics.durationMs;
  delete metrics.latencyMs;
  return {
    scenarioId: artifact.scenarioId,
    strategyId: artifact.strategyId,
    faultProfileId: artifact.faultProfileId,
    status: artifact.status,
    failure: artifact.failure ?? null,
    versions: artifact.versions,
    events: artifact.events.map(({ event }) => event),
    plan: artifact.plan ?? null,
    metrics,
  };
};
const fixtureReportProjection = (
  sourceArtifacts,
  scenarioById,
  faultProfiles,
  strategies,
  generatedAt,
) => ({
  generatedAt,
  runs: sourceArtifacts.map((artifact) => {
    const scenario = scenarioById.get(artifact.scenarioId);
    const fault = faultProfiles.find(({ id }) => id === artifact.faultProfileId);
    const checks = checksOf(artifact);
    return {
      scenarioId: artifact.scenarioId,
      strategyId: artifact.strategyId,
      faultProfileId: artifact.faultProfileId,
      dataMode: artifact.dataMode,
      status: artifact.status,
      expectedOutcome: scenario.expectedOutcome,
      expectedRecovery: fault?.expected ?? null,
      observedRecovery: fault ? reportFaultOutcome(artifact) : null,
      actualOutcome: actualOutcome(artifact),
      checks,
      mustPassChecks: (scenario.mustPassCheckIds ?? []).map((id) => ({
        id,
        passed: checks.find((item) => item.id === id)?.passed ?? false,
      })),
      mustPassChecksPassed: (scenario.mustPassCheckIds ?? []).every(
        (id) => checks.find((item) => item.id === id)?.passed === true,
      ),
      usage: artifact.status === "completed" ? (artifact.metrics.usage ?? null) : null,
      latencyMs: artifact.status === "completed" ? artifact.metrics.latencyMs : null,
      artifact: fault
        ? `fault.${fault.id}.artifact.json`
        : `${artifact.scenarioId}.${artifact.strategyId}.artifact.json`,
    };
  }),
  summaries: strategies.map((strategyId) => {
    const rows = sourceArtifacts.filter(
      (artifact) =>
        artifact.strategyId === strategyId &&
        artifact.dataMode === "fixture" &&
        !artifact.faultProfileId,
    );
    return {
      strategyId,
      medianLatencyMs: median(
        rows
          .filter((artifact) => artifact.status === "completed")
          .map((artifact) => artifact.metrics.latencyMs),
      ),
    };
  }),
});
const fixtureProjectionMarkdown = ({ generatedAt, runs }) =>
  [
    `Generated: ${generatedAt}`,
    "| Scenario | Strategy | Fault | Status | Expected / actual | Checks | Recovery | Usage | Fixture latency | Artifact |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |",
    ...runs.map((row) => {
      const checkCount = `${row.checks.filter((item) => item.passed).length}/${row.checks.length}`;
      const usage =
        row.usage?.status === "measured"
          ? `${row.usage.modelCalls} calls, ${row.usage.totalTokens} tokens`
          : "unavailable";
      const latency = medianLabel(row.latencyMs);
      const recovery = row.expectedRecovery
        ? `${row.expectedRecovery} / ${row.observedRecovery}`
        : "n/a";
      return `| ${row.scenarioId} | ${row.strategyId} | ${row.faultProfileId ?? "n/a"} | ${row.status} | ${row.expectedOutcome} / ${row.actualOutcome} | ${checkCount} | ${recovery} | ${usage} | ${latency} | [artifact](./${row.artifact}) |`;
    }),
  ].join("\n");
const withoutGeneratedAt = (serialized, generatedAt) =>
  serialized.replace(generatedAt, "<generatedAt>");
const stableFixtureProjection = (projection) => ({
  ...projection,
  runs: projection.runs.map((row) => ({ ...row, latencyMs: "<measured>" })),
  summaries: projection.summaries.map((row) => ({ ...row, medianLatencyMs: "<measured>" })),
});
const stableFixtureProjectionMarkdown = (projection) =>
  fixtureProjectionMarkdown({
    ...projection,
    runs: projection.runs.map((row) => ({ ...row, latencyMs: null })),
  });

check(
  actualOutcome({ status: "failed", metrics: {}, events: [] }) === "failed",
  "failed artifact is not reported as a deliberate safety stop",
);
check(median([]) === null, "an all-failed strategy has no numeric latency median");
check(medianLabel(median([])) === "n/a", "an all-failed strategy renders median latency as n/a");

async function main() {
  const registryResponse = await fetch(`${BASE}/api/agent-lab/benchmark`);
  if (!registryResponse.ok)
    throw new Error(`Benchmark registry unavailable: ${registryResponse.status}`);
  const benchmark = await registryResponse.json();
  const scenarios = benchmark.fixture.scenarios;
  const scenarioIds = scenarios.map(({ id }) => id);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const STRATEGIES = benchmark.fixture.strategies.map(({ id }) => id);
  const faultProfiles = benchmark.fixture.faults;
  const liveScenarioIds = benchmark.live.scenarioIds;
  check(benchmark.version === "1.0.7", "versioned benchmark registry is served");
  check(
    scenarioById
      .get("tokyo-conflicting-preferences")
      ?.mustPassCheckIds.includes("meal-preference-tradeoff") &&
      scenarioById.get("tokyo-vague-brief")?.mustPassCheckIds.includes("actionable-brief"),
    "conflicting-preference and vague-brief scenarios declare their specific must-pass checks",
  );
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    const url = message.location().url;
    if (message.type() === "error" && !url.endsWith("/favicon.ico"))
      pageErrors.push(`${message.text()} (${url})`);
  });
  const loaded = await page.goto(`${BASE}/agent-lab`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  check(loaded?.status() === 200, "Agent Lab page loads for artifact replay");
  const options = await page
    .getByLabel("Scenario")
    .locator("option")
    .evaluateAll((items) => items.map((item) => item.value));
  check(
    scenarioIds.every((id) => options.includes(id)),
    "all registered benchmark scenarios are available in Agent Lab",
  );

  const { execFileSync } = await import("node:child_process");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const artifacts = [];
  const artifactPaths = new Map();
  for (const scenarioId of scenarioIds) {
    for (const strategyId of STRATEGIES) {
      const result = await run(scenarioId, strategyId);
      if (scenarioId === "tokyo-date-night-edge") {
        const days =
          result.artifact.plan.sections
            .find(({ id }) => id === "itinerary")
            ?.proposal?.items.filter(({ kind }) => kind === "activity") ?? [];
        const dayChecks = result.artifact.metrics.checks.filter(
          ({ id }) => id === "trip-days" || id === "stay-date-range" || id === "stay-nights",
        );
        check(
          new Set(days.map(({ day }) => day)).has(1) &&
            new Set(days.map(({ day }) => day)).has(2) &&
            days.every(({ day }) => day >= 1 && day <= 2) &&
            dayChecks.length === 3 &&
            dayChecks.every(({ passed }) => passed),
          "one-night scenario fixture covers both inclusive itinerary days",
        );
        const stay = result.artifact.plan.sections
          .find(({ id }) => id === "accommodation")
          ?.proposal?.items.find(({ kind }) => kind === "hotel");
        check(
          /\b1 night\b/i.test(stay?.detail ?? "") &&
            stay?.detail.includes("2026-11-10 to 2026-11-11") &&
            stay.estCost === 380,
          "one-night scenario fixture has matching stay evidence and cost",
        );
      }
      if (scenarioId === "tokyo-couple-infeasible-budget") {
        const { estTotal, budgetTotal, overrunPct } = result.artifact.plan;
        check(
          Math.abs(overrunPct - ((estTotal - budgetTotal) / budgetTotal) * 100) < 0.001,
          "infeasible-budget fixture overrun percentage uses its registered budget",
        );
      }
      if (
        strategyId === "single-agent-baseline" &&
        scenarioId === "tokyo-conflicting-preferences"
      ) {
        const meals =
          result.artifact.plan.sections
            .find(({ id }) => id === "dining")
            ?.proposal?.items.filter(({ kind }) => kind === "meal") ?? [];
        check(
          meals.some(({ detail }) => /vegetarian/i.test(detail)) &&
            meals.some(({ detail }) => /local meat/i.test(detail)),
          "conflicting-preference fixture includes evidence for both stated meal preferences",
        );
      }
      if (strategyId === "single-agent-baseline" && scenarioId === "tokyo-vague-brief") {
        const activities =
          result.artifact.plan.sections
            .find(({ id }) => id === "itinerary")
            ?.proposal?.items.filter(({ kind }) => kind === "activity") ?? [];
        const meals =
          result.artifact.plan.sections
            .find(({ id }) => id === "dining")
            ?.proposal?.items.filter(({ kind }) => kind === "meal") ?? [];
        check(
          activities.length >= 2 &&
            activities.every(({ detail, day, location, startTime }) =>
              Boolean(detail && day && location && startTime),
            ) &&
            meals.some(({ detail, location }) => /local/i.test(detail) && Boolean(location)),
          "vague-brief fixture turns broad preferences into scheduled activities and local dining evidence",
        );
      }
      artifacts.push(result.artifact);
      const artifactPath = `${scenarioId}.${strategyId}.artifact.json`;
      artifactPaths.set(result.artifact.runId, artifactPath);
      writeFileSync(`${OUT}/${scenarioId}.${strategyId}.ndjson`, result.body);
      writeFileSync(`${OUT}/${artifactPath}`, JSON.stringify(result.artifact, null, 2));
    }
  }

  for (const fault of faultProfiles) {
    const result = await run(fault.scenarioId, fault.strategyId, fault.id);
    artifacts.push(result.artifact);
    const artifactPath = `fault.${fault.id}.artifact.json`;
    artifactPaths.set(result.artifact.runId, artifactPath);
    writeFileSync(`${OUT}/fault.${fault.id}.ndjson`, result.body);
    writeFileSync(`${OUT}/${artifactPath}`, JSON.stringify(result.artifact, null, 2));
  }

  const faultIds = new Set(artifacts.map((artifact) => artifact.faultProfileId).filter(Boolean));
  check(
    faultProfiles.every(({ id }) => faultIds.has(id)),
    "every registered fault profile has a retained artifact",
  );
  const scenarioRunCount = scenarioIds.length * STRATEGIES.length;
  check(
    artifacts.filter((artifact) => !artifact.faultProfileId).length === scenarioRunCount,
    "scenario-strategy runs are counted independently of fault experiments",
  );
  check(
    artifacts.filter((artifact) => artifact.faultProfileId).length === faultProfiles.length,
    "each registered fault experiment is counted exactly once",
  );
  check(
    artifacts.length === scenarioRunCount + faultProfiles.length,
    "all scenario and fault artifacts are retained",
  );

  const repeatScenario = "tokyo-date-night-edge";
  const repeatStrategy = STRATEGIES[0];
  const repeatedArtifacts = [
    (await run(repeatScenario, repeatStrategy)).artifact,
    ...(await Promise.all(
      faultProfiles
        .slice(0, 2)
        .map(async (fault) => (await run(fault.scenarioId, fault.strategyId, fault.id)).artifact),
    )),
  ];
  const comparedArtifacts = [
    artifacts.find(
      (artifact) =>
        artifact.scenarioId === repeatScenario && artifact.strategyId === repeatStrategy,
    ),
    ...faultProfiles
      .slice(0, 2)
      .map((fault) => artifacts.find((artifact) => artifact.faultProfileId === fault.id)),
  ];
  check(
    JSON.stringify(comparedArtifacts.map(stableArtifact)) ===
      JSON.stringify(repeatedArtifacts.map(stableArtifact)),
    "representative fixture and fault reports repeat apart from run timestamps and measured timing",
  );
  const firstReportProjection = fixtureReportProjection(
    comparedArtifacts,
    scenarioById,
    faultProfiles,
    STRATEGIES,
    "2026-01-01T00:00:00.000Z",
  );
  const secondReportProjection = fixtureReportProjection(
    repeatedArtifacts,
    scenarioById,
    faultProfiles,
    STRATEGIES,
    "2026-01-02T00:00:00.000Z",
  );
  check(
    firstReportProjection.runs.every(
      (row) => row.latencyMs === null || (Number.isFinite(row.latencyMs) && row.latencyMs >= 0),
    ) &&
      firstReportProjection.summaries.every(
        (row) => row.medianLatencyMs === null || Number.isFinite(row.medianLatencyMs),
      ),
    "#402 fixture report records measured latency per run and strategy",
  );
  check(
    withoutGeneratedAt(
      JSON.stringify(stableFixtureProjection(firstReportProjection), null, 2),
      firstReportProjection.generatedAt,
    ) ===
      withoutGeneratedAt(
        JSON.stringify(stableFixtureProjection(secondReportProjection), null, 2),
        secondReportProjection.generatedAt,
      ) &&
      withoutGeneratedAt(
        stableFixtureProjectionMarkdown(firstReportProjection),
        firstReportProjection.generatedAt,
      ) ===
        withoutGeneratedAt(
          stableFixtureProjectionMarkdown(secondReportProjection),
          secondReportProjection.generatedAt,
        ),
    "#402 JSON and Markdown fixture reports are stable after normalizing run timestamps and measured latency",
  );

  const report = {
    benchmark: { id: benchmark.id, version: benchmark.version },
    generatedAt: new Date().toISOString(),
    commit,
    artifactSchemaVersion: artifacts[0].schemaVersion,
    dataMode: "fixture",
    configuration: {
      strategies: STRATEGIES,
      scenarios: scenarios,
      faults: faultProfiles,
      repeats: benchmark.fixture.repeats,
    },
    runs: artifacts.map((artifact) => ({
      scenarioId: artifact.scenarioId,
      strategyId: artifact.strategyId,
      faultProfileId: artifact.faultProfileId,
      dataMode: artifact.dataMode,
      status: artifact.status,
      expectedOutcome: scenarioById.get(artifact.scenarioId).expectedOutcome,
      expectedRecovery: artifact.faultProfileId
        ? faultProfiles.find(({ id }) => id === artifact.faultProfileId).expected
        : null,
      observedRecovery: artifact.faultProfileId ? reportFaultOutcome(artifact) : null,
      actualOutcome: actualOutcome(artifact),
      checks: checksOf(artifact),
      mustPassChecks: (scenarioById.get(artifact.scenarioId)?.mustPassCheckIds ?? []).map((id) => ({
        id,
        passed: checksOf(artifact).find((item) => item.id === id)?.passed ?? false,
      })),
      mustPassChecksPassed: (scenarioById.get(artifact.scenarioId)?.mustPassCheckIds ?? []).every(
        (id) => checksOf(artifact).find((item) => item.id === id)?.passed === true,
      ),
      usage: artifact.status === "completed" ? (artifact.metrics.usage ?? null) : null,
      latencyMs: artifact.status === "completed" ? artifact.metrics.latencyMs : null,
      artifact: artifactPaths.get(artifact.runId),
    })),
    summaries: STRATEGIES.map((strategyId) => {
      const rows = artifacts.filter(
        (artifact) =>
          artifact.strategyId === strategyId &&
          artifact.dataMode === "fixture" &&
          !artifact.faultProfileId,
      );
      const passed = rows.filter((artifact) => {
        const scenario = scenarioById.get(artifact.scenarioId);
        const checks = checksOf(artifact);
        return (
          actualOutcome(artifact) === scenario.expectedOutcome &&
          (scenario.mustPassCheckIds ?? []).every(
            (id) => checks.find((item) => item.id === id)?.passed === true,
          )
        );
      }).length;
      return {
        strategyId,
        passed,
        failed: rows.length - passed,
        denominator: scenarioIds.length,
        passRate: scenarioIds.length ? passed / scenarioIds.length : null,
        medianLatencyMs: median(
          rows
            .filter((artifact) => artifact.status === "completed")
            .map((artifact) => artifact.metrics.latencyMs),
        ),
        usageReported: rows.filter(
          (artifact) =>
            artifact.status === "completed" && artifact.metrics.usage?.status === "measured",
        ).length,
        usageUnavailable: rows.filter(
          (artifact) =>
            artifact.status !== "completed" || artifact.metrics.usage?.status !== "measured",
        ).length,
      };
    }),
    faultSummaries: faultProfiles.map((fault) => {
      const rows = artifacts.filter((artifact) => artifact.faultProfileId === fault.id);
      return {
        faultProfileId: fault.id,
        expected: fault.expected,
        runs: rows.length,
        denominator: 1,
        observed: reportFaultOutcome(rows[0]),
      };
    }),
    live: {
      status: "not-run",
      runs: [],
      skippedStrategies: benchmark.live.skippedStrategies,
      note: "Live benchmark is opt-in and is reported separately.",
    },
  };
  writeFileSync(`${OUT}/fixture-report.json`, JSON.stringify(report, null, 2));
  writeFileSync(
    `${OUT}/fixture-report.md`,
    [
      `# Agent Lab fixture benchmark ${benchmark.version}`,
      "",
      `Commit: ${commit} · Artifact schema: ${report.artifactSchemaVersion} · Generated: ${report.generatedAt}`,
      "",
      "Fixture data only. Failed and stopped runs remain in the denominators. Usage is unavailable when the provider did not report it.",
      "",
      "| Strategy | Passed | Not passed | Denominator | Pass rate | Median fixture latency | Usage reported / unavailable |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...report.summaries.map(
        (item) =>
          `| ${item.strategyId} | ${item.passed} | ${item.failed} | ${item.denominator} | ${item.passRate === null ? "n/a" : `${(item.passRate * 100).toFixed(1)}%`} | ${medianLabel(item.medianLatencyMs)} | ${item.usageReported} / ${item.usageUnavailable} |`,
      ),
      "",
      "## Scenario and fault runs",
      "",
      "| Scenario | Strategy | Fault | Status | Expected / actual | Checks | Recovery | Usage | Fixture latency | Artifact |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |",
      ...report.runs.map((row) => {
        const checkCount = `${row.checks.filter((item) => item.passed).length}/${row.checks.length}`;
        const usage =
          row.usage?.status === "measured"
            ? `${row.usage.modelCalls} calls, ${row.usage.totalTokens} tokens`
            : "unavailable";
        const latency = medianLabel(row.latencyMs);
        const recovery = row.expectedRecovery
          ? `${row.expectedRecovery} / ${row.observedRecovery}`
          : "n/a";
        return `| ${row.scenarioId} | ${row.strategyId} | ${row.faultProfileId ?? "n/a"} | ${row.status} | ${row.expectedOutcome} / ${row.actualOutcome} | ${checkCount} | ${recovery} | ${usage} | ${latency} | [artifact](./${row.artifact}) |`;
      }),
      "",
      "Machine-readable report: [fixture-report.json](fixture-report.json). This fixture report is not a live-provider result and does not assess plan quality.",
      "",
    ].join("\n"),
  );

  check(
    report.runs.length === artifacts.length,
    "report includes successful, failed and stopped artifacts",
  );
  check(
    report.runs.every(
      (row) =>
        row.dataMode === "fixture" &&
        row.runId === undefined &&
        (row.status === "completed"
          ? Number.isFinite(row.latencyMs) && row.latencyMs >= 0
          : row.latencyMs === null),
    ),
    "report rows stay fixture-only, omit run identifiers and report each measured latency",
  );
  check(
    report.summaries.every(
      (row) =>
        row.denominator === scenarioIds.length &&
        row.denominator ===
          artifacts.filter(
            (artifact) =>
              artifact.strategyId === row.strategyId &&
              artifact.dataMode === "fixture" &&
              !artifact.faultProfileId,
          ).length,
    ),
    "strategy denominators include every scenario and exclude separately reported fault experiments",
  );
  check(
    report.summaries.every((summary) => {
      const rows = report.runs.filter(
        (row) => row.strategyId === summary.strategyId && !row.faultProfileId,
      );
      const passed = rows.filter(
        (row) => row.actualOutcome === row.expectedOutcome && row.mustPassChecksPassed,
      ).length;
      return (
        summary.passed === passed &&
        summary.failed === summary.denominator - passed &&
        summary.passed + summary.failed === summary.denominator
      );
    }),
    "strategy summaries count expected outcomes and must-pass checks and partition every scenario",
  );
  check(
    report.faultSummaries.every(
      (row) => row.runs === row.denominator && row.observed === row.expected,
    ),
    "fault recovery outcomes match expectations with explicit denominators",
  );

  if (process.env.AGENT_LAB_BENCHMARK_LIVE === "true") {
    const liveArtifacts = [];
    const refusals = [];
    let stoppedByGate = false;
    for (const scenarioId of liveScenarioIds) {
      for (const { id: strategyId } of benchmark.live.strategies) {
        for (let repeat = 1; repeat <= benchmark.live.repeats; repeat += 1) {
          if (stoppedByGate) break;
          const result = await runLive(scenarioId, strategyId);
          if (result.artifact)
            liveArtifacts.push({ scenarioId, strategyId, repeat, artifact: result.artifact });
          else {
            refusals.push({ scenarioId, strategyId, repeat, reason: result.rejection });
            stoppedByGate = true;
          }
        }
        if (stoppedByGate) break;
      }
      if (stoppedByGate) break;
    }
    const spread = (values) => (values.length ? Math.max(...values) - Math.min(...values) : null);
    const pairs = liveScenarioIds.flatMap((scenarioId) =>
      benchmark.fixture.strategies.map(({ id: strategyId }) => {
        const runs = liveArtifacts.filter(
          (entry) => entry.scenarioId === scenarioId && entry.strategyId === strategyId,
        );
        const refusal = refusals.find(
          (entry) => entry.scenarioId === scenarioId && entry.strategyId === strategyId,
        );
        const latencies = runs
          .filter((entry) => entry.artifact.status === "completed")
          .map((entry) => entry.artifact.metrics.latencyMs);
        const usageReported = runs.filter(
          (entry) =>
            entry.artifact.status === "completed" &&
            entry.artifact.metrics.usage?.status === "measured",
        ).length;
        return {
          scenarioId,
          strategyId,
          status: !benchmark.live.strategies.some(({ id }) => id === strategyId)
            ? "skipped"
            : runs.length
              ? "measured"
              : refusal
                ? "refused"
                : "not-attempted",
          repeats: runs.length,
          medianLatencyMs: median(latencies),
          latencySpreadMs: spread(latencies),
          usageReported,
          usageUnavailable: runs.length - usageReported,
          outcomes: runs.map((entry) => ({
            runId: entry.artifact.runId,
            status: entry.artifact.status,
            outcome: actualOutcome(entry.artifact),
          })),
        };
      }),
    );
    report.live = {
      status: refusals.length ? "refused-by-live-gate" : "complete",
      dataMode: "live",
      scenarios: liveScenarioIds,
      maximumRuns: benchmark.live.maxRuns,
      runs: liveArtifacts.map(({ scenarioId, strategyId, repeat, artifact }) => ({
        scenarioId,
        strategyId,
        repeat,
        runId: artifact.runId,
        status: artifact.status,
        outcome: actualOutcome(artifact),
        latencyMs: artifact.status === "completed" ? artifact.metrics.latencyMs : null,
        usage: artifact.status === "completed" ? (artifact.metrics.usage ?? null) : null,
      })),
      summaries: pairs,
      refusals,
      skippedStrategies: benchmark.live.skippedStrategies,
    };
    writeFileSync(`${OUT}/live-report.json`, JSON.stringify(report.live, null, 2));
    writeFileSync(
      `${OUT}/live-report.md`,
      [
        `# Agent Lab live benchmark ${benchmark.version}`,
        "",
        `Status: ${report.live.status}. Data mode: live. Scenarios: ${liveScenarioIds.join(", ")}.`,
        "",
        "Live provider outcomes are reported separately from fixture results. Strategies without a live implementation are listed as skipped. The live gate may refuse runs at its concurrency or hourly limit.",
        "",
        "| Scenario | Strategy | Status | Repeats | Median latency | Latency spread | Usage reported / unavailable |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: |",
        ...report.live.summaries.map(
          (row) =>
            `| ${row.scenarioId} | ${row.strategyId} | ${row.status} | ${row.repeats} | ${row.medianLatencyMs === null ? "n/a" : `${row.medianLatencyMs} ms`} | ${row.latencySpreadMs === null ? "n/a" : `${row.latencySpreadMs} ms`} | ${row.usageReported} / ${row.usageUnavailable} |`,
        ),
        "",
        `Refusals: ${JSON.stringify(refusals)}. Full run details: [live-report.json](live-report.json).`,
        "",
      ].join("\n"),
    );
  }

  const replayArtifact = artifacts.find((artifact) => artifact.status === "completed");
  const replayFile = `${OUT}/replay.artifact.json`;
  writeFileSync(replayFile, JSON.stringify(replayArtifact, null, 2));
  await page.locator("input[data-agent-lab-replay-input]").setInputFiles(replayFile);
  await page
    .getByRole("status")
    .getByText("Replay complete", { exact: true })
    .waitFor({ timeout: 120_000 });
  const metric = await page
    .locator(".agent-lab__metrics dt")
    .getByText("Checks", { exact: true })
    .evaluate((dt) => dt.parentElement.querySelector("dd")?.textContent ?? "");
  const reportChecks = `${replayArtifact.metrics.checks.filter((item) => item.passed).length}/${replayArtifact.metrics.checks.length} passed`;
  check(
    metric.trim() === reportChecks,
    `replay page displays the report artifact's checks (${reportChecks})`,
  );
  await page.screenshot({ path: `${OUT}/fixture-replay.png`, fullPage: true });
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        failures,
        scenarioIds,
        strategies: STRATEGIES,
        faults: faultProfiles.map(({ id }) => id),
        artifactCount: artifacts.length,
        screenshot: "fixture-replay.png",
        report: "fixture-report.json",
      },
      null,
      2,
    ),
  );
  check(
    pageErrors.length === 0,
    `Agent Lab replay emitted no browser errors (${pageErrors.length}): ${pageErrors.join(" | ")}`,
  );
  await browser.close();
  if (failures.length) throw new Error(`${failures.length} benchmark E2E checks failed`);
}

function reportFaultOutcome(artifact) {
  if (!artifact) return "missing";
  if (artifact.status === "failed") return "terminal";
  if (
    artifact.events.some(
      ({ event }) => event.type === "tool_failed" || event.type === "lab_supervisor_fallback",
    )
  )
    return "degraded";
  return actualOutcome(artifact);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
