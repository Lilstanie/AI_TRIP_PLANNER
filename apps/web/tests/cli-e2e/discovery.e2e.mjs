import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const ENTRY = resolve(ROOT, "apps/web/tests/e2e/run.mjs");
const TSCONFIG = resolve(ROOT, "apps/web/tsconfig.json");
let serviceContacts = 0;
const sentinel = createServer((request, response) => {
  serviceContacts += 1;
  response.end(request.url);
});
await new Promise((resolveListen) => sentinel.listen(0, "127.0.0.1", resolveListen));
sentinel.unref();
const baseUrl = `http://127.0.0.1:${sentinel.address().port}/doctor-must-not-connect`;
const env = {
  ...process.env,
  DEEPSEEK_API_KEY: "synthetic-doctor-secret",
  MAPS_API_KEY: "synthetic-map-secret",
  DATABASE_URL: "synthetic-database-secret",
  BASE_URL: baseUrl,
};
const run = (command, args, override = {}) =>
  new Promise((resolveRun) => {
    const child = spawn(process.execPath, [ENTRY, command, ...args], {
      cwd: ROOT,
      env: { ...env, ...override },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM");
      } catch {}
    }, 10_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      resolveRun({ error, status: null, stdout, stderr });
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({
        status: timedOut ? null : (status ?? 1),
        signal,
        stdout,
        stderr: timedOut ? `${stderr}\nCLI E2E subprocess timed out.` : stderr,
      });
    });
  });
const treeSnapshot = (directory) => {
  if (!existsSync(directory)) return null;
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const path = resolve(directory, entry.name);
      const stat = statSync(path);
      return {
        name: entry.name,
        directory: entry.isDirectory(),
        size: stat.size,
        modified: stat.mtimeMs,
        ...(entry.isDirectory() ? { children: treeSnapshot(path) } : {}),
      };
    });
};
const appEnvSnapshot = () =>
  readdirSync(resolve(ROOT, "apps/web"))
    .filter((name) => name.startsWith(".env"))
    .sort()
    .map((name) => {
      const stat = lstatSync(resolve(ROOT, "apps/web", name));
      return { name, size: stat.size, modified: stat.mtimeMs, symlink: stat.isSymbolicLink() };
    });
const before = {
  appEnv: appEnvSnapshot(),
  invocations: treeSnapshot(resolve(ROOT, "output/e2e/local-test-cli")),
};

const control = await fetch(baseUrl);
assert.equal(control.status, 200);
await control.text();
assert.equal(serviceContacts, 1, "the local sentinel detects a control request");
serviceContacts = 0;

const result = await run("doctor", ["--json"]);

assert.equal(result.error, undefined, result.error?.message);
assert.equal(result.status, 0, result.stderr);
const report = JSON.parse(result.stdout);
assert.equal(report.command, "doctor");
assert.equal(report.outcome, "ready");
assert.ok(report.checks.some((check) => check.id === "node" && check.status === "ready"));
assert.ok(report.checks.some((check) => check.id === "package-manager"));
assert.ok(report.checks.some((check) => check.id === "browser"));
assert.ok(!`${result.stdout}\n${result.stderr}`.includes("synthetic-doctor-secret"));
assert.ok(!`${result.stdout}\n${result.stderr}`.includes("synthetic-map-secret"));
assert.ok(!`${result.stdout}\n${result.stderr}`.includes("synthetic-database-secret"));
const human = await run("doctor", []);
assert.equal(human.status, 0, human.stderr);
assert.match(human.stdout, /Local E2E doctor: READY/);
assert.ok(!`${human.stdout}\n${human.stderr}`.includes("synthetic-map-secret"));

const blocked = await run("doctor", ["--json"], { PATH: "" });
assert.equal(blocked.status, 1, blocked.stderr);
const blockedReport = JSON.parse(blocked.stdout);
assert.equal(blockedReport.outcome, "blocked");
assert.ok(
  blockedReport.checks.some(
    (check) => check.id === "package-manager" && check.status === "blocked" && check.remediation,
  ),
);
assert.ok(!`${blocked.stdout}\n${blocked.stderr}`.includes("synthetic-map-secret"));

