import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
mkdirSync(resolve(root, "output/e2e"), { recursive: true });
const output = mkdtempSync(resolve(root, "output/e2e/runner-plan-"));
const commands = [];
const checks = [];
const cases = [];
const fixtures = [];
const inventory = ["a.e2e.mjs", "b.e2e.mjs", "c.e2e.mjs", "report-cli.mjs"];

function fixture(label, bodies = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), `runner-plan-${label}-`));
  fixtures.push(dir);
  const scripts = resolve(dir, "apps/web/tests/cli-e2e");
  mkdirSync(scripts, { recursive: true });
  for (const name of ["run.mjs", "runner-plan.mjs"])
    if (existsSync(resolve(import.meta.dirname, name)))
      copyFileSync(resolve(import.meta.dirname, name), resolve(scripts, name));
  for (const name of inventory) {
    const body = bodies[name] ?? "await new Promise(done => setTimeout(done, 30));";
    writeFileSync(
      resolve(scripts, name),
      `import { appendFileSync } from "node:fs";
const event = type => appendFileSync("events.jsonl", JSON.stringify({ type, script: ${JSON.stringify(name)}, pid: process.pid }) + "\\n");
event("start");
console.log(${JSON.stringify(`stdout:${name}`)});
console.error(${JSON.stringify(`stderr:${name}`)});
${body}
event("end");
`,
    );
  }
  writeFileSync(resolve(scripts, "helper.mjs"), 'throw new Error("helper must not run");');
  const plan = {
    schemaVersion: 1,
    mode: "selected",
    reason: "Fixture selection",
    base: null,
    head: "fixture-head",
    changedFiles: ["fixture/source.mjs"],
    matchedRules: [
      {
        path: "fixture/source.mjs",
        rule: "fixture",
        scripts: ["a.e2e.mjs", "b.e2e.mjs", "c.e2e.mjs"],
      },
    ],
    discoveredScripts: inventory,
    selectedScripts: ["a.e2e.mjs", "b.e2e.mjs", "c.e2e.mjs"],
    shards: [
      { id: "1", scripts: ["c.e2e.mjs", "a.e2e.mjs"] },
      { id: "2", scripts: ["b.e2e.mjs"] },
    ],
  };
  const planPath = resolve(dir, "plan.json");
  const savePlan = (value = plan) => writeFileSync(planPath, JSON.stringify(value));
  savePlan();
  return { dir, scripts, plan, planPath, savePlan };
}

function launch(f, args = ["--plan", f.planPath, "--shard", "1"], nodeArgs = []) {
  const child = spawn(process.execPath, [...nodeArgs, resolve(f.scripts, "run.mjs"), ...args], {
    cwd: f.dir,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const result = new Promise((done, reject) => {
    const timer = setTimeout(() => {
      if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
      commands.push({ fixture: f.dir, nodeArgs, args, stdout, stderr, timedOut: true });
      reject(new Error("runner subprocess exceeded 15s deadline"));
    }, 15000);
    child.once("error", reject);
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      const value = { fixture: f.dir, nodeArgs, args, code, signal, stdout, stderr };
      commands.push(value);
      done(value);
    });
  });
  return { child, result };
}

function events(f) {
  const file = resolve(f.dir, "events.jsonl");
  return existsSync(file)
    ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
    : [];
}

function summary(f, result) {
  const file = result.stdout.match(
    /CLI acceptance (?:passed|failed|interrupted): (.+\/summary.json)/,
  )?.[1];
  assert.ok(file, result.stderr || result.stdout);
  return { file, value: JSON.parse(readFileSync(file, "utf8")) };
}

cases.push([
  "assigned-execution",
  async () => {
    const f = fixture("assigned");
    const result = await launch(f).result;
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(
      events(f).map((e) => `${e.type}:${e.script}`),
      ["start:c.e2e.mjs", "end:c.e2e.mjs", "start:a.e2e.mjs", "end:a.e2e.mjs"],
    );
    const report = summary(f, result).value;
    assert.equal(report.outcome, "passed");
    assert.deepEqual(
      report.results.map((r) => r.script),
      ["c.e2e.mjs", "a.e2e.mjs"],
    );
    const second = await launch(f, ["--shard", "2", "--plan", f.planPath]).result;
    assert.equal(second.code, 0, second.stderr);
    assert.deepEqual(
      events(f)
        .filter((e) => e.type === "start")
        .map((e) => e.script),
      ["c.e2e.mjs", "a.e2e.mjs", "b.e2e.mjs"],
    );
    const executed = [];
    for (const id of ["1", "2", "3"]) {
      const tree = fixture(`three-${id}`);
      tree.plan.shards = [
        { id: "1", scripts: ["c.e2e.mjs"] },
        { id: "2", scripts: ["a.e2e.mjs"] },
        { id: "3", scripts: ["b.e2e.mjs"] },
      ];
      tree.savePlan();
      const result = await launch(tree, ["--plan", tree.planPath, "--shard", id]).result;
      assert.equal(result.code, 0, result.stderr);
      executed.push(
        ...events(tree)
          .filter((e) => e.type === "start")
          .map((e) => e.script),
      );
    }
    assert.deepEqual(executed, ["c.e2e.mjs", "a.e2e.mjs", "b.e2e.mjs"]);
  },
]);

