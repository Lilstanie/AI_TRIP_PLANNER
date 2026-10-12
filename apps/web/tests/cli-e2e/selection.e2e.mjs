import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const selector = resolve(import.meta.dirname, "select.mjs");
mkdirSync(resolve(root, "output/e2e/selection"), { recursive: true });
const output = mkdtempSync(resolve(root, "output/e2e/selection/run-"));
const inventory = [
  "discovery.e2e.mjs",
  "legacy-runner.e2e.mjs",
  "local-cleanup.e2e.mjs",
  "local-cli-collections.e2e.mjs",
  "local-test-cli-repeat.e2e.mjs",
  "local-test-cli.e2e.mjs",
  "report-cli.mjs",
  "report-interrupted.e2e.mjs",
  "review-comment-policy.e2e.mjs",
  "skill-maintenance.e2e.mjs",
];
const results = [];
const commands = [];
const reproductionCommand = "node apps/web/tests/cli-e2e/selection.e2e.mjs";
function fixture() {
  const cwd = mkdtempSync(resolve(output, "repo-"));
  const write = (path, content = "Fixture\n") => {
    mkdirSync(dirname(resolve(cwd, path)), { recursive: true });
    writeFileSync(resolve(cwd, path), content);
  };
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  for (const script of inventory) write(`apps/web/tests/cli-e2e/${script}`, "process.exit(0);\n");
  write("docs/guide.md");
  const commit = (message) => {
    git("add", "--all");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  const base = commit("Initial fixture");
  const run = (args = [], expectedStatus = 0, invocation = {}) => {
    const planPath = invocation.outputPath ?? resolve(cwd, `plan-${commands.length}.json`);
    const argv = [
      invocation.selector ?? selector,
      ...(invocation.defaultRepo ? [] : ["--repo", cwd]),
      ...(invocation.omitOutput ? [] : ["--output", planPath]),
      ...args,
    ];
    const result = spawnSync(process.execPath, argv, {
      cwd: output,
      env: { ...process.env, ...invocation.env },
      encoding: "utf8",
      timeout: 10000,
    });
    const command = {
      executable: process.execPath,
      argv,
      cwd: output,
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr,
    };
    commands.push(command);
    writeFileSync(
      resolve(output, `command-${commands.length}.json`),
      `${JSON.stringify(command, null, 2)}\n`,
    );
    assert.equal(result.status, expectedStatus, result.stderr);
    if (expectedStatus !== 0) return command;
    const plan = JSON.parse(readFileSync(planPath, "utf8"));
    assert.equal(plan.schemaVersion, 1);
    assert.ok(result.stdout.includes(plan.mode), result.stdout);
    assert.ok(plan.reason.length > 0);
    assert.deepEqual(plan.discoveredScripts, [...plan.discoveredScripts].sort());
    assert.deepEqual(plan.selectedScripts, [...new Set(plan.selectedScripts)].sort());
    assert.ok(plan.selectedScripts.every((script) => plan.discoveredScripts.includes(script)));
    const assigned = plan.shards.flatMap((shard) => shard.scripts);
    assert.deepEqual(assigned.sort(), plan.selectedScripts);
    assert.equal(new Set(plan.shards.map((shard) => shard.id)).size, plan.shards.length);
    assert.ok(plan.shards.length <= 3);
    assert.ok(
      plan.shards.every((shard) => typeof shard.id === "string" && shard.scripts.length > 0),
    );
    if (plan.mode === "full") assert.deepEqual(plan.selectedScripts, plan.discoveredScripts);
    if (plan.mode === "skip") assert.deepEqual(plan.shards, []);
    else assert.ok(plan.shards.length > 0);
    return plan;
  };
  return {
    cwd,
    write,
    git,
    commit,
    base,
    run,
    pr: (head, baseRevision = base) =>
      run(["--event", "pull_request", "--base", baseRevision, "--head", head]),
  };
}
function check(name, test) {
  try {
    test();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({ name, status: "failed", error: error.stack });
    throw error;
  }
}
try {
  check("ordinary documentation produces an explicit auditable skip", () => {
    const f = fixture();
    f.write("docs/guide.md", "Updated ordinary prose\n");
    const head = f.commit("Update documentation");
    const plan = f.pr(head);
    assert.equal(plan.mode, "skip");
    assert.equal(plan.base, f.base);
    assert.equal(plan.head, head);
    assert.deepEqual(plan.changedFiles, ["docs/guide.md"]);
    assert.deepEqual(plan.selectedScripts, []);
    assert.deepEqual(plan.discoveredScripts, inventory);
    assert.deepEqual(plan.matchedRules, [
      { path: "docs/guide.md", rule: "ordinary-documentation", scripts: [] },
    ]);
  });
  check("all PR commits and mapped consumers participate through merge base", () => {
    const f = fixture();
    f.write("apps/web/tests/e2e/report-cli.mjs");
    f.commit("Change report reader");
    f.write(".agents/skills/skill-maintenance/scripts/check-skills.mjs");
    f.commit("Change drift checker");
    f.write("docs/guide.md", "Final docs commit\n");
    const head = f.commit("Document changes");
    f.git("checkout", "-qb", "base-advanced", f.base);
    f.write("packages/shared/src/base-only.ts");
    const base = f.commit("Unrelated base branch advance");
    f.git("checkout", "--detach", head);
    const plan = f.pr(head, base);
    assert.equal(plan.mode, "selected");
    assert.deepEqual(plan.changedFiles, [
      ".agents/skills/skill-maintenance/scripts/check-skills.mjs",
      "apps/web/tests/e2e/report-cli.mjs",
      "docs/guide.md",
    ]);
    assert.deepEqual(plan.selectedScripts, [
      "report-cli.mjs",
      "report-interrupted.e2e.mjs",
      "skill-maintenance.e2e.mjs",
    ]);
    assert.deepEqual(
      plan.matchedRules.find((rule) => rule.path.endsWith("/report-cli.mjs")).scripts,
      ["report-cli.mjs", "report-interrupted.e2e.mjs"],
    );
    assert.equal(plan.base, base);
  });
  check("audited exact features narrow and shared or unknown inputs run full", () => {
    for (const [path, selected] of [
      ["apps/web/tests/e2e/legacy-runner.mjs", ["legacy-runner.e2e.mjs", "local-test-cli.e2e.mjs"]],
      [
        ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs",
        ["review-comment-policy.e2e.mjs"],
      ],
      [".agents/skills/skill-maintenance/scripts/new-helper.mjs", ["skill-maintenance.e2e.mjs"]],
      ...inventory.map((script) => [`apps/web/tests/cli-e2e/${script}`, [script]]),
      ...[
        "apps/web/tests/e2e/repeat-cli.mjs",
        "apps/web/tests/e2e/run.mjs",
        "apps/web/tests/e2e/local-cli.mjs",
        "apps/web/tests/e2e/discovery.mjs",
        "apps/web/tests/e2e/cleanup-cli.mjs",
        "apps/web/tests/e2e/local-cli-collections.mjs",
        "apps/web/tests/e2e/resource-ownership.mjs",
        "apps/web/tests/e2e/legacy-new.mjs",
        "apps/web/tests/e2e/agent-lab-single-agent.e2e.mjs",
        "apps/web/tests/e2e/agent-lab-replay.e2e.mjs",
        "apps/web/tests/e2e/future-journey.e2e.mjs",
        "apps/web/tests/cli-e2e/run.mjs",
        "apps/web/tests/cli-e2e/select.mjs",
        "apps/web/tests/cli-e2e/runner-plan.mjs",
        "apps/web/lib/money.ts",
        "apps/web/lib/i18n/locale.ts",
        "apps/web/app/layout.tsx",
        "apps/web/components/workspace/Client.tsx",
        "apps/web/public/sw.js",
        "packages/orchestrator/src/workflow.ts",
        "packages/shared/src/index.ts",
        "package.json",
        "apps/web/package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "turbo.json",
        "tsconfig.base.json",
        "apps/web/tsconfig.json",
        "apps/web/next.config.mjs",
        "apps/web/postcss.config.mjs",
        ".github/workflows/ci.yml",
        "scripts/install-git-hooks.mjs",
        ".agents/skills/review-trip-planner/scripts/unknown.mjs",
        ".agents/skills/skill-maintenance/SKILL.md",
        ".agents/skills/other/references/guide.md",
        "AGENTS.md",
        "CLAUDE.md",
        "docs/AGENTS.md",
        "docs/sub/CLAUDE.md",
        "docs/fixture.json",
        "notes.md",
        "unknown/source.ts",
      ].map((path) => [path, null]),
    ]) {
      const f = fixture();
      f.write(path, "Changed fixture\n");
      f.write("docs/guide.md", "Mixed docs must not cancel executable rules\n");
      const plan = f.pr(f.commit(`Change ${path}`));
      assert.equal(plan.mode, selected ? "selected" : "full", path);
      assert.deepEqual(plan.selectedScripts, selected ?? inventory, path);
      assert.ok(
        plan.matchedRules.some((rule) => rule.path === path && rule.scripts.length > 0),
        path,
      );
      if (path.endsWith("/repeat-cli.mjs")) {
        assert.ok(plan.selectedScripts.includes("local-cleanup.e2e.mjs"));
        assert.ok(plan.selectedScripts.includes("local-test-cli-repeat.e2e.mjs"));
      }
    }
  });
  check("only the explicit ordinary prose allowlist skips", () => {
    const f = fixture();
    for (const path of [
      "README.md",
      "README.zh.md",
      "docs/sub/guide.md",
      ".agents/session-logs/2026-10-12-selection.md",
      ".agents/translation-pairs.json",
    ])
      f.write(path, `Unique documentation for ${path}\n`);
    const plan = f.pr(f.commit("Update safe prose and review records"));
    assert.equal(plan.mode, "skip");
    assert.equal(plan.changedFiles.length, 5);
  });
  check("deletions and both rename or copy endpoints survive whitespace safely", () => {
    const f = fixture();
    f.write("apps/web/tests/e2e/report-cli.mjs", "unique report reader fixture contents\n");
    f.write(
      ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs",
      "unique comment checker fixture\n",
    );
    const base = f.commit("Seed deletable and renameable dependencies");
    rmSync(resolve(f.cwd, ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs"));
    const renamed = "docs/report moved\twith\nwhitespace 雪.md";
    renameSync(resolve(f.cwd, "apps/web/tests/e2e/report-cli.mjs"), resolve(f.cwd, renamed));
    const head = f.commit("Delete checker and rename report into documentation");
    const plan = f.pr(head, base);
    assert.equal(plan.mode, "selected");
    assert.deepEqual(plan.changedFiles, [
      ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs",
      "apps/web/tests/e2e/report-cli.mjs",
      renamed,
    ]);
    assert.deepEqual(plan.selectedScripts, [
      "report-cli.mjs",
      "report-interrupted.e2e.mjs",
      "review-comment-policy.e2e.mjs",
    ]);
    const copy = fixture();
    copy.write(
      "apps/web/tests/e2e/report-cli.mjs",
      "unique long report reader contents for Git copy detection\n",
    );
    const copyBase = copy.commit("Seed copy source");
    copy.write("docs/copied.md", "unique long report reader contents for Git copy detection\n");
    const copied = copy.pr(copy.commit("Copy reader to prose"), copyBase);
    assert.deepEqual(copied.changedFiles, ["apps/web/tests/e2e/report-cli.mjs", "docs/copied.md"]);
    assert.deepEqual(copied.selectedScripts, ["report-cli.mjs", "report-interrupted.e2e.mjs"]);
    const unsafe = fixture();
    const strange = "apps/web/lib/space '$(touch should-never-exist)'\n雪.ts";
    unsafe.write(strange, "Unique whitespace source fixture\n");
    const full = unsafe.pr(unsafe.commit("Add whitespace source"));
    assert.equal(full.mode, "full");
    assert.deepEqual(full.changedFiles, [strange]);
    assert.equal(existsSync(resolve(output, "should-never-exist")), false);
    for (const action of ["delete", "rename"]) {
      const changed = fixture();
      const path = resolve(changed.cwd, "apps/web/tests/cli-e2e/report-cli.mjs");
      if (action === "delete") rmSync(path);
      else renameSync(path, resolve(changed.cwd, "docs/old-report.md"));
      const inventoryPlan = changed.pr(changed.commit(`${action} acceptance script`));
      assert.equal(inventoryPlan.mode, "full", action);
      assert.ok(!inventoryPlan.selectedScripts.includes("report-cli.mjs"));
      assert.ok(inventoryPlan.changedFiles.includes("apps/web/tests/cli-e2e/report-cli.mjs"));
    }
  });
  check("inventory drift forces full while reserved acceptance arrivals are classified", () => {
    const f = fixture();
    f.write("apps/web/tests/cli-e2e/newly-discovered.e2e.mjs", "process.exit(0);\n");
    let plan = f.pr(f.commit("Add acceptance program"));
    assert.equal(plan.mode, "full");
    assert.ok(plan.selectedScripts.includes("newly-discovered.e2e.mjs"));
    const base = f.git("rev-parse", "HEAD");
    f.write("docs/guide.md", "Docs after new acceptance\n");
    plan = f.pr(f.commit("Docs with unknown inventory"), base);
    assert.equal(plan.mode, "full");
    assert.match(plan.reason, /inventory|unclassified/i);
    const reserved = fixture();
    for (const script of ["selection.e2e.mjs", "runner-plan.e2e.mjs", "ci-integration.e2e.mjs"])
      reserved.write(`apps/web/tests/cli-e2e/${script}`, `process.stdout.write('${script}');\n`);
    const reservedBase = reserved.commit("Introduce reviewed planner and runner acceptance");
    reserved.write("docs/guide.md", "Docs with reserved acceptance inventory\n");
    assert.equal(
      reserved.pr(reserved.commit("Docs after reserved arrivals"), reservedBase).mode,
      "skip",
    );
    for (const script of ["selection.e2e.mjs", "runner-plan.e2e.mjs", "ci-integration.e2e.mjs"]) {
      reserved.write(`apps/web/tests/cli-e2e/${script}`, "Changed reserved acceptance fixture\n");
      assert.equal(reserved.pr(reserved.commit(`Change ${script}`)).mode, "full");
    }
    const missing = fixture();
    rmSync(resolve(missing.cwd, "apps/web/tests/cli-e2e/report-cli.mjs"));
    const missingBase = missing.commit("Remove known script");
    missing.write("docs/guide.md", "Docs after missing known consumer\n");
    const missingPlan = missing.pr(missing.commit("Docs with stale mapping"), missingBase);
    assert.equal(missingPlan.mode, "full");
    assert.ok(!missingPlan.selectedScripts.includes("report-cli.mjs"));
    for (const invalid of ["empty", "missing", "directory", "symlink", "unsafe-name"]) {
      const broken = fixture();
      const dir = resolve(broken.cwd, "apps/web/tests/cli-e2e");
      if (invalid === "empty" || invalid === "missing") {
        rmSync(dir, { recursive: true });
        if (invalid === "empty") mkdirSync(dir);
      } else if (invalid === "directory") mkdirSync(resolve(dir, "directory.e2e.mjs"));
      else if (invalid === "symlink") symlinkSync("report-cli.mjs", resolve(dir, "linked.e2e.mjs"));
      else broken.write("apps/web/tests/cli-e2e/unsafe name.e2e.mjs");
      const failure = broken.run(
        ["--event", "pull_request", "--base", broken.base, "--head", broken.base],
        1,
      );
      assert.match(failure.stderr, /inventory/i, invalid);
      assert.ok(!failure.stdout.includes("skip"), invalid);
    }
  });
  check("push unsupported events and unavailable history cannot become a skip", () => {
    const f = fixture();
    f.write("docs/guide.md", "Docs for event and history controls\n");
    const head = f.commit("Docs-only event control");
    for (const [args, reason] of [
      [["--event", "push", "--base", f.base, "--head", head], /push/i],
      [["--event", "workflow_dispatch", "--base", f.base, "--head", head], /event/i],
      [[], /event/i],
      [["--event", "pull_request", "--head", head], /revision/i],
      [["--event", "pull_request", "--base", f.base], /revision/i],
      [["--event", "pull_request", "--base", "missing-revision", "--head", head], /revision/i],
      [["--event", "pull_request", "--base", f.base, "--head", "missing-revision"], /revision/i],
      [["--event", "pull_request", "--base", "--help", "--head", head], /revision/i],
    ]) {
      const plan = f.run(args);
      assert.equal(plan.mode, "full", JSON.stringify(args));
      assert.match(plan.reason, reason);
    }
    const push = f.run(["--event", "push", "--base", f.base, "--head", head]);
    assert.deepEqual(push.changedFiles, ["docs/guide.md"]);
    const empty = f.pr(head, head);
    assert.equal(empty.mode, "skip");
    assert.deepEqual(empty.changedFiles, []);
    f.git("checkout", "--orphan", "unrelated");
    f.git("rm", "-rf", ".");
    f.write("unrelated.md", "Independent root\n");
    const orphan = f.commit("Unrelated history");
    f.git("checkout", "--detach", head);
    const unrelated = f.pr(head, orphan);
    assert.equal(unrelated.mode, "full");
    assert.match(unrelated.reason, /merge.base|comparison/i);
    writeFileSync(resolve(f.cwd, ".git/shallow"), `${head}\n`);
    const shallow = f.pr(head);
    assert.equal(shallow.mode, "full");
    assert.match(shallow.reason, /shallow|history/i);
    rmSync(resolve(f.cwd, ".git"), { recursive: true });
    const noGit = f.pr(head);
    assert.equal(noGit.mode, "full");
    assert.match(noGit.reason, /revision|Git|history/i);
  });
  check("measured CI estimates deterministically balance up to three nonempty shards", () => {
    const f = fixture();
    for (const script of ["selection.e2e.mjs", "runner-plan.e2e.mjs"])
      f.write(`apps/web/tests/cli-e2e/${script}`, `New acceptance ${script}\n`);
    const head = f.commit("Full suite with reserved acceptance programs");
    const args = ["--event", "push", "--base", f.base, "--head", head];
    const plan = f.run(args);
    assert.deepEqual(plan, f.run(args));
    assert.deepEqual(plan.shards, [
      { id: "1", scripts: ["local-cli-collections.e2e.mjs"] },
      {
        id: "2",
        scripts: [
          "local-test-cli.e2e.mjs",
          "report-interrupted.e2e.mjs",
          "review-comment-policy.e2e.mjs",
          "runner-plan.e2e.mjs",
          "selection.e2e.mjs",
          "skill-maintenance.e2e.mjs",
        ],
      },
      {
        id: "3",
        scripts: [
          "discovery.e2e.mjs",
          "legacy-runner.e2e.mjs",
          "local-cleanup.e2e.mjs",
          "local-test-cli-repeat.e2e.mjs",
          "report-cli.mjs",
        ],
      },
    ]);
    const narrow = fixture();
    narrow.write("apps/web/tests/e2e/report-cli.mjs", "Reader change\n");
    const selected = narrow.pr(narrow.commit("Report reader only"));
    assert.equal(selected.shards.length, 2);
    assert.deepEqual(selected.selectedScripts, ["report-cli.mjs", "report-interrupted.e2e.mjs"]);
  });
  check(
    "invalid command inputs fail visibly and default repository follows command location",
    () => {
      const f = fixture();
      f.write("docs/guide.md", "Default repository control\n");
      const head = f.commit("Docs for command contract");
      for (const args of [
        ["--unknown", "value"],
        ["--event"],
        ["--event", "pull_request", "--event", "push"],
        ["positional", "value"],
      ]) {
        const failure = f.run(args, 1);
        assert.match(failure.stderr, /argument|option|value/i);
      }
      const missingOutput = f.run(["--event", "push"], 1, { omitOutput: true });
      assert.match(missingOutput.stderr, /output/i);
      f.run(["--event", "push"], 1, { outputPath: f.cwd });
      const copiedSelector = resolve(f.cwd, "apps/web/tests/cli-e2e/select.mjs");
      copyFileSync(selector, copiedSelector);
      const args = ["--event", "pull_request", "--base", f.base, "--head", head];
      const plan = f.run(args, 0, { selector: copiedSelector, defaultRepo: true });
      assert.equal(plan.mode, "skip");
      assert.deepEqual(plan.changedFiles, ["docs/guide.md"]);
      const emptyPath = resolve(f.cwd, "empty-bin");
      mkdirSync(emptyPath);
      const noExecutable = f.run(args, 0, { env: { PATH: emptyPath } });
      assert.equal(noExecutable.mode, "full");
      assert.match(noExecutable.reason, /Git.*failed/i);
    },
  );
} finally {
  writeFileSync(
    resolve(output, "summary.json"),
    `${JSON.stringify({ reproductionCommand, outcome: results.some((result) => result.status === "failed") ? "failed" : "passed", results, commands }, null, 2)}\n`,
  );
  console.log(`Selection acceptance evidence: ${output}/summary.json`);
}
