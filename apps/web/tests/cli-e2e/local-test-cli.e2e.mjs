import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const sharedTsconfigPath = resolve(root, "apps/web/tsconfig.json");
const sharedTsconfigBefore = readFileSync(sharedTsconfigPath, "utf8");
let integrationHits = 0;
const integrationSentinel = createServer((_request, response) => {
  integrationHits += 1;
  response.writeHead(200, { "content-type": "application/json" }).end("{}");
});
await new Promise((done) => integrationSentinel.listen(0, "127.0.0.1", done));
const integrationUrl = `http://127.0.0.1:${integrationSentinel.address().port}`;
const unrelatedServer = createServer((_request, response) => response.end("survived"));
await new Promise((done) => unrelatedServer.listen(0, "127.0.0.1", done));
const unrelatedUrl = `http://127.0.0.1:${unrelatedServer.address().port}`;
const unrelatedSentinel = resolve(root, "output/e2e/local-test-cli/unrelated-data-sentinel.txt");
writeFileSync(unrelatedSentinel, "preserve this file\n");
const syntheticEnv = {
  ...process.env,
  BASE_URL: "http://127.0.0.1:1",
  USE_MOCK_TOOLS: "false",
  AGENT_LAB_LIVE_ENABLED: "true",
  DEEPSEEK_API_KEY: "synthetic-local-cli-test",
  MINIMAX_API_KEY: "synthetic-local-cli-test",
  MAPS_API_KEY: "synthetic-local-cli-test",
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "synthetic-local-cli-test",
  SERPAPI_KEY: "synthetic-local-cli-test",
  WEATHER_API_KEY: "synthetic-local-cli-test",
  DATABASE_URL: "postgres://local-cli-test.invalid/forbidden",
  KV_REST_API_URL: integrationUrl,
  KV_REST_API_TOKEN: "synthetic-local-cli-test",
  UPSTASH_REDIS_REST_URL: integrationUrl,
  UPSTASH_REDIS_REST_TOKEN: "synthetic-local-cli-test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-local-cli-test",
  CLERK_SECRET_KEY: "synthetic-local-cli-test",
  DEEPSEEK_BASE_URL: integrationUrl,
  MINIMAX_BASE_URL: integrationUrl,
  MAPS_API_BASE_URL: integrationUrl,
  OSRM_BASE_URL: integrationUrl,
  NOMINATIM_BASE_URL: integrationUrl,
  PHOTON_BASE_URL: integrationUrl,
  TRANSITOUS_BASE_URL: integrationUrl,
};
const execute = (args, env = syntheticEnv) =>
  new Promise((done) => {
    const child = spawn("pnpm", args, {
      cwd: root,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM");
      } catch {}
      setTimeout(() => {
        try {
          process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
        } catch {}
      }, 5000);
    }, 20 * 60_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      done({ error, status: null, stdout, stderr });
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      done({ status: timedOut ? 124 : status, signal, stdout, stderr });
    });
  });

const unsupported = await execute([
  "--silent",
  "--filter",
  "@trip/web",
  "e2e",
  "run",
  "not-a-local-journey",
  "--json",
]);
assert.notEqual(unsupported.status, 0);
assert.equal(JSON.parse(unsupported.stdout).outcome, "unsupported");

const playwrightModule = resolve(root, "apps/web/node_modules/playwright");
const heldPlaywrightModule = `${playwrightModule}.local-cli-test-hold`;
assert.ok(lstatSync(playwrightModule).isSymbolicLink());
assert.equal(existsSync(heldPlaywrightModule), false);
renameSync(playwrightModule, heldPlaywrightModule);
let blocked;
try {
  blocked = await execute([
    "--silent",
    "--filter",
    "@trip/web",
    "e2e",
    "run",
    "agent-lab-single-agent",
    "--json",
  ]);
} finally {
  renameSync(heldPlaywrightModule, playwrightModule);
}
assert.notEqual(blocked.status, 0, `Blocked prerequisite unexpectedly passed: ${blocked.stderr}`);
assert.equal(JSON.parse(blocked.stdout).outcome, "blocked");

const run = await execute([
  "--silent",
  "--filter",
  "@trip/web",
  "e2e",
  "run",
  "agent-lab-single-agent",
  "--json",
]);

