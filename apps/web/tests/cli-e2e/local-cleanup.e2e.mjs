import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const runRoot = resolve(root, "output/e2e/local-test-cli");
const artifactRoot = resolve(root, "output/e2e/local-cli-cleanup-e2e");
mkdirSync(artifactRoot, { recursive: true });
const userData = resolve(artifactRoot, "unrelated-user-data.json");
writeFileSync(userData, '{"keep":"cleanup-e2e-sentinel"}\n');
const originalUserData = readFileSync(userData, "utf8");
const syntheticCredentials = resolve(artifactRoot, "synthetic-credentials.env");
writeFileSync(syntheticCredentials, "CLEANUP_E2E_SYNTHETIC_KEY=cleanup-e2e-sentinel\n");
const originalCredentials = readFileSync(syntheticCredentials, "utf8");

let unrelatedRequests = 0;
const unrelatedServer = createServer((_request, response) => {
  unrelatedRequests += 1;
  response.end("unrelated server remains available");
});
await new Promise((done) => unrelatedServer.listen(0, "127.0.0.1", done));
process.once("exit", () => unrelatedServer.close());
const unrelatedPort = unrelatedServer.address().port;

const invoke = (args) =>
  new Promise((done, reject) => {
    const child = spawn("pnpm", ["--silent", "--filter", "@trip/web", "e2e", ...args], {
      cwd: root,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", reject);
    child.once("close", (status) => done({ status, stdout, stderr }));
  });

const unknownId = "2026-01-01T00-00-00-000Z-999999-zzzzzz";
const missing = await invoke(["cleanup", unknownId, "--json"]);
assert.notEqual(missing.status, 0);
assert.ok(missing.stdout.trim(), `Unknown invocation did not return JSON: ${missing.stderr}`);
const missingResult = JSON.parse(missing.stdout);
assert.equal(missingResult.command, "cleanup");
assert.equal(missingResult.outcome, "not_found");
const invalid = await invoke(["cleanup", "../outside", "--json"]);
assert.notEqual(invalid.status, 0);
assert.equal(JSON.parse(invalid.stdout).outcome, "invalid");
const newlineId = await invoke(["cleanup", `${unknownId}\n`, "--json"]);
assert.notEqual(newlineId.status, 0);
assert.equal(JSON.parse(newlineId.stdout).outcome, "invalid");
const invalidHuman = await invoke(["cleanup", "../outside"]);
assert.notEqual(invalidHuman.status, 0);
assert.match(invalidHuman.stdout, /Local E2E cleanup invalid/);

const fakeId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-fakeid`;
const fakeDirectory = resolve(runRoot, fakeId);
const fakeEvidence = resolve(fakeDirectory, "evidence");
const fakeBuild = resolve(root, "apps/web", `.next-e2e-local-${fakeId}`);
const fakeUserData = resolve(fakeBuild, "unrelated.txt");
mkdirSync(fakeEvidence, { recursive: true });
mkdirSync(fakeBuild, { recursive: true });
writeFileSync(fakeUserData, "summary alone cannot authorize cleanup");
const fakeSummary = {
  schemaVersion: 1,
  recordType: "run",
  invocationId: fakeId,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  summaryFile: `output/e2e/local-test-cli/${fakeId}/summary.json`,
  evidenceDirectory: `output/e2e/local-test-cli/${fakeId}/evidence`,
  results: [],
  ownedResources: [
    { kind: "next-build-directory", path: `apps/web/.next-e2e-local-${fakeId}`, state: "retained" },
    {
      kind: "temporary-tsconfig",
      path: `apps/web/.tsconfig-e2e-local-${fakeId}.json`,
      state: "not-created",
    },
  ],
};
writeFileSync(resolve(fakeDirectory, "summary.json"), `${JSON.stringify(fakeSummary, null, 2)}\n`);
const summaryOnly = await invoke(["cleanup", fakeId, "--json"]);
assert.notEqual(summaryOnly.status, 0);
assert.equal(JSON.parse(summaryOnly.stdout).outcome, "blocked");
assert.equal(readFileSync(fakeUserData, "utf8"), "summary alone cannot authorize cleanup");
rmSync(fakeBuild, { recursive: true });

const run = await invoke(["run", "agent-lab-single-agent", "--dev", "--json"]);
assert.equal(run.status, 0, `Fixture setup failed: ${run.stderr}`);
const runResult = JSON.parse(run.stdout);
assert.equal(runResult.outcome, "passed");
const summaryPath = resolve(root, runResult.summaryFile);
const summaryOriginal = readFileSync(summaryPath, "utf8");
const summary = JSON.parse(summaryOriginal);
const invocationDirectory = resolve(runRoot, summary.invocationId);
const ownerPath = resolve(invocationDirectory, "ownership.json");
const buildPath = resolve(root, summary.ownedResources[0].path);
const evidencePath = resolve(root, summary.results[0].evidenceDirectory);
const screenshot = resolve(evidencePath, "desktop.png");
assert.equal(existsSync(buildPath), true);
assert.equal(existsSync(screenshot), true);

const otherRun = await invoke(["run", "agent-lab-single-agent", "--dev", "--json"]);
assert.equal(otherRun.status, 0, `Independent invocation setup failed: ${otherRun.stderr}`);
const otherResult = JSON.parse(otherRun.stdout);
const otherSummaryPath = resolve(root, otherResult.summaryFile);
const otherSummary = JSON.parse(readFileSync(otherSummaryPath, "utf8"));
const otherBuildPath = resolve(root, otherSummary.ownedResources[0].path);
assert.equal(existsSync(otherBuildPath), true);

const forgedSummary = structuredClone(summary);
forgedSummary.ownedResources[0].path =
  "../../../../output/e2e/local-cli-cleanup-e2e/unrelated-user-data.json";
writeFileSync(summaryPath, `${JSON.stringify(forgedSummary, null, 2)}\n`);
const forged = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(forged.status, 0);
assert.equal(JSON.parse(forged.stdout).outcome, "blocked");
assert.equal(existsSync(buildPath), true);
assert.equal(readFileSync(userData, "utf8"), originalUserData);
writeFileSync(summaryPath, summaryOriginal);

const movedBuildPath = resolve(artifactRoot, `${summary.invocationId}-build-moved`);
renameSync(buildPath, movedBuildPath);
const stale = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(stale.status, 0);
assert.equal(JSON.parse(stale.stdout).outcome, "blocked");
assert.equal(existsSync(movedBuildPath), true);
renameSync(movedBuildPath, buildPath);

const unrelatedResponse = await fetch(`http://127.0.0.1:${unrelatedPort}/health`);
assert.equal(await unrelatedResponse.text(), "unrelated server remains available");
assert.equal(unrelatedRequests, 1);
const beforeCleanupRequests = unrelatedRequests;

const cleaned = await invoke(["cleanup", summary.invocationId]);
assert.equal(cleaned.status, 0, `Owned cleanup failed: ${cleaned.stdout}\n${cleaned.stderr}`);
assert.match(cleaned.stdout, /Local E2E cleanup cleaned/);
assert.ok(cleaned.stdout.includes(summary.ownedResources[0].path));
assert.equal(existsSync(buildPath), false);
assert.equal(existsSync(summaryPath), true);
assert.equal(existsSync(ownerPath), true);
assert.equal(existsSync(screenshot), true);
assert.equal(readFileSync(userData, "utf8"), originalUserData);
assert.equal(readFileSync(syntheticCredentials, "utf8"), originalCredentials);
assert.equal(existsSync(otherBuildPath), true);
assert.equal(unrelatedRequests, beforeCleanupRequests);

const otherCleaned = await invoke(["cleanup", otherSummary.invocationId, "--json"]);
assert.equal(otherCleaned.status, 0, otherCleaned.stderr);
assert.equal(JSON.parse(otherCleaned.stdout).outcome, "cleaned");
assert.equal(existsSync(otherBuildPath), false);
assert.equal(existsSync(otherSummaryPath), true);

const repeated = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.equal(repeated.status, 0, repeated.stderr);
assert.equal(JSON.parse(repeated.stdout).outcome, "already_clean");
assert.equal(existsSync(summaryPath), true);
assert.equal(existsSync(screenshot), true);

mkdirSync(buildPath);
const replacementSentinel = resolve(buildPath, "unrelated.txt");
writeFileSync(replacementSentinel, "replacement must survive");
const replaced = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(replaced.status, 0);
assert.equal(JSON.parse(replaced.stdout).outcome, "blocked");
assert.equal(readFileSync(replacementSentinel, "utf8"), "replacement must survive");
rmSync(buildPath, { recursive: true });

const symlinkTarget = resolve(artifactRoot, "symlink-target");
mkdirSync(symlinkTarget, { recursive: true });
const symlinkSentinel = resolve(symlinkTarget, "keep.txt");
writeFileSync(symlinkSentinel, "symlink target must survive");
symlinkSync(symlinkTarget, buildPath, "dir");
const symlinked = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(symlinked.status, 0);
assert.equal(JSON.parse(symlinked.stdout).outcome, "blocked");
assert.equal(readFileSync(symlinkSentinel, "utf8"), "symlink target must survive");
rmSync(buildPath);

const repeat = await invoke(["run", "agent-lab-single-agent", "--dev", "--repeat", "2", "--json"]);
assert.equal(repeat.status, 0, `Repeat fixture setup failed: ${repeat.stderr}`);
const repeatResult = JSON.parse(repeat.stdout);
assert.equal(repeatResult.outcome, "passed");
const repeatSummaryPath = resolve(root, repeatResult.summaryFile);
const repeatSummaryOriginal = readFileSync(repeatSummaryPath, "utf8");
const repeatSummary = JSON.parse(repeatSummaryOriginal);
const repeatOwnerPath = resolve(runRoot, repeatSummary.invocationId, "ownership.json");
assert.equal(repeatSummary.recordType, "repeat");
assert.equal(repeatSummary.attempts.length, 2);
const childSummaries = repeatSummary.attempts.map((attempt) => ({
  path: resolve(root, attempt.summaryFile),
  summary: JSON.parse(readFileSync(resolve(root, attempt.summaryFile), "utf8")),
}));
const childBuildPaths = childSummaries.map(({ summary: child }) =>
  resolve(root, child.ownedResources[0].path),
);
const childScreenshots = childSummaries.map(({ summary: child }) =>
  resolve(root, child.results[0].evidenceDirectory, "desktop.png"),
);
assert.ok(childBuildPaths.every((path) => existsSync(path)));
assert.ok(childScreenshots.every((path) => existsSync(path)));

const forgedRepeat = structuredClone(repeatSummary);
forgedRepeat.attempts[0].summaryFile = repeatSummary.attempts[1].summaryFile;
writeFileSync(repeatSummaryPath, `${JSON.stringify(forgedRepeat, null, 2)}\n`);
const forgedParent = await invoke(["cleanup", repeatSummary.invocationId, "--json"]);
assert.notEqual(forgedParent.status, 0);
assert.equal(JSON.parse(forgedParent.stdout).outcome, "blocked");
assert.ok(childBuildPaths.every((path) => existsSync(path)));
writeFileSync(repeatSummaryPath, repeatSummaryOriginal);

const cleanedRepeat = await invoke(["cleanup", repeatSummary.invocationId, "--json"]);
assert.equal(cleanedRepeat.status, 0, `Repeat cleanup failed: ${cleanedRepeat.stdout}`);
assert.equal(JSON.parse(cleanedRepeat.stdout).outcome, "cleaned");
assert.ok(childBuildPaths.every((path) => !existsSync(path)));
assert.equal(existsSync(repeatSummaryPath), true);
assert.equal(existsSync(repeatOwnerPath), true);
assert.ok(childSummaries.every(({ path }) => existsSync(path)));
assert.ok(childScreenshots.every((path) => existsSync(path)));
const repeatAgain = await invoke(["cleanup", repeatSummary.invocationId, "--json"]);
assert.equal(repeatAgain.status, 0, repeatAgain.stderr);
assert.equal(JSON.parse(repeatAgain.stdout).outcome, "already_clean");

const finalResponse = await fetch(`http://127.0.0.1:${unrelatedPort}/health`);
assert.equal(finalResponse.status, 200);
assert.equal(readFileSync(userData, "utf8"), originalUserData);
assert.equal(readFileSync(syntheticCredentials, "utf8"), originalCredentials);
await new Promise((done) => unrelatedServer.close(done));

const evidence = {
  invocationId: summary.invocationId,
  runSummary: runResult.summaryFile,
  independentRunSummary: otherResult.summaryFile,
  cleanupSummary: summary.summaryFile,
  checks: [
    "unknown and malformed IDs",
    "summary without independent ownership cannot authorize cleanup",
    "forged outside path blocked",
    "stale missing resource blocked",
    "another invocation resource survives selected cleanup",
    "normal cleanup retains summary and screenshot",
    "repeat cleanup is idempotent",
    "replacement and symlink resources are blocked and preserved",
    "repeat parent references are independently checked before child cleanup",
    "repeat cleanup preserves parent, child summaries and child evidence",
    "unrelated server and user data survive",
    "synthetic credential file survives",
  ],
  userData,
  unrelatedRequests,
};
writeFileSync(resolve(artifactRoot, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Cleanup E2E passed for ${summary.invocationId}.`);
console.log(`Evidence: ${resolve(artifactRoot, "result.json")}`);