cases.push([
  "reject-invalid-plan",
  async () => {
    const f = fixture("invalid");
    const mutations = [
      ["null", () => null],
      ["array", () => []],
      [
        "schema",
        (p) => {
          p.schemaVersion = 2;
        },
      ],
      [
        "mode",
        (p) => {
          p.mode = "unknown";
        },
      ],
      [
        "reason",
        (p) => {
          delete p.reason;
        },
      ],
      [
        "base",
        (p) => {
          p.base = 12;
        },
      ],
      [
        "head",
        (p) => {
          delete p.head;
        },
      ],
      [
        "changedFiles",
        (p) => {
          p.changedFiles = [null];
        },
      ],
      [
        "matchedRules",
        (p) => {
          p.matchedRules = [{}];
        },
      ],
      [
        "rule scripts",
        (p) => {
          p.matchedRules[0].scripts = "a.e2e.mjs";
        },
      ],
      [
        "empty inventory",
        (p) => {
          p.discoveredScripts = [];
        },
      ],
      [
        "stale inventory",
        (p) => {
          p.discoveredScripts.pop();
        },
      ],
      [
        "inventory duplicate",
        (p) => {
          p.discoveredScripts.push("a.e2e.mjs");
        },
      ],
      [
        "unsorted inventory",
        (p) => {
          p.discoveredScripts.reverse();
        },
      ],
      [
        "full incomplete",
        (p) => {
          p.mode = "full";
        },
      ],
      [
        "empty selection",
        (p) => {
          p.selectedScripts = [];
        },
      ],
      [
        "unknown selection",
        (p) => {
          p.selectedScripts.push("unknown.e2e.mjs");
        },
      ],
      [
        "duplicate selection",
        (p) => {
          p.selectedScripts.push("a.e2e.mjs");
        },
      ],
      [
        "traversal",
        (p) => {
          p.shards[1].scripts = ["../outside.e2e.mjs"];
        },
      ],
      [
        "absolute",
        (p) => {
          p.shards[1].scripts = ["/tmp/outside.e2e.mjs"];
        },
      ],
      [
        "backslash",
        (p) => {
          p.shards[1].scripts = ["..\\outside.e2e.mjs"];
        },
      ],
      [
        "unknown shard script",
        (p) => {
          p.shards[1].scripts = ["unknown.e2e.mjs"];
        },
      ],
      [
        "unselected script",
        (p) => {
          p.shards[1].scripts.push("report-cli.mjs");
        },
      ],
      [
        "missing assignment",
        (p) => {
          p.shards.pop();
        },
      ],
      [
        "repeated assignment",
        (p) => {
          p.shards[1].scripts.push("a.e2e.mjs");
        },
      ],
      [
        "empty shard",
        (p) => {
          p.shards[1].scripts = [];
        },
      ],
      [
        "duplicate shard",
        (p) => {
          p.shards[1].id = "1";
        },
      ],
      [
        "numeric shard",
        (p) => {
          p.shards[1].id = 2;
        },
      ],
      [
        "empty shard identity",
        (p) => {
          p.shards[1].id = "";
        },
      ],
      [
        "no shards",
        (p) => {
          p.shards = [];
        },
      ],
      [
        "four shards",
        (p) => {
          p.shards.push({ id: "3", scripts: ["a.e2e.mjs"] }, { id: "4", scripts: ["b.e2e.mjs"] });
        },
      ],
      [
        "skip",
        (p) => {
          p.mode = "skip";
          p.selectedScripts = [];
          p.shards = [];
        },
      ],
    ];
    const failures = [];
    for (const [label, mutate] of mutations) {
      const plan = structuredClone(f.plan);
      f.savePlan(mutate(plan) ?? plan);
      if (label === "null") f.savePlan(null);
      rmSync(resolve(f.dir, "events.jsonl"), { force: true });
      const result = await launch(f).result;
      if (result.code === 0 || events(f).length || !result.stderr.trim()) failures.push(label);
    }
    for (const args of [
      ["--plan", f.planPath],
      ["--shard", "1"],
      ["--unknown", "x"],
      ["--plan", f.planPath, "--shard", "missing"],
      ["--plan", f.planPath, "--shard", "1", "--shard", "2"],
      ["--plan", f.planPath, "--shard"],
    ]) {
      f.savePlan();
      rmSync(resolve(f.dir, "events.jsonl"), { force: true });
      const result = await launch(f, args).result;
      if (result.code === 0 || events(f).length || !result.stderr.trim())
        failures.push(args.join(" "));
    }
    for (const text of ["{", "", "42"]) {
      writeFileSync(f.planPath, text);
      rmSync(resolve(f.dir, "events.jsonl"), { force: true });
      const result = await launch(f).result;
      if (result.code === 0 || events(f).length) failures.push(`JSON ${text}`);
    }
    rmSync(f.planPath);
    assert.notEqual((await launch(f).result).code, 0);
    assert.deepEqual(failures, [], "invalid commands must reject before ANY script starts");
  },
]);