assert.equal(run.error, undefined, `CLI process failed to start: ${run.error?.message}`);
assert.equal(run.status, 0, `CLI exited ${run.status}:\n${run.stdout}\n${run.stderr}`);
const result = JSON.parse(run.stdout);
assert.equal(result.outcome, "passed");
assert.deepEqual(result.requested, ["agent-lab-single-agent"]);
assert.equal(result.results[0].status, "passed");
assert.ok(result.summaryFile);
assert.ok(result.evidenceDirectory);

const summary = JSON.parse(readFileSync(resolve(root, result.summaryFile), "utf8"));
assert.equal(summary.results[0].status, "passed");
assert.equal(summary.results[0].scenario, "agent-lab-single-agent");
assert.ok(existsSync(resolve(root, summary.results[0].evidenceDirectory, "desktop.png")));
assert.ok(existsSync(resolve(root, summary.results[0].evidenceDirectory, "phone.png")));
assert.ok(existsSync(resolve(root, summary.results[0].evidenceDirectory, "desktop.ndjson")));
assert.equal(summary.server.mode, "production");
assert.notEqual(summary.server.url, process.env.BASE_URL);
assert.equal(integrationHits, 0, "Inherited synthetic integration settings made no local requests");
assert.equal(
  JSON.parse(
    readFileSync(
      resolve(root, summary.results[0].evidenceDirectory, "desktop.artifact.json"),
      "utf8",
    ),
  ).dataMode,
  "fixture",
);

const appEnvPath = resolve(root, "apps/web/.env.local");
assert.equal(existsSync(appEnvPath), false, "Refusing to replace an existing app-local env file");
writeFileSync(
  appEnvPath,
  [
    "DEEPSEEK_API_KEY=synthetic-app-file-value",
    "MINIMAX_API_KEY=synthetic-app-file-value",
    "MAPS_API_KEY=synthetic-app-file-value",
    "SERPAPI_KEY=synthetic-app-file-value",
    "WEATHER_API_KEY=synthetic-app-file-value",
    "DATABASE_URL=postgres://app-file-test.invalid/forbidden",
    `KV_REST_API_URL=${integrationUrl}`,
    "KV_REST_API_TOKEN=synthetic-app-file-value",
    `DEEPSEEK_BASE_URL=${integrationUrl}`,
    `MINIMAX_BASE_URL=${integrationUrl}`,
    `MAPS_API_BASE_URL=${integrationUrl}`,
    `OSRM_BASE_URL=${integrationUrl}`,
    `NOMINATIM_BASE_URL=${integrationUrl}`,
    `PHOTON_BASE_URL=${integrationUrl}`,
    `TRANSITOUS_BASE_URL=${integrationUrl}`,
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=synthetic-app-file-value",
    "CLERK_SECRET_KEY=synthetic-app-file-value",
    "USE_MOCK_TOOLS=false",
    "AGENT_LAB_LIVE_ENABLED=true",
  ].join("\n"),
  { flag: "wx" },
);
let dev;
try {
  dev = await execute([
    "--silent",
    "--filter",
    "@trip/web",
    "e2e",
    "run",
    "agent-lab-single-agent",
    "--dev",
    "--json",
  ]);
} finally {
  unlinkSync(appEnvPath);
}
assert.equal(
  dev.status,
  0,
  `App-file credential run exited ${dev.status}:\n${dev.stdout}\n${dev.stderr}`,
);
const devResult = JSON.parse(dev.stdout);
assert.equal(devResult.outcome, "passed");
const devSummary = JSON.parse(readFileSync(resolve(root, devResult.summaryFile), "utf8"));
assert.equal(devSummary.server.mode, "development");
assert.equal(integrationHits, 0, "Synthetic app-local integration settings made no local requests");
assert.equal(
  JSON.parse(
    readFileSync(
      resolve(root, devSummary.results[0].evidenceDirectory, "desktop.artifact.json"),
      "utf8",
    ),
  ).dataMode,
  "fixture",
);

