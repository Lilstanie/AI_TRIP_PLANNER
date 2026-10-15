import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  mkdirSync as makeDir,
  readdirSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const SOURCE = resolve(ROOT, "apps/web/tests/e2e");
const OUTPUT = resolve(ROOT, "output/e2e/legacy-runner-acceptance", `${Date.now()}-${process.pid}`);
const FIXTURE = resolve(OUTPUT, "fixture");
const WEB = resolve(FIXTURE, "apps/web");
const JOURNEYS = resolve(WEB, "tests/e2e");
const ENTRY = resolve(JOURNEYS, "legacy-runner.mjs");
const EVENTS = resolve(FIXTURE, "events.jsonl");
const TSCONFIG = resolve(WEB, "tsconfig.json");
const commands = [];
const checks = [];
mkdirSync(JOURNEYS, { recursive: true });
mkdirSync(resolve(WEB, "node_modules/.bin"), { recursive: true });
writeFileSync(TSCONFIG, '{"include":["**/*.ts"],"compilerOptions":{}}\n');
const originalTsconfig = readFileSync(TSCONFIG, "utf8");
for (const name of readdirSync(SOURCE).filter((name) => /^legacy-.*\.mjs$/.test(name)))
  copyFileSync(resolve(SOURCE, name), resolve(JOURNEYS, name));
writeFileSync(resolve(FIXTURE, "playwright.cjs"), "module.exports = {};\n");
const next = resolve(WEB, "node_modules/.bin/next");
writeFileSync(
  next,
  `#!${process.execPath}
const { appendFileSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { resolve } = require("node:path");
mkdirSync(process.env.NEXT_DIST_DIR, { recursive: true });
const configFile = process.env.NEXT_TSCONFIG_PATH || "tsconfig.json";
const config = JSON.parse(readFileSync(configFile, "utf8"));
const types = process.env.NEXT_DIST_DIR + "/types/**/*.ts";
if (!config.include.includes(types)) { config.include.push(types); writeFileSync(configFile, JSON.stringify(config)); }
appendFileSync(process.env.FIXTURE_EVENTS, JSON.stringify({ type: process.argv[2], pid: process.pid, dist: process.env.NEXT_DIST_DIR, configFile, buildInfo:config.compilerOptions.tsBuildInfoFile, tag: process.env.FIXTURE_TAG }) + "\\n");
if (process.argv[2] === "build") process.exit(0);
createServer((request, response) => response.end("fixture ready")).listen(Number(process.env.PORT));
`,
);
chmodSync(next, 0o755);

const record = `import { appendFileSync } from "node:fs";
appendFileSync(process.env.FIXTURE_EVENTS, JSON.stringify({type:"journey", pid:process.pid, tag:process.env.FIXTURE_TAG, url:process.env.BASE_URL}) + "\\n");`;
for (const [name, body] of Object.entries({
  "a-timeout": 'process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);',
  "b-survivor": "setTimeout(() => process.exit(0), 11000);",
  "c-resistant": 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);',
  "d-hold": "setTimeout(() => process.exit(0), 2500);",
  "e-pass": "process.exit(0);",
  "f-fail": "process.exit(1);",
}))
  writeFileSync(resolve(JOURNEYS, `${name}.e2e.mjs`), `${record}\n${body}\n`);

const events = () => {
  try {
    return readFileSync(EVENTS, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  }
};
function launch(args, override = {}) {
  const env = {
    PATH: process.env.PATH,
    PLAYWRIGHT: resolve(FIXTURE, "playwright.cjs"),
    FIXTURE_EVENTS: EVENTS,
    E2E_SCRIPT_TIMEOUT_MS: "15000",
    ...override,
  };
  const child = spawn(process.execPath, [ENTRY, ...args], {
    cwd: FIXTURE,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const result = new Promise((done, reject) => {
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      reject(new Error("fixture runner exceeded its acceptance deadline"));
    }, 45000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      const result = { args, env, pid: child.pid, status, signal, stdout, stderr };
      commands.push(result);
      done(result);
    });
  });
  return { child, result };
}
function check(message, action) {
  try {
    action();
    checks.push({ message, status: "passed" });
  } catch (error) {
    checks.push({ message, status: "failed", diagnostic: error.message });
  }
}
function summary(result) {
  const path = result.stdout.match(/written to (output\/e2e\/runner\/[^\n]+)/)?.[1];
  assert.ok(path, result.stderr);
  return JSON.parse(readFileSync(resolve(FIXTURE, path), "utf8"));
}
async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("fixture event deadline exceeded");
    await new Promise((done) => setTimeout(done, 25));
  }
}

