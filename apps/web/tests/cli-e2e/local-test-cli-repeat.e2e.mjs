import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const cliEntry = resolve(root, "apps/web/tests/e2e/run.mjs");
const invocationRoot = resolve(root, "output/e2e/local-test-cli");
mkdirSync(invocationRoot, { recursive: true });
const unrelatedData = resolve(invocationRoot, `repeat-unrelated-${process.pid}.txt`);
writeFileSync(unrelatedData, "keep repeat test data\n", { flag: "wx" });
const unrelatedServer = createServer((_request, response) => response.end("still running"));
await new Promise((done) => unrelatedServer.listen(0, "127.0.0.1", done));
unrelatedServer.unref();
const unrelatedUrl = `http://127.0.0.1:${unrelatedServer.address().port}`;
const env = {
  ...process.env,
  BASE_URL: "http://127.0.0.1:1",
  USE_MOCK_TOOLS: "false",
  AGENT_LAB_LIVE_ENABLED: "true",
  DEEPSEEK_API_KEY: "synthetic-local-cli-repeat-test",
  MAPS_API_KEY: "synthetic-local-cli-repeat-test",
  SERPAPI_KEY: "synthetic-local-cli-repeat-test",
  DATABASE_URL: "postgres://repeat-test.invalid/forbidden",
  KV_REST_API_URL: "http://127.0.0.1:1",
  KV_REST_API_TOKEN: "synthetic-local-cli-repeat-test",
};