cases.push([
  "discovery-compatibility",
  async () => {
    const f = fixture("noargs");
    const result = await launch(f, []).result;
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(
      events(f).map((e) => `${e.type}:${e.script}`),
      [
        "start:a.e2e.mjs",
        "end:a.e2e.mjs",
        "start:b.e2e.mjs",
        "end:b.e2e.mjs",
        "start:c.e2e.mjs",
        "end:c.e2e.mjs",
        "start:report-cli.mjs",
        "end:report-cli.mjs",
      ],
    );
    assert.equal(
      summary(f, result).value.reproductionCommand,
      "node apps/web/tests/cli-e2e/run.mjs",
    );
    assert.ok(existsSync(resolve(f.dir, "output/e2e/local-test-cli")));
    const failures = [];
    for (const kind of ["empty", "directory", "symlink", "unsafe", "added", "deleted"]) {
      const tree = fixture(kind);
      if (kind === "empty") for (const name of inventory) rmSync(resolve(tree.scripts, name));
      if (kind === "directory") mkdirSync(resolve(tree.scripts, "d.e2e.mjs"));
      if (kind === "symlink")
        symlinkSync(resolve(tree.scripts, "a.e2e.mjs"), resolve(tree.scripts, "d.e2e.mjs"));
      if (kind === "unsafe") writeFileSync(resolve(tree.scripts, "bad;name.e2e.mjs"), "");
      if (kind === "added") writeFileSync(resolve(tree.scripts, "d.e2e.mjs"), "");
      if (kind === "deleted") rmSync(resolve(tree.scripts, "report-cli.mjs"));
      const rejected = await launch(tree, ["added", "deleted"].includes(kind) ? undefined : [])
        .result;
      if (rejected.code === 0 || events(tree).length || !rejected.stderr.trim())
        failures.push(kind);
    }
    assert.deepEqual(failures, [], "invalid/empty discovery and stale plans cannot start children");
  },
]);

cases.push([
  "fail-fast-evidence",
  async () => {
    for (const planned of [false, true]) {
      for (const stopped of ["failed", "interrupted"]) {
        const f = fixture(`${stopped}-${planned}`, {
          "b.e2e.mjs":
            stopped === "failed"
              ? "process.exit(7);"
              : 'process.kill(process.pid, "SIGTERM"); await new Promise(() => {});',
        });
        f.plan.mode = "full";
        f.plan.selectedScripts = inventory;
        f.plan.shards = [{ id: "1", scripts: inventory }];
        f.savePlan();
        const result = await launch(f, planned ? undefined : []).result;
        assert.notEqual(result.code, 0);
        assert.deepEqual(
          events(f).map((e) => `${e.type}:${e.script}`),
          ["start:a.e2e.mjs", "end:a.e2e.mjs", "start:b.e2e.mjs"],
        );
        const report = summary(f, result).value;
        assert.equal(report.outcome, stopped);
        assert.deepEqual(
          report.results.map((r) => r.status),
          ["passed", stopped, "not_run", "not_run"],
        );
        assert.equal(report.results[1].code, stopped === "failed" ? 7 : 1);
        if (stopped === "interrupted") assert.equal(report.results[1].signal, "SIGTERM");
        for (const entry of report.results.slice(0, 2)) {
          assert.ok(Number.isFinite(entry.durationMs) && entry.durationMs >= 0);
          const log = readFileSync(resolve(f.dir, entry.log), "utf8");
          assert.ok(log.includes(`stdout:${entry.script}`));
          assert.ok(log.includes(`stderr:${entry.script}`));
        }
      }
    }
  },
]);

