import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const cliPath = resolve(root, "apps/web/tests/e2e/run.mjs");
const testEnv = {
  ...process.env,
  BASE_URL: "http://127.0.0.1:1",
  AGENT_LAB_LIVE_ENABLED: "true",
  USE_MOCK_TOOLS: "false",
  DEEPSEEK_API_KEY: "synthetic-local-cli-collection",
  MINIMAX_API_KEY: "synthetic-local-cli-collection",
  MAPS_API_KEY: "synthetic-local-cli-collection",
  SERPAPI_KEY: "synthetic-local-cli-collection",
  DATABASE_URL: "postgres://local-cli-collection.invalid/forbidden",
  KV_REST_API_URL: "http://127.0.0.1:1",
  KV_REST_API_TOKEN: "synthetic-local-cli-collection",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-local-cli-collection",
  CLERK_SECRET_KEY: "synthetic-local-cli-collection",
};
const runCli = (args, timeout = 15 * 60_000) =>
  spawnSync(process.execPath, [cliPath, "run", ...args, "--json"], {
    cwd: root,
    env: testEnv,
    encoding: "utf8",
    timeout,
  });

const result = runCli([]);

assert.equal(result.error, undefined, `CLI could not start: ${result.error?.message}`);
assert.equal(result.status, 0, `Default smoke failed:\n${result.stdout}\n${result.stderr}`);
const output = JSON.parse(result.stdout);
assert.equal(output.outcome, "passed");
assert.deepEqual(output.requested, ["agent-lab-single-agent"]);
assert.deepEqual(
  output.results.map(({ scenario, status }) => ({ scenario, status })),
  [{ scenario: "agent-lab-single-agent", status: "passed" }],
);
const summary = JSON.parse(readFileSync(resolve(root, output.summaryFile), "utf8"));
assert.equal(summary.selectionMode, "smoke");
assert.deepEqual(summary.requested, ["agent-lab-single-agent"]);
assert.equal(summary.reproductionCommand, "pnpm --filter @trip/web e2e run");
assert.deepEqual(
  summary.results.map(({ scenario, status }) => ({ scenario, status })),
  [{ scenario: "agent-lab-single-agent", status: "passed" }],
);
assert.ok(existsSync(resolve(root, summary.results[0].evidenceDirectory, "desktop.png")));
assert.ok(existsSync(resolve(root, summary.results[0].evidenceDirectory, "phone.png")));
assert.equal(summary.server.mode, "production");
assert.notEqual(summary.server.url, "http://127.0.0.1:1");
assert.equal(
  JSON.parse(
    readFileSync(
      resolve(root, summary.results[0].evidenceDirectory, "desktop.artifact.json"),
      "utf8",
    ),
  ).dataMode,
  "fixture",
);
console.log(`Default smoke collection passed: ${summary.invocationId}`);

const replay = runCli(["agent-lab-replay", "--dev"]);
assert.equal(replay.error, undefined, `Replay CLI could not start: ${replay.error?.message}`);
assert.equal(replay.status, 0, `Replay journey failed:\n${replay.stdout}\n${replay.stderr}`);
const replayOutput = JSON.parse(replay.stdout);
assert.equal(replayOutput.outcome, "passed");
assert.deepEqual(replayOutput.requested, ["agent-lab-replay"]);
const replaySummary = JSON.parse(readFileSync(resolve(root, replayOutput.summaryFile), "utf8"));
assert.equal(replaySummary.selectionMode, "named");
assert.equal(
  replaySummary.reproductionCommand,
  "pnpm --filter @trip/web e2e run agent-lab-replay --dev",
);
assert.equal(replaySummary.results[0].status, "passed");
assert.ok(existsSync(resolve(root, replaySummary.results[0].evidenceDirectory, "original.ndjson")));
assert.ok(
  existsSync(resolve(root, replaySummary.results[0].evidenceDirectory, "original.artifact.json")),
);
console.log(`Fixture replay journey passed: ${replaySummary.invocationId}`);