function invoke(args) {
  const result = spawnSync(process.execPath, [cliEntry, "run", ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.ok(result.stdout.trim(), result.stderr);
  return { ...result, json: JSON.parse(result.stdout) };
}

for (const invalid of ["0", "-1", "1.5", "NaN", "9007199254740992"]) {
  const result = invoke(["agent-lab-single-agent", "--dev", "--repeat", invalid, "--json"]);
  assert.notEqual(result.status, 0, `Repeat count ${invalid} was accepted`);
  assert.equal(result.json.outcome, "unsupported");
  assert.match(result.json.diagnostic, /repeat/i);
  assert.equal(result.json.summaryFile, undefined, "Invalid repeat counts start no invocation");
}

const before = new Set(readdirSync(invocationRoot));
const repeated = spawn(
  process.execPath,
  [cliEntry, "run", "agent-lab-single-agent", "--dev", "--repeat", "2", "--json"],
  { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
repeated.stdout.on("data", (chunk) => (output += String(chunk)));
repeated.stderr.on("data", (chunk) => (output += String(chunk)));

const ps = () =>
  spawnSync("ps", ["-axo", "pid=,ppid=,args="], { encoding: "utf8" })
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const startedAt = Date.now();
let firstInvocation;
let firstChildPid;
while (Date.now() - startedAt < 4 * 60_000 && !firstChildPid) {
  const completedOutput = output.trim().split("\n").at(-1);
  if (completedOutput) {
    try {
      const partialResult = JSON.parse(completedOutput);
      assert.notEqual(partialResult.outcome, "unsupported", partialResult.diagnostic);
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
    }
  }
  for (const newInvocation of readdirSync(invocationRoot).filter((name) => !before.has(name))) {
    const journeyLog = resolve(invocationRoot, newInvocation, "journey.log");
    const browserEvidence = resolve(
      invocationRoot,
      newInvocation,
      "evidence/agent-lab-single-agent/desktop.ndjson",
    );
    if (
      !existsSync(journeyLog) ||
      !existsSync(browserEvidence) ||
      statSync(browserEvidence).size === 0
    )
      continue;
    const processLine = ps().find((line) => {
      const fields = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      return (
        fields?.[2] === String(repeated.pid) &&
        fields[3].includes("run.mjs run agent-lab-single-agent --dev --json")
      );
    });
    if (processLine) {
      firstInvocation = newInvocation;
      firstChildPid = processLine.match(/^(\d+)/)?.[1];
      break;
    }
  }
  if (!firstChildPid) await new Promise((wait) => setTimeout(wait, 100));
}
assert.ok(firstInvocation, `First browser attempt did not produce evidence: ${output}`);
assert.ok(firstChildPid, `Could not identify the repeat-owned child CLI process: ${output}`);
process.kill(Number(firstChildPid), "SIGTERM");

const exit = await new Promise((done) =>
  repeated.once("close", (code, signal) => done({ code, signal })),
);
assert.notEqual(exit.code, 0, `A later pass concealed the interrupted first attempt: ${output}`);
const result = JSON.parse(output.trim().split("\n").at(-1));
assert.notEqual(result.outcome, "passed");
assert.equal(result.requestedRepeatCount, 2);
assert.equal(result.attempts.length, 2);
assert.equal(result.attempts[0].status, "interrupted");
assert.equal(result.attempts[1].status, "passed");
assert.ok(result.attempts[0].summaryFile);
assert.ok(result.attempts[0].evidenceDirectory);
assert.ok(result.attempts[0].reproductionCommand);
assert.ok(result.attempts[1].summaryFile);
assert.ok(result.attempts[1].evidenceDirectory);
assert.ok(result.attempts[1].reproductionCommand);

const summary = JSON.parse(readFileSync(resolve(root, result.summaryFile), "utf8"));
assert.equal(summary.outcome, result.outcome);
assert.equal(summary.requestedRepeatCount, 2);
assert.equal(summary.attempts.length, 2);
assert.deepEqual(
  summary.attempts.map((attempt) => attempt.status),
  ["interrupted", "passed"],
);
assert.ok(Date.parse(summary.attempts[0].completedAt) <= Date.parse(summary.attempts[1].startedAt));
const childSummaries = summary.attempts.map((attempt) =>
  JSON.parse(readFileSync(resolve(root, attempt.summaryFile), "utf8")),
);
assert.equal(childSummaries[0].outcome, "interrupted");
assert.equal(childSummaries[1].outcome, "passed");
assert.notEqual(childSummaries[0].invocationId, childSummaries[1].invocationId);
assert.notEqual(childSummaries[0].server.distDir, childSummaries[1].server.distDir);
assert.notEqual(
  childSummaries[0].results[0].evidenceDirectory,
  childSummaries[1].results[0].evidenceDirectory,
);
for (const attempt of summary.attempts) {
  assert.ok(existsSync(resolve(root, attempt.summaryFile)));
  assert.ok(existsSync(resolve(root, attempt.evidenceDirectory)));
  assert.match(attempt.reproductionCommand, /e2e run agent-lab-single-agent/);
}

const completedAttempt = childSummaries[1];
const completedEvidence = resolve(root, completedAttempt.results[0].evidenceDirectory);
assert.ok(existsSync(resolve(completedEvidence, "desktop.png")));
assert.ok(existsSync(resolve(completedEvidence, "phone.png")));
const artifact = JSON.parse(
  readFileSync(resolve(completedEvidence, "desktop.artifact.json"), "utf8"),
);
assert.equal(artifact.dataMode, "fixture");
assert.equal(artifact.status, "completed");
const partialFrames = readFileSync(
  resolve(root, childSummaries[0].results[0].evidenceDirectory, "desktop.ndjson"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const partialArtifact = partialFrames.find((frame) => frame.type === "complete")?.artifact;
assert.ok(partialArtifact?.runId, "Interrupted attempt retained its completed fixture output");
assert.notEqual(
  partialArtifact.runId,
  artifact.runId,
  "Each browser attempt starts a new fixture run",
);
await assert.rejects(fetch(childSummaries[0].server.url));
assert.equal(await (await fetch(unrelatedUrl)).text(), "still running");
assert.equal(readFileSync(unrelatedData, "utf8"), "keep repeat test data\n");
assert.match(
  readFileSync(resolve(root, childSummaries[1].results[0].diagnostics), "utf8"),
  /Agent Lab does not mutate workspace storage/,
);

const human = spawnSync(
  process.execPath,
  [cliEntry, "run", "agent-lab-single-agent", "--dev", "--repeat", "1"],
  { cwd: root, env, encoding: "utf8", timeout: 4 * 60_000 },
);
assert.equal(human.error, undefined, human.error?.message);
assert.equal(
  human.status,
  0,
  `Human-readable repeat exited ${human.status}: ${human.stdout}\n${human.stderr}`,
);
assert.match(human.stdout, /Local E2E repeat passed: 1 attempts/);
const humanSummaryPath = human.stdout.match(/Summary: (output\/e2e\/local-test-cli\/[^\s]+)/)?.[1];
assert.ok(humanSummaryPath, human.stdout);
const humanSummary = JSON.parse(readFileSync(resolve(root, humanSummaryPath), "utf8"));
assert.equal(humanSummary.attempts[0].status, "passed");
assert.equal(await (await fetch(unrelatedUrl)).text(), "still running");
assert.equal(readFileSync(unrelatedData, "utf8"), "keep repeat test data\n");
await new Promise((done) => unrelatedServer.close(done));
unlinkSync(unrelatedData);
console.log(`Repeat CLI E2E passed: ${result.summaryFile}`);