try {
  const timeout = await launch(["a-timeout", "b-survivor"], { BASE_URL: "http://fixture.invalid" })
    .result;
  check("timeout remains failed while the following >10s journey survives old escalation", () => {
    assert.equal(timeout.status, 1);
    const results = summary(timeout).results;
    assert.equal(results[0].timedOut, true);
    assert.equal(results[1].ok, true);
  });
  const resistant = await launch(["c-resistant"], {
    BASE_URL: "http://fixture.invalid",
    E2E_SCRIPT_TIMEOUT_MS: "1000",
  }).result;
  check("SIGTERM-resistant journey is killed by its own escalation", () => {
    assert.equal(resistant.status, 1);
    assert.equal(summary(resistant).results[0].timedOut, true);
  });
  check("BASE_URL invocations allocate no dist or server", () => {
    assert.equal(
      events().filter((event) => ["build", "start", "dev"].includes(event.type)).length,
      0,
    );
    assert.equal(readdirSync(WEB).filter((name) => name.startsWith(".next-e2e")).length, 0);
  });
  const locks = [".next-e2e", ".next-e2e-2", ".next-e2e-3", ".next-e2e-4"].map((name) =>
    resolve(WEB, `${name}.lock`),
  );
  for (const lock of locks) writeFileSync(lock, String(process.pid));
  const concurrent = await Promise.all(
    Array.from(
      { length: 6 },
      (_, index) => launch(["d-hold", "--prod"], { FIXTURE_TAG: `parallel-${index}` }).result,
    ),
  );
  check("six concurrent raw production runners use distinct owned build/server dirs", () => {
    for (const result of concurrent) assert.equal(result.status, 0, result.stderr);
    const builds = events().filter((event) => event.type === "build");
    assert.equal(builds.length, 6);
    assert.equal(new Set(builds.map((event) => event.dist)).size, 6);
    for (const build of builds) {
      const server = events().find((event) => event.type === "start" && event.tag === build.tag);
      assert.equal(server?.dist, build.dist);
    }
  });
  check(
    "unique runs preserve legacy locks and shared config, with owned config/cache per build",
    () => {
      for (const lock of locks) assert.equal(readFileSync(lock, "utf8"), String(process.pid));
      assert.equal(readFileSync(TSCONFIG, "utf8"), originalTsconfig);
      const builds = events().filter((event) => event.type === "build");
      assert.equal(new Set(builds.map((event) => event.configFile)).size, 6);
      assert.equal(new Set(builds.map((event) => event.buildInfo)).size, 6);
      assert.equal(readdirSync(WEB).filter((name) => name.startsWith(".tsconfig-e2e")).length, 0);
    },
  );
  const customConfig = resolve(WEB, "custom-tsconfig.json");
  writeFileSync(customConfig, originalTsconfig);
  const custom = await launch(["e-pass"], {
    FIXTURE_TAG: "custom-config",
    NEXT_TSCONFIG_PATH: customConfig,
  }).result;
  check("raw caller-supplied TypeScript config remains honored and retained", () => {
    assert.equal(custom.status, 0, custom.stderr);
    const server = events().find((event) => event.type === "dev" && event.tag === "custom-config");
    assert.equal(server?.configFile, customConfig);
    assert.ok(readFileSync(customConfig, "utf8"));
  });
  chmodSync(next, 0o644);
  let spawnFailure;
  try {
    spawnFailure = await launch(["e-pass", "--prod"]).result;
  } finally {
    chmodSync(next, 0o755);
  }
  check("failed build spawn resolves nonzero and removes only its temporary config", () => {
    assert.equal(spawnFailure.status, 2);
    assert.match(spawnFailure.stderr, /unable to start.*EACCES/s);
    assert.equal(readFileSync(TSCONFIG, "utf8"), originalTsconfig);
    assert.equal(readdirSync(WEB).filter((name) => name.startsWith(".tsconfig-e2e")).length, 0);
  });
  const abandoned = launch(["d-hold"], { FIXTURE_TAG: "abandoned" });
  await waitFor(() =>
    events().some((event) => event.type === "journey" && event.tag === "abandoned"),
  );
  abandoned.child.kill("SIGKILL");
  await abandoned.result;
  const seed = (id, owner, ageDays = 0) => {
    const dir = resolve(WEB, `.next-e2e-${id}`);
    makeDir(dir);
    if (owner !== undefined) writeFileSync(`${dir}.lock`, String(owner));
    if (ageDays) {
      const then = new Date(Date.now() - ageDays * 86400000);
      utimesSync(dir, then, then);
    }
    return dir;
  };
  const deadDir = seed("DeadOw", abandoned.child.pid);
  writeFileSync(resolve(WEB, ".tsconfig-e2e-raw-DeadOw.json"), "{}");
  const liveDir = seed("LiveOw", process.pid);
  const freshDir = seed("Fresh0");
  const oldDir = seed("OldNo0", undefined, 2);
  const localDir = seed("local-Keep00");
  const recovered = await launch(["e-pass"], { FIXTURE_TAG: "recovered" }).result;
  check("a dead owner cannot block later allocations or reuse its dist", () => {
    assert.equal(recovered.status, 0, recovered.stderr);
    const previous = events().find((event) => event.type === "dev" && event.tag === "abandoned");
    const next = events().find((event) => event.type === "dev" && event.tag === "recovered");
    assert.ok(previous && next);
    assert.notEqual(previous.dist, next.dist);
  });
  check("a run sweeps the dist of a dead owner with its lock and owned config", () => {
    const previous = events().find((event) => event.type === "dev" && event.tag === "abandoned");
    assert.equal(existsSync(resolve(WEB, previous.dist)), false);
    assert.equal(existsSync(deadDir), false);
    assert.equal(existsSync(`${deadDir}.lock`), false);
    assert.equal(existsSync(resolve(WEB, ".tsconfig-e2e-raw-DeadOw.json")), false);
  });
  check("a run keeps a live owner's dist, a fresh unowned dist and a local CLI directory", () => {
    for (const dir of [liveDir, freshDir, localDir]) assert.equal(existsSync(dir), true, dir);
    assert.equal(readFileSync(`${liveDir}.lock`, "utf8"), String(process.pid));
  });
  check("a run sweeps an unowned dist older than a day", () => {
    assert.equal(existsSync(oldDir), false);
  });
  const failing = await launch(["f-fail"], { FIXTURE_TAG: "failing" }).result;
  check("a passing, a failing and a swept run leave no dist or lock of their own", () => {
    assert.equal(failing.status, 1);
    for (const tag of ["recovered", "failing"]) {
      const server = events().find((event) => event.type === "dev" && event.tag === tag);
      assert.ok(server, tag);
      assert.equal(existsSync(resolve(WEB, server.dist)), false, tag);
      assert.equal(existsSync(`${resolve(WEB, server.dist)}.lock`), false, tag);
    }
    const left = readdirSync(WEB).filter((name) => /^\.next-e2e-[A-Za-z0-9]{6}$/.test(name));
    assert.deepEqual(left.sort(), [".next-e2e-Fresh0", ".next-e2e-LiveOw"]);
  });
} catch (error) {
  checks.push({ message: "acceptance execution", status: "failed", diagnostic: error.stack });
} finally {
  for (const event of events()) {
    if (event.type === "build") continue;
    try {
      process.kill(-event.pid, "SIGKILL");
    } catch {}
  }
  const report = {
    command: "node apps/web/tests/cli-e2e/legacy-runner.e2e.mjs",
    commands,
    checks,
    fixture: FIXTURE,
  };
  writeFileSync(resolve(OUTPUT, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ checks, evidenceFile: resolve(OUTPUT, "summary.json") }));
  if (checks.some((check) => check.status === "failed")) process.exitCode = 1;
}
