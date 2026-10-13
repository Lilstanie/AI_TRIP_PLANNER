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
import {
  canonicalResources,
  captureIdentity,
  createRunOwnershipRecord,
  writeOwnershipRecord,
} from "../e2e/resource-ownership.mjs";

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

function createOwnedBuildFixture(invocationId) {
  const directory = resolve(runRoot, invocationId);
  const evidence = resolve(directory, "evidence");
  const resources = canonicalResources(resolve(root, "apps/web"), invocationId);
  const build = resources[0].absolutePath;
  mkdirSync(evidence, { recursive: true });
  mkdirSync(build, { recursive: true });
  writeFileSync(resolve(build, "owned.txt"), "owned build fixture");
  const startedAt = new Date().toISOString();
  const summaryPath = resolve(directory, "summary.json");
  const ownedResources = resources.map(({ kind, path }, index) => ({
    kind,
    path,
    state: index === 0 ? "retained" : "not-created",
  }));
  const summary = {
    schemaVersion: 1,
    recordType: "run",
    invocationId,
    startedAt,
    completedAt: startedAt,
    summaryFile: `output/e2e/local-test-cli/${invocationId}/summary.json`,
    evidenceDirectory: `output/e2e/local-test-cli/${invocationId}/evidence`,
    results: [],
    ownedResources,
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  const owner = createRunOwnershipRecord({
    invocationId,
    directoryIdentity: captureIdentity(directory, "directory"),
    evidenceIdentity: captureIdentity(evidence, "directory"),
    summaryIdentity: captureIdentity(summaryPath, "file"),
    resources: ownedResources,
    resourceIdentities: { "next-build-directory": captureIdentity(build, "directory") },
    createdAt: startedAt,
  });
  const ownerPath = resolve(directory, "ownership.json");
  writeOwnershipRecord(directory, owner);
  return { build, directory, ownerPath, resources, summaryPath };
}

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

const movedId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-moved1`;
const movedFixture = createOwnedBuildFixture(movedId);
const movedBuildPath = resolve(artifactRoot, "moved-owned-build");
rmSync(movedBuildPath, { recursive: true, force: true });
renameSync(movedFixture.build, movedBuildPath);
const movedCleanup = await invoke(["cleanup", movedId, "--json"]);
assert.notEqual(movedCleanup.status, 0);
assert.equal(JSON.parse(movedCleanup.stdout).outcome, "blocked");
assert.equal(readFileSync(resolve(movedBuildPath, "owned.txt"), "utf8"), "owned build fixture");
rmSync(movedFixture.directory, { recursive: true });
rmSync(movedBuildPath, { recursive: true });

const remountedId = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-remnt1`;
const remountedFixture = createOwnedBuildFixture(remountedId);
const remountedOwner = JSON.parse(readFileSync(remountedFixture.ownerPath, "utf8"));
const previousDevice = (identity) => ({
  ...identity,
  device: `previous-${identity.device}`,
});
for (const key of ["directoryIdentity", "evidenceIdentity", "summaryIdentity", "ownershipIdentity"])
  remountedOwner[key] = previousDevice(remountedOwner[key]);
for (const resource of remountedOwner.resources) {
  if (resource.identity) resource.identity = previousDevice(resource.identity);
}
writeFileSync(remountedFixture.ownerPath, `${JSON.stringify(remountedOwner, null, 2)}\n`);
const remountedCleanup = await invoke(["cleanup", remountedId, "--json"]);
assert.equal(remountedCleanup.status, 0, remountedCleanup.stderr);
assert.equal(JSON.parse(remountedCleanup.stdout).outcome, "cleaned");
assert.equal(existsSync(remountedFixture.build), false);
assert.equal(
  JSON.parse(readFileSync(remountedFixture.ownerPath, "utf8")).resources[0].state,
  "removed",
);
assert.equal(
  JSON.parse(readFileSync(remountedFixture.summaryPath, "utf8")).cleanup.outcome,
  "cleaned",
);

const run = await invoke(["run", "agent-lab-single-agent", "--dev", "--json"]);
assert.equal(
  run.status,
  0,
  `Fixture setup failed (exit ${run.status}):\n${run.stdout}\n${run.stderr}`,
);
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
assert.equal(runResult.cleanupOutcome, "cleaned");
assert.equal(existsSync(buildPath), false);
assert.equal(existsSync(screenshot), true);

const ownerOriginal = readFileSync(ownerPath, "utf8");
const staleSummary = structuredClone(summary);
staleSummary.ownedResources[0].state = "retained";
const staleOwner = JSON.parse(ownerOriginal);
staleOwner.resources[0].state = "retained";
writeFileSync(summaryPath, `${JSON.stringify(staleSummary, null, 2)}\n`);
writeFileSync(ownerPath, `${JSON.stringify(staleOwner, null, 2)}\n`);
const stale = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(stale.status, 0);
assert.equal(JSON.parse(stale.stdout).outcome, "blocked");
assert.equal(JSON.parse(readFileSync(summaryPath, "utf8")).cleanup.outcome, "blocked");
assert.equal(existsSync(buildPath), false);
writeFileSync(summaryPath, summaryOriginal);
writeFileSync(ownerPath, ownerOriginal);

const otherRun = await invoke(["run", "agent-lab-single-agent", "--dev", "--json"]);
assert.equal(
  otherRun.status,
  0,
  `Independent invocation setup failed (exit ${otherRun.status}):\n${otherRun.stdout}\n${otherRun.stderr}`,
);
const otherResult = JSON.parse(otherRun.stdout);
const otherSummaryPath = resolve(root, otherResult.summaryFile);
const otherSummary = JSON.parse(readFileSync(otherSummaryPath, "utf8"));
const otherBuildPath = resolve(root, otherSummary.ownedResources[0].path);
assert.equal(otherResult.cleanupOutcome, "cleaned");
assert.equal(existsSync(otherBuildPath), false);
assert.equal(existsSync(otherSummaryPath), true);
assert.equal(
  existsSync(resolve(root, otherSummary.results[0].evidenceDirectory, "desktop.png")),
  true,
);

const forgedSummary = structuredClone(summary);
forgedSummary.ownedResources[0].path =
  "../../../../output/e2e/local-cli-cleanup-e2e/unrelated-user-data.json";
writeFileSync(summaryPath, `${JSON.stringify(forgedSummary, null, 2)}\n`);
const forged = await invoke(["cleanup", summary.invocationId, "--json"]);
assert.notEqual(forged.status, 0);
assert.equal(JSON.parse(forged.stdout).outcome, "blocked");
assert.equal(existsSync(buildPath), false);
assert.equal(readFileSync(userData, "utf8"), originalUserData);
writeFileSync(summaryPath, summaryOriginal);

const unrelatedResponse = await fetch(`http://127.0.0.1:${unrelatedPort}/health`);
assert.equal(await unrelatedResponse.text(), "unrelated server remains available");
assert.equal(unrelatedRequests, 1);
const beforeCleanupRequests = unrelatedRequests;

const cleaned = await invoke(["cleanup", summary.invocationId]);
assert.equal(cleaned.status, 0, `Idempotent cleanup failed: ${cleaned.stdout}\n${cleaned.stderr}`);
assert.match(cleaned.stdout, /Local E2E cleanup already_clean/);
assert.equal(existsSync(buildPath), false);
assert.equal(existsSync(summaryPath), true);
assert.equal(existsSync(ownerPath), true);
assert.equal(existsSync(screenshot), true);
assert.equal(existsSync(otherSummaryPath), true);
assert.equal(
  existsSync(resolve(root, otherSummary.results[0].evidenceDirectory, "desktop.png")),
  true,
);
assert.equal(readFileSync(userData, "utf8"), originalUserData);
assert.equal(readFileSync(syntheticCredentials, "utf8"), originalCredentials);
assert.equal(existsSync(otherBuildPath), false);
assert.equal(unrelatedRequests, beforeCleanupRequests);

const otherCleaned = await invoke(["cleanup", otherSummary.invocationId, "--json"]);
assert.equal(otherCleaned.status, 0, otherCleaned.stderr);
assert.equal(JSON.parse(otherCleaned.stdout).outcome, "already_clean");
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
assert.ok(childBuildPaths.every((path) => !existsSync(path)));
assert.ok(childSummaries.every(({ summary: child }) => child.cleanup?.outcome === "cleaned"));
assert.ok(childScreenshots.every((path) => existsSync(path)));

const forgedRepeat = structuredClone(repeatSummary);
forgedRepeat.attempts[0].summaryFile = repeatSummary.attempts[1].summaryFile;
writeFileSync(repeatSummaryPath, `${JSON.stringify(forgedRepeat, null, 2)}\n`);
const forgedParent = await invoke(["cleanup", repeatSummary.invocationId, "--json"]);
assert.notEqual(forgedParent.status, 0);
assert.equal(JSON.parse(forgedParent.stdout).outcome, "blocked");
assert.ok(childBuildPaths.every((path) => !existsSync(path)));
writeFileSync(repeatSummaryPath, repeatSummaryOriginal);

const cleanedRepeat = await invoke(["cleanup", repeatSummary.invocationId, "--json"]);
assert.equal(cleanedRepeat.status, 0, `Repeat cleanup failed: ${cleanedRepeat.stdout}`);
assert.equal(JSON.parse(cleanedRepeat.stdout).outcome, "already_clean");
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
    "moved owned resource is blocked and preserved",
    "consistent remount device mapping permits cleanup and record writeback",
    "missing resource recorded as retained is blocked",
    "forged outside path blocked",
    "automatic cleanup removes each invocation build and keeps evidence",
    "another invocation report and screenshot survive selected cleanup",
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