cases.push([
  "retained-reproduction",
  async () => {
    const f = fixture("reproduction");
    f.planPath = resolve(f.dir, "plan ' ; touch injected; $.json");
    const shard = "worker ' ; touch injected; #";
    f.plan.shards[0].id = shard;
    writeFileSync(f.planPath, JSON.stringify(f.plan));
    const frozenClock = resolve(f.dir, "clock.mjs");
    writeFileSync(
      frozenClock,
      "const NativeDate = Date; globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [0])); } };",
    );
    const args = ["--plan", f.planPath, "--shard", shard];
    const runs = await Promise.all(
      Array.from({ length: 4 }, () => launch(f, args, ["--import", frozenClock]).result),
    );
    const reports = runs.map((result) => {
      assert.equal(result.code, 0, result.stderr);
      return summary(f, result);
    });
    assert.equal(
      new Set(reports.map((report) => report.file)).size,
      4,
      "fixed-clock concurrent runs retain independent reports",
    );
    for (const { value } of reports) {
      assert.equal(value.mode, "selected");
      assert.equal(value.shard, shard);
      assert.equal(value.sourcePlan, f.planPath);
      assert.deepEqual(value.plan, f.plan);
    }
    rmSync(f.planPath);
    rmSync(resolve(f.dir, "events.jsonl"));
    const command = reports[0].value.reproductionCommand;
    const reproduced = spawn("sh", ["-c", command], {
      cwd: f.dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    reproduced.stdout.on("data", (chunk) => (stdout += chunk));
    reproduced.stderr.on("data", (chunk) => (stderr += chunk));
    const code = await new Promise((done) => reproduced.once("close", done));
    commands.push({ fixture: f.dir, reproductionCommand: command, code, stdout, stderr });
    assert.equal(code, 0, stderr);
    assert.deepEqual(
      events(f)
        .filter((e) => e.type === "start")
        .map((e) => e.script),
      ["c.e2e.mjs", "a.e2e.mjs"],
    );
    assert.equal(existsSync(resolve(f.dir, "injected")), false);
    assert.equal(readdirSync(resolve(f.dir, "output/e2e/cli-acceptance")).length, 5);
  },
]);

async function waitFor(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "fixture event deadline exceeded");
    await new Promise((done) => setTimeout(done, 20));
  }
}

cases.push([
  "signal-retention",
  async () => {
    for (const signal of ["SIGINT", "SIGTERM"]) {
      const resistant = signal === "SIGTERM";
      const body = resistant
        ? `
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});
const { spawn } = await import("node:child_process");
spawn(process.execPath, ["-e", ${JSON.stringify('const { appendFileSync } = require("node:fs"); process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); appendFileSync("events.jsonl", JSON.stringify({ type: "descendant", pid: process.pid }) + "\\n"); setInterval(() => {}, 1000);')}], { stdio: "ignore" });
setInterval(() => {}, 1000);
await new Promise(() => {});`
        : `
process.on("SIGINT", () => process.exit(0));
event("ready");
setInterval(() => {}, 1000);
await new Promise(() => {});`;
      const f = fixture(signal, { "c.e2e.mjs": body });
      const run = launch(f);
      try {
        await waitFor(() => events(f).some((e) => e.type === (resistant ? "descendant" : "ready")));
        run.child.kill(signal);
        const result = await run.result;
        assert.notEqual(result.code, 0);
        assert.deepEqual(
          events(f)
            .filter((e) => e.type === "start")
            .map((e) => e.script),
          ["c.e2e.mjs"],
        );
        const report = summary(f, result).value;
        assert.equal(report.outcome, "interrupted");
        assert.deepEqual(
          report.results.map((r) => r.status),
          ["interrupted", "not_run"],
        );
        assert.ok(report.results[0].durationMs >= 0);
        assert.ok(
          readFileSync(resolve(f.dir, report.results[0].log), "utf8").includes("stdout:c.e2e.mjs"),
        );
        assert.ok(report.reproductionCommand.includes("--shard '1'"));
        if (resistant) {
          const pid = events(f).find((e) => e.type === "descendant").pid;
          await waitFor(() => {
            try {
              process.kill(pid, 0);
              return false;
            } catch {
              return true;
            }
          });
        }
      } finally {
        for (const entry of events(f)) {
          try {
            process.kill(entry.pid, "SIGKILL");
          } catch {}
        }
        try {
          run.child.kill("SIGKILL");
        } catch {}
      }
    }
  },
]);

for (const [name, run] of cases) {
  if (process.argv[2] && process.argv[2] !== name) continue;
  try {
    await run();
    checks.push({ name, status: "passed" });
  } catch (error) {
    checks.push({ name, status: "failed", error: error.stack });
    process.exitCode = 1;
  }
}
const retainedFixtures = fixtures.map((dir) => {
  const retained = resolve(output, "fixtures", basename(dir));
  cpSync(dir, retained, { recursive: true });
  return { original: dir, retained };
});
if (!checks.length) process.exitCode = 1;
writeFileSync(
  resolve(output, "summary.json"),
  JSON.stringify(
    {
      reproductionCommand: "node apps/web/tests/cli-e2e/runner-plan.e2e.mjs",
      nodeVersion: process.version,
      checks,
      commands,
      fixtures: retainedFixtures,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ checks, evidence: resolve(output, "summary.json") }, null, 2));
