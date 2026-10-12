import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
mkdirSync(resolve(root, "output/e2e"), { recursive: true });
const output = mkdtempSync(resolve(root, "output/e2e/ci-integration-"));
const commands = [];
const checks = [];
const fixtures = [];
const cases = [];
const inventory = [
  "ci-integration.e2e.mjs",
  "discovery.e2e.mjs",
  "legacy-runner.e2e.mjs",
  "local-cleanup.e2e.mjs",
  "local-cli-collections.e2e.mjs",
  "local-test-cli-repeat.e2e.mjs",
  "local-test-cli.e2e.mjs",
  "report-cli.mjs",
  "report-interrupted.e2e.mjs",
  "review-comment-policy.e2e.mjs",
  "runner-plan.e2e.mjs",
  "selection.e2e.mjs",
  "skill-maintenance.e2e.mjs",
];

function command(cwd, executable, args, env = {}) {
  const result = spawnSync(executable, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 15000,
  });
  commands.push({
    cwd,
    executable,
    args,
    env,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
  return result;
}

function node(f, name, args = [], env = {}) {
  return command(f.dir, process.execPath, [resolve(f.scripts, name), ...args], env);
}

function fixture(label) {
  const dir = mkdtempSync(resolve(tmpdir(), `ci-integration-${label}-`));
  fixtures.push(dir);
  const scripts = resolve(dir, "apps/web/tests/cli-e2e");
  mkdirSync(scripts, { recursive: true });
  for (const name of ["select.mjs", "run.mjs", "runner-plan.mjs", "ci-result.mjs"])
    if (existsSync(resolve(import.meta.dirname, name)))
      copyFileSync(resolve(import.meta.dirname, name), resolve(scripts, name));
  for (const name of inventory)
    writeFileSync(
      resolve(scripts, name),
      `import { appendFileSync } from "node:fs";
const event = type => appendFileSync("events.jsonl", JSON.stringify({ type, script: ${JSON.stringify(name)} }) + "\\n");
event("start");
await new Promise(done => setTimeout(done, 5));
event("end");
`,
    );
  mkdirSync(resolve(dir, "docs"));
  writeFileSync(resolve(dir, "docs/guide.md"), "base\n");
  const git = (...args) => {
    const result = command(dir, "git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Acceptance Fixture");
  git("add", ".");
  git("commit", "-qm", "base");
  return {
    dir,
    scripts,
    git,
    base: git("rev-parse", "HEAD"),
    planPath: resolve(dir, "plan.json"),
    results: resolve(dir, "results"),
  };
}

function plan(f, path, event = "pull_request") {
  mkdirSync(resolve(f.dir, path, ".."), { recursive: true });
  writeFileSync(resolve(f.dir, path), "changed\n");
  f.git("add", path);
  f.git("commit", "-qm", "change");
  const result = node(f, "select.mjs", [
    "--event",
    event,
    "--base",
    f.base,
    "--head",
    f.git("rev-parse", "HEAD"),
    "--output",
    f.planPath,
  ]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(readFileSync(f.planPath, "utf8"));
}

function events(f) {
  const file = resolve(f.dir, "events.jsonl");
  return existsSync(file)
    ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
    : [];
}

function aggregate(f, env = {}) {
  return node(f, "ci-result.mjs", ["aggregate", "--plan", f.planPath, "--results", f.results], {
    PLAN_RESULT: "success",
    WORKERS_RESULT: "skipped",
    ...env,
  });
}

cases.push([
  "docs-skip",
  () => {
    const f = fixture("docs");
    const selected = plan(f, "docs/guide.md");
    assert.equal(selected.mode, "skip");
    assert.deepEqual(selected.shards, []);
    const githubOutput = resolve(f.dir, "github-output");
    const prepared = node(f, "ci-result.mjs", ["plan", "--plan", f.planPath], {
      GITHUB_OUTPUT: githubOutput,
    });
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.equal(readFileSync(githubOutput, "utf8"), 'run-workers=false\nmatrix={"shard":[]}\n');
    assert.equal(aggregate(f).status, 0);
    assert.deepEqual(events(f), []);
  },
]);

function execute(f, selected) {
  const executed = [];
  for (const shard of selected.shards) {
    const dir = mkdtempSync(resolve(tmpdir(), "ci-integration-worker-"));
    cpSync(f.dir, dir, { recursive: true });
    fixtures.push(dir);
    const worker = { dir, scripts: resolve(dir, "apps/web/tests/cli-e2e") };
    const result = node(worker, "run.mjs", ["--plan", f.planPath, "--shard", shard.id]);
    assert.equal(result.status, 0, result.stderr);
    const observed = events(worker);
    assert.deepEqual(
      observed,
      shard.scripts.flatMap((script) => [
        { type: "start", script },
        { type: "end", script },
      ]),
    );
    executed.push(
      ...observed.filter((event) => event.type === "start").map((event) => event.script),
    );
    const receipt = node(
      worker,
      "ci-result.mjs",
      [
        "worker",
        "--plan",
        f.planPath,
        "--shard",
        shard.id,
        "--output",
        resolve(f.results, `${shard.id}.json`),
      ],
      { WORKER_RESULT: "success" },
    );
    assert.equal(receipt.status, 0, receipt.stderr);
  }
  assert.deepEqual(executed.sort(), [...selected.selectedScripts].sort());
}

cases.push([
  "selected-workers",
  () => {
    const f = fixture("selected");
    const selected = plan(f, "apps/web/tests/e2e/report-cli.mjs");
    assert.equal(selected.mode, "selected");
    assert.deepEqual(selected.selectedScripts, ["report-cli.mjs", "report-interrupted.e2e.mjs"]);
    const githubOutput = resolve(f.dir, "github-output");
    const prepared = node(f, "ci-result.mjs", ["plan", "--plan", f.planPath], {
      GITHUB_OUTPUT: githubOutput,
    });
    assert.equal(prepared.status, 0, prepared.stderr);
    const outputs = Object.fromEntries(
      readFileSync(githubOutput, "utf8")
        .trim()
        .split("\n")
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
    assert.equal(outputs["run-workers"], "true");
    assert.deepEqual(
      JSON.parse(outputs.matrix).shard,
      selected.shards.map((shard) => shard.id),
    );
    execute(f, selected);
    assert.equal(aggregate(f, { WORKERS_RESULT: "success" }).status, 0);
  },
]);

cases.push([
  "invalid-skip",
  () => {
    const f = fixture("invalid-skip");
    const selected = plan(f, "apps/web/tests/e2e/report-cli.mjs");
    selected.mode = "skip";
    selected.selectedScripts = [];
    selected.shards = [];
    writeFileSync(f.planPath, JSON.stringify(selected));
    const result = aggregate(f);
    assert.notEqual(result.status, 0, "non-documentation rules cannot become a successful skip");
    const prepared = node(f, "ci-result.mjs", ["plan", "--plan", f.planPath], {
      GITHUB_OUTPUT: resolve(f.dir, "github-output"),
    });
    assert.notEqual(prepared.status, 0, "invalid skip cannot publish a matrix");
  },
]);

cases.push([
  "main-full",
  () => {
    const f = fixture("main");
    const selected = plan(f, "docs/guide.md", "push");
    assert.equal(selected.mode, "full");
    assert.deepEqual(selected.selectedScripts, inventory);
    assert.equal(selected.shards.length, 3);
    assert.ok(selected.shards.every((shard) => shard.scripts.length > 0));
    execute(f, selected);
    assert.equal(aggregate(f, { WORKERS_RESULT: "success" }).status, 0);
  },
]);

cases.push([
  "aggregate-failures",
  () => {
    const f = fixture("aggregate");
    const selected = plan(f, "apps/web/tests/e2e/report-cli.mjs");
    const originalPlan = readFileSync(f.planPath, "utf8");
    execute(f, selected);
    const rejected = (label, env = { WORKERS_RESULT: "success" }) => {
      const result = aggregate(f, env);
      assert.notEqual(result.status, 0, label);
      assert.ok(result.stderr.trim(), label);
    };
    for (const status of ["", "failure", "cancelled", "skipped"])
      rejected(`planner ${status}`, { PLAN_RESULT: status, WORKERS_RESULT: "success" });
    for (const status of ["", "failure", "cancelled", "skipped"])
      rejected(`workers ${status}`, { WORKERS_RESULT: status });
    const file = resolve(f.results, `${selected.shards[0].id}.json`);
    const original = readFileSync(file, "utf8");
    rmSync(file);
    rejected("missing worker");
    const receipt = JSON.parse(original);
    for (const change of [
      { result: "failure" },
      { result: "cancelled" },
      { result: "skipped" },
      { shard: "missing" },
      { planSha256: "another plan" },
      { schemaVersion: 2 },
    ]) {
      writeFileSync(file, JSON.stringify({ ...receipt, ...change }));
      rejected(`receipt ${JSON.stringify(change)}`);
    }
    for (const text of ["null", "{", "[]"]) {
      writeFileSync(file, text);
      rejected(`receipt ${text}`);
    }
    writeFileSync(file, original);
    writeFileSync(resolve(f.results, "duplicate.json"), original);
    rejected("duplicate worker");
    rmSync(resolve(f.results, "duplicate.json"));
    rmSync(f.planPath);
    rejected("missing plan");
    for (const text of ["{", "null", "42"]) {
      writeFileSync(f.planPath, text);
      rejected(`plan ${text}`);
    }
    const mutations = [
      (p) => {
        p.schemaVersion = 2;
      },
      (p) => {
        p.shards = [];
      },
      (p) => {
        p.shards.push(p.shards[0]);
      },
      (p) => {
        p.shards[0].scripts = [];
      },
      (p) => {
        p.shards[0].scripts = ["../escape.mjs"];
      },
      (p) => {
        p.shards[0].scripts.push(p.shards[1].scripts[0]);
      },
      (p) => {
        p.selectedScripts.push("unknown.e2e.mjs");
      },
      (p) => {
        p.discoveredScripts.reverse();
      },
      (p) => {
        p.mode = "full";
      },
      (p) => {
        p.shards = [1, 2, 3, 4].map((id) => ({ id: String(id), scripts: ["report-cli.mjs"] }));
      },
    ];
    for (const mutate of mutations) {
      const malformed = structuredClone(selected);
      mutate(malformed);
      writeFileSync(f.planPath, JSON.stringify(malformed));
      rejected("malformed partition");
      assert.notEqual(
        node(f, "ci-result.mjs", ["plan", "--plan", f.planPath], {
          GITHUB_OUTPUT: resolve(f.dir, "github-output"),
        }).status,
        0,
      );
    }
    writeFileSync(f.planPath, originalPlan);
    assert.equal(aggregate(f, { WORKERS_RESULT: "success" }).status, 0);
    rmSync(resolve(f.scripts, "discovery.e2e.mjs"));
    mkdirSync(resolve(f.scripts, "discovery.e2e.mjs"));
    rejected("non-file inventory must not count as discoverable acceptance");
  },
]);

cases.push([
  "skip-failures",
  () => {
    const f = fixture("skip-failures");
    const selected = plan(f, "docs/guide.md");
    for (const status of ["", "success", "failure", "cancelled"])
      assert.notEqual(aggregate(f, { WORKERS_RESULT: status }).status, 0);
    for (const mutate of [
      (p) => {
        p.base = null;
      },
      (p) => {
        p.changedFiles.push("missing.md");
      },
      (p) => {
        p.selectedScripts = ["report-cli.mjs"];
      },
      (p) => {
        p.shards = [{ id: "1", scripts: ["report-cli.mjs"] }];
      },
    ]) {
      const malformed = structuredClone(selected);
      mutate(malformed);
      writeFileSync(f.planPath, JSON.stringify(malformed));
      assert.notEqual(aggregate(f).status, 0);
    }
    writeFileSync(f.planPath, JSON.stringify(selected));
    mkdirSync(f.results);
    writeFileSync(resolve(f.results, "unexpected.json"), "{}");
    assert.notEqual(aggregate(f).status, 0);
    assert.notEqual(node(f, "run.mjs", ["--plan", f.planPath, "--shard", "1"]).status, 0);
    assert.deepEqual(events(f), []);
  },
]);

cases.push([
  "worker-failure-evidence",
  () => {
    for (const stopped of ["failure", "cancelled"]) {
      const f = fixture(stopped);
      const selected = plan(f, "docs/guide.md", "push");
      const stoppedShard = selected.shards.find((shard) => shard.scripts.length > 1);
      assert.ok(stoppedShard);
      for (const shard of selected.shards) {
        const dir = mkdtempSync(resolve(tmpdir(), `ci-integration-${stopped}-worker-`));
        cpSync(f.dir, dir, { recursive: true });
        fixtures.push(dir);
        const worker = { dir, scripts: resolve(dir, "apps/web/tests/cli-e2e") };
        const failing = shard.id === stoppedShard.id;
        if (failing)
          writeFileSync(
            resolve(worker.scripts, shard.scripts[0]),
            `console.log("retained failure evidence"); ${stopped === "failure" ? "process.exit(7);" : 'process.kill(process.pid, "SIGTERM"); await new Promise(() => {});'}`,
          );
        const result = node(worker, "run.mjs", ["--plan", f.planPath, "--shard", shard.id]);
        assert.equal(result.status, failing ? 1 : 0, result.stderr);
        const summaryPath = result.stdout.match(
          /CLI acceptance (?:passed|failed|interrupted): (.+\/summary.json)/,
        )?.[1];
        assert.ok(summaryPath, result.stdout);
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        if (failing) {
          assert.equal(summary.outcome, stopped === "failure" ? "failed" : "interrupted");
          assert.deepEqual(
            summary.results.map((entry) => entry.status),
            [
              stopped === "failure" ? "failed" : "interrupted",
              ...shard.scripts.slice(1).map(() => "not_run"),
            ],
          );
          assert.ok(
            readFileSync(resolve(worker.dir, summary.results[0].log), "utf8").includes(
              "retained failure evidence",
            ),
          );
        } else assert.equal(summary.outcome, "passed");
        assert.equal(
          node(
            worker,
            "ci-result.mjs",
            [
              "worker",
              "--plan",
              f.planPath,
              "--shard",
              shard.id,
              "--output",
              resolve(f.results, `${shard.id}.json`),
            ],
            { WORKER_RESULT: failing ? stopped : "success" },
          ).status,
          0,
        );
      }
      assert.notEqual(aggregate(f, { WORKERS_RESULT: stopped }).status, 0);
      assert.notEqual(
        aggregate(f, { WORKERS_RESULT: "success" }).status,
        0,
        "successful needs cannot hide a failed receipt",
      );
    }
  },
]);

for (const [name, run] of cases) {
  if (process.argv[2] && process.argv[2] !== name) continue;
  try {
    run();
    checks.push({ name, status: "passed" });
  } catch (error) {
    checks.push({ name, status: "failed", error: error.stack });
    process.exitCode = 1;
  }
}
if (!checks.length) process.exitCode = 1;
const retainedFixtures = fixtures.map((dir) => {
  const retained = resolve(output, "fixtures", basename(dir));
  cpSync(dir, retained, { recursive: true });
  return { original: dir, retained };
});
writeFileSync(
  resolve(output, "summary.json"),
  JSON.stringify(
    {
      reproductionCommand: "node apps/web/tests/cli-e2e/ci-integration.e2e.mjs",
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