const heldTsconfig = `${TSCONFIG}.doctor-hold-${process.pid}`;
renameSync(TSCONFIG, heldTsconfig);
let missingTsconfig;
try {
  missingTsconfig = await run("doctor", ["--json"]);
} finally {
  renameSync(heldTsconfig, TSCONFIG);
}
assert.equal(missingTsconfig.status, 1, missingTsconfig.stderr);
const missingTsconfigReport = JSON.parse(missingTsconfig.stdout);
assert.equal(missingTsconfigReport.outcome, "blocked");
assert.ok(
  missingTsconfigReport.checks.some(
    (check) => check.id === "typescript-config" && check.status === "blocked" && check.remediation,
  ),
);

const tsconfigBeforeInvalid = readFileSync(TSCONFIG, "utf8");
writeFileSync(TSCONFIG, '{"include":"not-an-array"}\n');
let invalidTsconfig;
try {
  invalidTsconfig = await run("doctor", ["--json"]);
} finally {
  writeFileSync(TSCONFIG, tsconfigBeforeInvalid);
}
assert.equal(invalidTsconfig.status, 1, invalidTsconfig.stderr);
const invalidTsconfigReport = JSON.parse(invalidTsconfig.stdout);
assert.equal(invalidTsconfigReport.outcome, "blocked");
assert.ok(
  invalidTsconfigReport.checks.some(
    (check) => check.id === "typescript-config" && check.status === "blocked",
  ),
);

const listed = await run("list", ["--json"]);
assert.equal(listed.status, 0, listed.stderr);
const listing = JSON.parse(listed.stdout);
assert.equal(listing.command, "list");
assert.deepEqual(listing.supported, ["agent-lab-replay", "agent-lab-single-agent"]);
const script = (name) => listing.scripts.find((entry) => entry.name === name);
assert.equal(script("agent-lab-single-agent").status, "supported");
assert.equal(script("agent-lab-replay").status, "supported");
assert.match(
  script("agent-lab-replay").description,
  /tight-budget fixture.*artifact download.*replay.*comparison/i,
);
assert.match(script("leg-mode-choice").reason, /model-dependent.*SKIP/i);
assert.match(script("agent-lab-live-gate").reason, /multiple app servers/i);
assert.match(script("map-provider-http").reason, /multiple-server/i);
assert.match(script("plan-quality").reason, /live data.*model-generated/i);
assert.deepEqual(script("plan-quality").prerequisites, ["DEEPSEEK_API_KEY"]);
assert.deepEqual(script("conversation-scope").prerequisites, ["DEEPSEEK_API_KEY"]);
assert.ok(listing.scripts.filter((entry) => entry.status === "unsupported").length > 1);
assert.ok(!`${listed.stdout}\n${listed.stderr}`.includes("synthetic-map-secret"));
const listedHuman = await run("list", []);
assert.equal(listedHuman.status, 0, listedHuman.stderr);
assert.match(listedHuman.stdout, /UNSUPPORTED leg-mode-choice/);
assert.ok(!`${listedHuman.stdout}\n${listedHuman.stderr}`.includes("synthetic-map-secret"));

assert.deepEqual(appEnvSnapshot(), before.appEnv);
assert.deepEqual(
  treeSnapshot(resolve(ROOT, "output/e2e/local-test-cli")),
  before.invocations,
  "doctor and list do not create, change, or remove run evidence",
);
await new Promise((resolveTurn) => setImmediate(resolveTurn));
assert.equal(serviceContacts, 0, "doctor and list do not contact the inherited server URL");
await new Promise((resolveClose) => sentinel.close(resolveClose));
const evidenceDirectory = resolve(tmpdir(), "ai-trip-planner-local-test-cli-evidence");
mkdirSync(evidenceDirectory, { recursive: true });
const evidenceFile = resolve(evidenceDirectory, `discovery-${Date.now()}-${process.pid}.json`);
writeFileSync(
  evidenceFile,
  `${JSON.stringify(
    {
      command: "node apps/web/tests/cli-e2e/discovery.e2e.mjs",
      doctor: { status: result.status, stdout: result.stdout },
      doctorBlocked: { status: blocked.status, stdout: blocked.stdout },
      list: { status: listed.status, stdout: listed.stdout },
      inheritedServerContacts: serviceContacts,
      localEnvironmentUnchanged: true,
      runEvidenceUnchanged: true,
    },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify({
    ready: report.outcome,
    blocked: blockedReport.outcome,
    scripts: listing.scripts.length,
    evidenceFile,
  }),
);
