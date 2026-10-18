import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const outputRoot = resolve(root, "output/e2e/cli-collections");
mkdirSync(outputRoot, { recursive: true });
const evidence = mkdtempSync(resolve(outputRoot, "run-"));
const commands = [];
let completed = false;
process.on("exit", (code) =>
  writeFileSync(
    resolve(evidence, "summary.json"),
    JSON.stringify(
      {
        outcome: completed && code === 0 ? "passed" : "failed",
        realBrowserCommands: commands.filter(({ cwd }) => cwd === root).length,
        fixtureCommands: commands.filter(({ cwd }) => cwd !== root).length,
        commands,
      },
      null,
      2,
    ),
  ),
);
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
const runCli = (args, timeout = 15 * 60_000, cwd = root) => {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [resolve(cwd, "apps/web/tests/e2e/run.mjs"), "run", ...args, "--json"],
    {
      cwd,
      env: testEnv,
      encoding: "utf8",
      timeout,
    },
  );
  commands.push({
    cwd,
    args,
    durationMs: Date.now() - started,
    status: result.status,
    signal: result.signal,
    error: result.error?.message,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  return result;
};

function collectionFixture() {
  const fixture = resolve(evidence, "fixture");
  const web = resolve(fixture, "apps/web");
  const journeys = resolve(web, "tests/e2e");
  mkdirSync(journeys, { recursive: true });
  mkdirSync(resolve(web, "node_modules/.bin"), { recursive: true });
  mkdirSync(resolve(web, "node_modules/playwright"), { recursive: true });
  writeFileSync(resolve(web, "node_modules/playwright/index.js"), "module.exports = {};\n");
  writeFileSync(resolve(web, "tsconfig.json"), '{"include":["**/*.ts"],"compilerOptions":{}}\n');
  for (const name of [
    "run",
    "local-cli",
    "local-cli-collections",
    "resource-ownership",
    "discovery",
    "cleanup-cli",
  ])
    copyFileSync(resolve(root, `apps/web/tests/e2e/${name}.mjs`), resolve(journeys, `${name}.mjs`));
  const next = resolve(web, "node_modules/.bin/next");
  writeFileSync(
    next,
    `#!${process.execPath}
const { mkdirSync } = require("node:fs");
const { createServer } = require("node:http");
mkdirSync(process.env.NEXT_DIST_DIR, { recursive: true });
if (process.argv[2] === "build") process.exit(0);
createServer((_request, response) => response.end("collection fixture")).listen(Number(process.env.PORT), "127.0.0.1", () => console.log("Ready in fixture"));
`,
  );
  chmodSync(next, 0o755);
  for (const name of ["agent-lab-single-agent", "agent-lab-replay", "pending-ask-refresh"])
    writeFileSync(
      resolve(journeys, `${name}.e2e.mjs`),
      `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const fixture = resolve(import.meta.dirname, "../../../..");
const mode = readFileSync(resolve(fixture, "mode.txt"), "utf8");
appendFileSync(resolve(fixture, "events.jsonl"), JSON.stringify({ scenario: ${JSON.stringify(name)}, mode, url: process.env.BASE_URL }) + "\\n");
writeFileSync(resolve(process.env.E2E_OUTPUT_DIR, "summary.json"), JSON.stringify({ fixture: true, scenario: ${JSON.stringify(name)} }));
if (mode === "hold") setInterval(() => {}, 1000);
else process.exit(mode === "fail" ? 1 : 0);
`,
    );
  return fixture;
}

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

const fixture = collectionFixture();
const events = () =>
  readFileSync(resolve(fixture, "events.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
const runFixture = (args, mode = "pass") => {
  writeFileSync(resolve(fixture, "mode.txt"), mode);
  writeFileSync(resolve(fixture, "events.jsonl"), "");
  const result = runCli(args, 30_000, fixture);
  assert.equal(result.error, undefined, result.error?.message);
  const observed = events();
  commands.at(-1).events = observed;
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(
    observed.map(({ scenario }) => scenario),
    parsed.results.filter(({ status }) => status !== "unsupported").map(({ scenario }) => scenario),
  );
  return result;
};
const multiple = runFixture(["agent-lab-single-agent", "agent-lab-replay", "--dev"]);
assert.equal(multiple.error, undefined, `Multiple-selection CLI could not start`);
assert.equal(
  multiple.status,
  0,
  `Multiple selection failed:\n${multiple.stdout}\n${multiple.stderr}`,
);
const multipleOutput = JSON.parse(multiple.stdout);
assert.equal(multipleOutput.outcome, "passed");
assert.deepEqual(multipleOutput.requested, ["agent-lab-single-agent", "agent-lab-replay"]);
const multipleSummary = JSON.parse(
  readFileSync(resolve(fixture, multipleOutput.summaryFile), "utf8"),
);
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
  assert.ok(existsSync(resolve(fixture, result.evidenceDirectory, "summary.json")));
console.log(`Multiple named journeys passed: ${multipleSummary.invocationId}`);

const all = runFixture(["--all", "--dev"]);
assert.equal(all.error, undefined, `All-supported CLI could not start`);
assert.equal(all.status, 0, `All-supported selection failed:\n${all.stdout}\n${all.stderr}`);
const allOutput = JSON.parse(all.stdout);
const allSummary = JSON.parse(readFileSync(resolve(fixture, allOutput.summaryFile), "utf8"));
assert.equal(allOutput.outcome, "passed");
assert.equal(allSummary.selectionMode, "all");
assert.equal(allSummary.reproductionCommand, "pnpm --filter @trip/web e2e run --all --dev");
assert.deepEqual(allSummary.requested, [
  "agent-lab-single-agent",
  "agent-lab-replay",
  "pending-ask-refresh",
]);
assert.deepEqual(
  allSummary.results.map(({ status }) => status),
  ["passed", "passed", "passed"],
);
console.log(`All supported journeys passed: ${allSummary.invocationId}`);

const unsupported = runFixture(["agent-lab-single-agent", "agent-lab-live-gate", "--dev"]);
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

const unknown = runFixture(["agent-lab-sngle-agent"]);
assert.equal(unknown.status, 2);
assert.equal(JSON.parse(unknown.stdout).outcome, "unsupported");
const conflicting = runFixture(["agent-lab-single-agent", "--all"]);
assert.equal(conflicting.status, 2);
assert.match(JSON.parse(conflicting.stdout).diagnostic, /cannot be combined/);

const aggregated = runFixture(
  ["agent-lab-replay", "agent-lab-single-agent", "--dev", "--timeout-ms", "1000"],
  "hold",
);
assert.equal(aggregated.status, 1, `${aggregated.stdout}\n${aggregated.stderr}`);
const aggregateOutput = JSON.parse(aggregated.stdout);
assert.equal(aggregateOutput.outcome, "timed_out");
assert.deepEqual(
  aggregateOutput.results.map(({ status }) => status),
  ["timed_out", "timed_out"],
);
const aggregateSummary = JSON.parse(
  readFileSync(resolve(fixture, aggregateOutput.summaryFile), "utf8"),
);
assert.deepEqual(aggregateSummary.requested, ["agent-lab-replay", "agent-lab-single-agent"]);
assert.deepEqual(
  aggregateSummary.results.map(({ status }) => status),
  ["timed_out", "timed_out"],
);
assert.match(aggregateSummary.reproductionCommand, /--timeout-ms 1000/);
assert.ok(
  aggregateSummary.results.every(({ diagnostics }) => existsSync(resolve(fixture, diagnostics))),
);
console.log(`Timeout aggregation retained both failures: ${aggregateOutput.summaryFile}`);

assert.deepEqual(
  events().map(({ scenario }) => scenario),
  ["agent-lab-replay", "agent-lab-single-agent"],
);
assert.ok(events().every(({ mode }) => mode === "hold"));
const failed = runFixture(["--all", "--dev"], "fail");
assert.equal(failed.status, 1, failed.stdout + failed.stderr);
const failedOutput = JSON.parse(failed.stdout);
assert.equal(failedOutput.outcome, "failed");
assert.deepEqual(
  failedOutput.results.map(({ status }) => status),
  ["failed", "failed"],
);
assert.deepEqual(
  events().map(({ scenario }) => scenario),
  ["agent-lab-single-agent", "agent-lab-replay"],
);
assert.ok(events().every(({ mode }) => mode === "fail"));
completed = true;
console.log(
  `Collections passed: two real browser controls and seven fixture commands; evidence: ${evidence}`,
);
