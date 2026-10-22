import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const checker = fileURLToPath(new URL("./pr-delivery-status.mjs", import.meta.url));
const output = resolve("output/e2e/pr-delivery-status/selfcheck.json");
const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
const validBody = `## Summary\n\nParses the current PR readiness state.\n\n## Evidence\n\n- \`node scripts/pr-delivery-status.test.mjs\` exited 0.\n\n## Merge Danger\n\n**Door:** Two-way\n\n**Blast Radius:** Low\n`;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function fixture({
  body = validBody,
  checks = [{ name: "CI", state: "SUCCESS", workflow: "CI" }],
  pr = {},
  invalid = false,
  fail = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "pr-delivery-status-"));
  const repo = join(root, "repo");
  const bin = join(root, "bin");
  mkdirSync(repo);
  mkdirSync(bin);
  run(realGit, ["init", "-q", "-b", "feature/preflight"], repo);
  run(realGit, ["config", "user.name", "Preflight Fixture"], repo);
  run(realGit, ["config", "user.email", "preflight@example.invalid"], repo);
  writeFileSync(join(repo, "seed.txt"), "fixture\n");
  run(realGit, ["add", "seed.txt"], repo);
  run(realGit, ["commit", "-qm", "seed"], repo);
  const head = run(realGit, ["rev-parse", "HEAD"], repo);
  const prData = {
    number: 123,
    state: "OPEN",
    headRefName: "feature/preflight",
    headRefOid: head,
    baseRefName: "main",
    body,
    ...pr,
  };
  const fixturePath = join(root, "github.json");
  writeFileSync(
    fixturePath,
    JSON.stringify({ pr: prData, checks, invalid, fail, calls: join(root, "calls.jsonl") }),
  );
  writeFileSync(
    join(bin, "gh"),
    `#!/usr/bin/env node\nconst fs = require("node:fs");\nconst data = JSON.parse(fs.readFileSync(process.env.PR_PREFLIGHT_FIXTURE, "utf8"));\nfs.appendFileSync(data.calls, JSON.stringify(process.argv.slice(2)) + "\\n");\nif (data.fail) process.exit(2);\nif (process.argv[2] !== "pr" || !["view", "checks"].includes(process.argv[3])) process.exit(64);\nif (data.invalid) { process.stdout.write("not json"); process.exit(0); }\nprocess.stdout.write(JSON.stringify(process.argv[3] === "view" ? data.pr : data.checks));\n`,
    { mode: 0o755 },
  );
  const path = `${bin}${delimiter}${process.env.PATH ?? ""}`;
  return {
    root,
    repo,
    fixturePath,
    head,
    env: { ...process.env, PATH: path, PR_PREFLIGHT_FIXTURE: fixturePath },
  };
}

function invoke(fx) {
  return spawnSync(process.execPath, [checker, "123"], {
    cwd: fx.repo,
    env: fx.env,
    encoding: "utf8",
  });
}