const multiple = runCli(["agent-lab-single-agent", "agent-lab-replay", "--dev"]);
assert.equal(multiple.error, undefined, `Multiple-selection CLI could not start`);
assert.equal(
  multiple.status,
  0,
  `Multiple selection failed:\n${multiple.stdout}\n${multiple.stderr}`,
);
const multipleOutput = JSON.parse(multiple.stdout);
assert.equal(multipleOutput.outcome, "passed");
assert.deepEqual(multipleOutput.requested, ["agent-lab-single-agent", "agent-lab-replay"]);
const multipleSummary = JSON.parse(readFileSync(resolve(root, multipleOutput.summaryFile), "utf8"));
assert.equal(multipleSummary.selectionMode, "named");
assert.equal(
  multipleSummary.reproductionCommand,
  "pnpm --filter @trip/web e2e run agent-lab-single-agent agent-lab-replay --dev",
);
assert.deepEqual(
  multipleSummary.results.map(({ scenario, status }) => ({ scenario, status })),
  [
    { scenario: "agent-lab-single-agent", status: "passed" },
    { scenario: "agent-lab-replay", status: "passed" },
  ],
);
assert.notEqual(
  multipleSummary.results[0].evidenceDirectory,
  multipleSummary.results[1].evidenceDirectory,
);
for (const result of multipleSummary.results)
  assert.ok(existsSync(resolve(root, result.evidenceDirectory, "summary.json")));
console.log(`Multiple named journeys passed: ${multipleSummary.invocationId}`);

const all = runCli(["--all", "--dev"]);
assert.equal(all.error, undefined, `All-supported CLI could not start`);
assert.equal(all.status, 0, `All-supported selection failed:\n${all.stdout}\n${all.stderr}`);
const allOutput = JSON.parse(all.stdout);
const allSummary = JSON.parse(readFileSync(resolve(root, allOutput.summaryFile), "utf8"));
assert.equal(allOutput.outcome, "passed");
assert.equal(allSummary.selectionMode, "all");
assert.equal(allSummary.reproductionCommand, "pnpm --filter @trip/web e2e run --all --dev");
assert.deepEqual(allSummary.requested, ["agent-lab-single-agent", "agent-lab-replay"]);
assert.deepEqual(
  allSummary.results.map(({ status }) => status),
  ["passed", "passed"],
);
console.log(`All supported journeys passed: ${allSummary.invocationId}`);

const unsupported = runCli(["agent-lab-single-agent", "agent-lab-live-gate", "--dev"]);
assert.equal(unsupported.status, 2);
const unsupportedOutput = JSON.parse(unsupported.stdout);
assert.equal(unsupportedOutput.outcome, "unsupported");
assert.deepEqual(unsupportedOutput.requested, ["agent-lab-single-agent", "agent-lab-live-gate"]);
assert.deepEqual(
  unsupportedOutput.results.map(({ status }) => status),
  ["passed", "unsupported"],
);
assert.match(unsupportedOutput.results[1].diagnostics, /No local fixture journey is registered/);
console.log(`Unsupported member remained visible: ${unsupportedOutput.summaryFile}`);

const unknown = runCli(["agent-lab-sngle-agent"]);
assert.equal(unknown.status, 2);
assert.equal(JSON.parse(unknown.stdout).outcome, "unsupported");
const conflicting = runCli(["agent-lab-single-agent", "--all"]);
assert.equal(conflicting.status, 2);
assert.match(JSON.parse(conflicting.stdout).diagnostic, /cannot be combined/);

const aggregated = runCli(
  ["agent-lab-replay", "agent-lab-single-agent", "--dev", "--timeout-ms", "1000"],
  15 * 60_000,
);
assert.equal(aggregated.status, 1, `${aggregated.stdout}\n${aggregated.stderr}`);
const aggregateOutput = JSON.parse(aggregated.stdout);
assert.equal(aggregateOutput.outcome, "timed_out");
assert.deepEqual(
  aggregateOutput.results.map(({ status }) => status),
  ["timed_out", "timed_out"],
);
const aggregateSummary = JSON.parse(
  readFileSync(resolve(root, aggregateOutput.summaryFile), "utf8"),
);
assert.deepEqual(aggregateSummary.requested, ["agent-lab-replay", "agent-lab-single-agent"]);
assert.deepEqual(
  aggregateSummary.results.map(({ status }) => status),
  ["timed_out", "timed_out"],
);
assert.match(aggregateSummary.reproductionCommand, /--timeout-ms 1000/);
assert.ok(
  aggregateSummary.results.every(({ diagnostics }) => existsSync(resolve(root, diagnostics))),
);
console.log(`Timeout aggregation retained both failures: ${aggregateOutput.summaryFile}`);