const timedOut = await execute([
  "--silent",
  "--filter",
  "@trip/web",
  "e2e",
  "run",
  "agent-lab-single-agent",
  "--dev",
  "--timeout-ms",
  "1000",
  "--json",
]);
assert.equal(
  timedOut.status,
  1,
  `Timed run exited ${timedOut.status}:\n${timedOut.stdout}\n${timedOut.stderr}`,
);
const timeoutResult = JSON.parse(timedOut.stdout);
assert.equal(timeoutResult.outcome, "timed_out");
const timeoutSummary = JSON.parse(readFileSync(resolve(root, timeoutResult.summaryFile), "utf8"));
assert.equal(timeoutSummary.results[0].status, "timed_out");
assert.ok(existsSync(resolve(root, timeoutSummary.results[0].diagnostics)));
assert.ok(existsSync(resolve(root, timeoutSummary.evidenceDirectory)));
await assert.rejects(fetch(timeoutSummary.server.url));
assert.equal(readFileSync(unrelatedSentinel, "utf8"), "preserve this file\n");
assert.equal(await (await fetch(unrelatedUrl)).text(), "survived");

const cliEntry = resolve(root, "apps/web/tests/e2e/run.mjs");
const invocationRoot = resolve(root, "output/e2e/local-test-cli");
const priorInvocations = new Set(readdirSync(invocationRoot));
const interruptedProcess = spawn(
  process.execPath,
  [cliEntry, "run", "agent-lab-single-agent", "--json"],
  {
    cwd: root,
    env: syntheticEnv,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let interruptedOutput = "";
interruptedProcess.stdout.on("data", (chunk) => (interruptedOutput += String(chunk)));
interruptedProcess.stderr.on("data", (chunk) => (interruptedOutput += String(chunk)));
let buildInvocation;
for (let attempt = 0; attempt < 300 && !buildInvocation; attempt += 1) {
  const candidate = readdirSync(invocationRoot).find((name) => !priorInvocations.has(name));
  if (candidate) {
    const buildLog = resolve(invocationRoot, candidate, "build.log");
    if (existsSync(buildLog) && statSync(buildLog).size > 0) buildInvocation = candidate;
  }
  if (!buildInvocation) await new Promise((wait) => setTimeout(wait, 100));
}
assert.ok(buildInvocation, "Production build started for interruption scenario");
interruptedProcess.kill("SIGTERM");
const interruptedExit = await new Promise((done) =>
  interruptedProcess.once("close", (code, signal) => done({ code, signal })),
);
assert.notEqual(interruptedExit.code, 0);
const interruptedSummaryPath = resolve(invocationRoot, buildInvocation, "summary.json");
assert.ok(existsSync(interruptedSummaryPath), interruptedOutput);
const interruptedSummary = JSON.parse(readFileSync(interruptedSummaryPath, "utf8"));
assert.equal(interruptedSummary.outcome, "interrupted");
assert.equal(interruptedSummary.results[0].status, "interrupted");
assert.equal(
  interruptedSummary.ownedResources[0].path,
  `apps/web/${interruptedSummary.server.distDir}`,
);
assert.equal(existsSync(resolve(root, interruptedSummary.ownedResources[1].path)), false);
await assert.rejects(fetch(interruptedSummary.server.url));
assert.equal(readFileSync(unrelatedSentinel, "utf8"), "preserve this file\n");
assert.equal(await (await fetch(unrelatedUrl)).text(), "survived");

const beforeJourneyInterrupt = new Set(readdirSync(invocationRoot));
const interruptedJourneyProcess = spawn(
  process.execPath,
  [cliEntry, "run", "agent-lab-single-agent", "--dev", "--json"],
  { cwd: root, env: syntheticEnv, stdio: ["ignore", "pipe", "pipe"] },
);
let journeyOutput = "";
interruptedJourneyProcess.stdout.on("data", (chunk) => (journeyOutput += String(chunk)));
interruptedJourneyProcess.stderr.on("data", (chunk) => (journeyOutput += String(chunk)));
let journeyInvocation;
for (let attempt = 0; attempt < 300 && !journeyInvocation; attempt += 1) {
  const candidate = readdirSync(invocationRoot).find((name) => !beforeJourneyInterrupt.has(name));
  if (candidate) {
    const journeyLog = resolve(invocationRoot, candidate, "journey.log");
    if (existsSync(journeyLog)) journeyInvocation = candidate;
  }
  if (!journeyInvocation) await new Promise((wait) => setTimeout(wait, 100));
}
assert.ok(journeyInvocation, `Browser journey started before interruption: ${journeyOutput}`);
const journeySummaryPath = resolve(invocationRoot, journeyInvocation, "summary.json");
interruptedJourneyProcess.kill("SIGTERM");
await new Promise((done) => interruptedJourneyProcess.once("close", done));
assert.ok(existsSync(journeySummaryPath), journeyOutput);
const journeySummary = JSON.parse(readFileSync(journeySummaryPath, "utf8"));
assert.equal(journeySummary.outcome, "interrupted");
assert.equal(journeySummary.results[0].status, "interrupted");
await assert.rejects(fetch(journeySummary.server.url));
assert.equal(readFileSync(unrelatedSentinel, "utf8"), "preserve this file\n");
assert.equal(await (await fetch(unrelatedUrl)).text(), "survived");

const nextBin = resolve(root, "apps/web/node_modules/.bin/next");
const nextBinStat = lstatSync(nextBin);
assert.ok(nextBinStat.isFile(), "Next launcher is a worktree-local regular file");
assert.equal(nextBinStat.isSymbolicLink(), false);
const nextBinMode = nextBinStat.mode & 0o777;
chmodSync(nextBin, nextBinMode & ~0o111);
const spawnFailureProcess = spawn(
  process.execPath,
  [cliEntry, "run", "agent-lab-single-agent", "--dev", "--json"],
  { cwd: root, env: syntheticEnv, stdio: ["ignore", "pipe", "pipe"] },
);
let spawnFailureOutput = "";
spawnFailureProcess.stdout.on("data", (chunk) => (spawnFailureOutput += String(chunk)));
spawnFailureProcess.stderr.on("data", (chunk) => (spawnFailureOutput += String(chunk)));
try {
  await new Promise((done) => spawnFailureProcess.once("close", done));
} finally {
  chmodSync(nextBin, nextBinMode);
}
const spawnFailureResult = JSON.parse(spawnFailureOutput);
assert.equal(spawnFailureResult.outcome, "startup_failed");
assert.match(spawnFailureResult.diagnostic, /could not start|did not answer/);
const spawnFailureSummary = JSON.parse(
  readFileSync(resolve(root, spawnFailureResult.summaryFile), "utf8"),
);
assert.equal(spawnFailureSummary.outcome, "startup_failed");
assert.equal(existsSync(resolve(root, spawnFailureSummary.ownedResources[1].path)), false);
assert.equal(statSync(nextBin).mode & 0o777, nextBinMode);

const legacyEnv = { ...syntheticEnv };
delete legacyEnv.BASE_URL;
for (const key of [
  "DEEPSEEK_API_KEY",
  "MINIMAX_API_KEY",
  "MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "SERPAPI_KEY",
  "WEATHER_API_KEY",
  "DATABASE_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_TOKEN",
])
  legacyEnv[key] = "";
legacyEnv.USE_MOCK_TOOLS = "true";
legacyEnv.AGENT_LAB_LIVE_ENABLED = "false";
const legacy = await execute(
  ["--silent", "--filter", "@trip/web", "e2e", "agent-lab-single-agent"],
  legacyEnv,
);
assert.equal(
  legacy.status,
  0,
  `Raw E2E syntax exited ${legacy.status}:\n${legacy.stdout}\n${legacy.stderr}`,
);
assert.match(legacy.stdout, /e2e: summary/);
assert.equal(readFileSync(sharedTsconfigPath, "utf8"), sharedTsconfigBefore);
assert.equal(existsSync(appEnvPath), false);
assert.equal(integrationHits, 0, "No inherited or app-file request reached the sentinel");
await new Promise((done) => integrationSentinel.close(done));
await new Promise((done) => unrelatedServer.close(done));
console.log("Unrelated server and data sentinels survived CLI cleanup.");
console.log("Owned server spawn failure produced a retained startup-failure summary.");

console.log(`CLI E2E passed: ${summary.invocationId}`);
console.log(`Summary: ${summary.summaryFile}`);
console.log("Raw E2E command compatibility passed.");
console.log("Timeout and production-build interruption handling passed.");