test("PR delivery status CLI rejects unsafe or incomplete delivery states", async (t) => {
  const results = [];
  async function scenario(name, options, change, expected) {
    await t.test(name, () => {
      const fx = fixture(options);
      try {
        change?.(fx);
        const result = invoke(fx);
        assert.equal(result.error, undefined, result.error?.message);
        assert.equal(result.status, expected.ok ? 0 : 1, result.stdout + result.stderr);
        if (expected.match) assert.match(result.stdout + result.stderr, expected.match);
        const callsPath = join(fx.root, "calls.jsonl");
        const calls = existsSync(callsPath)
          ? readFileSync(callsPath, "utf8")
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line))
          : [];
        assert.ok(
          calls.every(([kind, action]) => kind === "pr" && ["view", "checks"].includes(action)),
        );
        results.push({ name, ok: expected.ok, output: (result.stdout + result.stderr).trim() });
      } finally {
        rmSync(fx.root, { recursive: true, force: true });
      }
    });
  }

  await scenario(
    "reports ready only for an exact clean head, all-success checks, and complete PR evidence",
    {},
    null,
    { ok: true },
  );
  await scenario("rejects a different remote head", { pr: { headRefOid: "0".repeat(40) } }, null, {
    ok: false,
    match: /head/i,
  });
  await scenario("rejects a different branch", { pr: { headRefName: "feature/other" } }, null, {
    ok: false,
    match: /branch/i,
  });
  await scenario(
    "rejects detached HEAD",
    {},
    (fx) => run(realGit, ["checkout", "--detach", "HEAD"], fx.repo),
    { ok: false, match: /branch|detached/i },
  );
  await scenario(
    "rejects a dirty checkout",
    {},
    (fx) => writeFileSync(join(fx.repo, "untracked.txt"), "dirty"),
    { ok: false, match: /clean|dirty/i },
  );
  await scenario("rejects a closed pull request", { pr: { state: "CLOSED" } }, null, {
    ok: false,
    match: /open|closed/i,
  });
  await scenario("rejects a non-main base", { pr: { baseRefName: "release" } }, null, {
    ok: false,
    match: /main|base/i,
  });
  await scenario(
    "rejects pending checks",
    { checks: [{ name: "CI", state: "IN_PROGRESS" }] },
    null,
    { ok: false, match: /pending|in_progress|success/i },
  );
  await scenario("rejects skipped checks", { checks: [{ name: "CI", state: "SKIPPED" }] }, null, {
    ok: false,
    match: /skipped|success/i,
  });
  await scenario(
    "accepts the documented docs-only CLI worker skip with successful plan and aggregate",
    {
      checks: [
        { name: "cli-acceptance-plan", state: "SUCCESS", workflow: "CI" },
        { name: "cli-acceptance-workers (1)", state: "SKIPPED", workflow: "CI" },
        { name: "cli-acceptance", state: "SUCCESS", workflow: "CI" },
      ],
    },
    null,
    { ok: true },
  );
  await scenario(
    "rejects the CLI worker skip without a successful aggregate",
    {
      checks: [
        { name: "cli-acceptance-plan", state: "SUCCESS", workflow: "CI" },
        { name: "cli-acceptance-workers (1)", state: "SKIPPED", workflow: "CI" },
      ],
    },
    null,
    { ok: false, match: /aggregate|cli-acceptance/i },
  );
  await scenario(
    "rejects a CLI worker skip reported by another workflow",
    {
      checks: [
        { name: "cli-acceptance-plan", state: "SUCCESS", workflow: "CI" },
        { name: "cli-acceptance-workers (1)", state: "SKIPPED", workflow: "Other" },
        { name: "cli-acceptance", state: "SUCCESS", workflow: "CI" },
      ],
    },
    null,
    { ok: false, match: /skipped|workflow|success/i },
  );
  await scenario(
    "rejects a non-CLI skip even when CLI plan and aggregate succeeded",
    {
      checks: [
        { name: "cli-acceptance-plan", state: "SUCCESS", workflow: "CI" },
        { name: "deploy-preview", state: "SKIPPED", workflow: "CI" },
        { name: "cli-acceptance", state: "SUCCESS", workflow: "CI" },
      ],
    },
    null,
    { ok: false, match: /skipped|success/i },
  );
  await scenario("rejects failed checks", { checks: [{ name: "CI", state: "FAILURE" }] }, null, {
    ok: false,
    match: /failure|failed|success/i,
  });
  await scenario("rejects an empty check set", { checks: [] }, null, {
    ok: false,
    match: /check/i,
  });
  await scenario(
    "rejects missing required PR sections",
    { body: "## Summary\n\nOnly summary." },
    null,
    { ok: false, match: /evidence|merge danger/i },
  );
  await scenario(
    "accepts evidence with an exit status and no invented limits section",
    { body: validBody },
    null,
    { ok: true },
  );
  await scenario("reports gh failures", { fail: true }, null, {
    ok: false,
    match: /gh|GitHub|failed/i,
  });
  await scenario("reports malformed gh output", { invalid: true }, null, {
    ok: false,
    match: /json|parse|gh/i,
  });

  mkdirSync(resolve("output/e2e/pr-delivery-status"), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify({ kind: "simulated-gh-selfcheck", githubEvidence: false, scenarios: results }, null, 2)}\n`,
  );
  assert.equal(results.length, 19);
});
