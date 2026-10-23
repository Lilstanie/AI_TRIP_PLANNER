import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("./redgreen.mjs", import.meta.url));

const fakeE2e = `
import { existsSync, readFileSync, writeFileSync } from "node:fs";
writeFileSync("started", "");
if (process.env.FAKE_SLEEP) await new Promise((r) => setTimeout(r, 30000));
const src = existsSync("src.txt") ? readFileSync("src.txt", "utf8") : "";
console.log("ok always");
const fixed = src.includes("fixed") || existsSync("new.txt");
console.log(fixed ? "ok the fix" : "FAIL the fix");
process.exit(process.env.FAKE_EXIT ?? (fixed ? 0 : 1));
`;

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function fixture(base = "broken\n") {
  const repo = mkdtempSync(join(tmpdir(), "redgreen-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  mkdirSync(join(repo, "apps/web/tests/e2e"), { recursive: true });
  writeFileSync(join(repo, "apps/web/tests/e2e/demo.e2e.mjs"), "");
  writeFileSync(join(repo, "src.txt"), base);
  writeFileSync(join(repo, "fake.mjs"), fakeE2e);
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  git(repo, "checkout", "-qb", "fix/demo");
  return repo;
}

const env = (extra = {}) => ({ ...process.env, REDGREEN_RUN: "node fake.mjs", ...extra });

function run(repo, args, extra) {
  return spawnSync("node", [cli, "--base", "main", ...args], {
    cwd: repo,
    encoding: "utf8",
    env: env(extra),
  });
}

test("usage errors exit 2 and run nothing", () => {
  const repo = fixture();
  for (const args of [[], ["demo"], ["demo", "--"]]) {
    const result = run(repo, args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(existsSync(join(repo, "started")), false);
  }
});

test("a fix that turns the check red to green exits 0 and restores the tree", () => {
  const repo = fixture();
  writeFileSync(join(repo, "src.txt"), "fixed\n");
  const result = run(repo, ["demo", "--", "src.txt"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /before \(main\): exit 1, 1\/2 ok/);
  assert.match(result.stdout, /after: exit 0, 2\/2 ok/);
  assert.equal(readFileSync(join(repo, "src.txt"), "utf8"), "fixed\n");
});

test("a check that already passes before the fix exits 1", () => {
  const repo = fixture("fixed\n");
  writeFileSync(join(repo, "src.txt"), "fixed again\n");
  const result = run(repo, ["demo", "--", "src.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /before .*passed/);
});

test("an after run that fails exits 1", () => {
  const repo = fixture();
  writeFileSync(join(repo, "src.txt"), "still broken\n");
  const result = run(repo, ["demo", "--", "src.txt"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /after: exit 1, 1\/2 ok/);
});

test("exit 0 with a FAIL line does not count as passed", () => {
  const repo = fixture();
  writeFileSync(join(repo, "src.txt"), "still broken\n");
  const result = run(repo, ["demo", "--", "src.txt"], { FAKE_EXIT: "0" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /after: exit 0, 1\/2 ok \(failed\)/);
});

test("unchanged, missing and E2E-script paths are refused", () => {
  const repo = fixture();
  for (const path of ["src.txt", "typo.txt", "apps/web/tests/e2e/demo.e2e.mjs"]) {
    const result = run(repo, ["demo", "--", path]);
    assert.equal(result.status, 2, path);
    assert.equal(existsSync(join(repo, "started")), false, path);
  }
});

test("a file new on the branch is removed for the before run and restored", () => {
  const repo = fixture();
  writeFileSync(join(repo, "new.txt"), "new\n");
  const result = run(repo, ["demo", "--", "new.txt"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(repo, "new.txt"), "utf8"), "new\n");
});

test("an interrupted run restores the working tree", async () => {
  const repo = fixture();
  writeFileSync(join(repo, "src.txt"), "fixed\n");
  const child = spawn("node", [cli, "--base", "main", "demo", "--", "src.txt"], {
    cwd: repo,
    env: env({ FAKE_SLEEP: "1" }),
  });
  while (!existsSync(join(repo, "started"))) await new Promise((r) => setTimeout(r, 50));
  assert.equal(readFileSync(join(repo, "src.txt"), "utf8"), "broken\n");
  child.kill("SIGTERM");
  const code = await new Promise((r) => child.on("exit", r));
  assert.notEqual(code, 0);
  assert.equal(readFileSync(join(repo, "src.txt"), "utf8"), "fixed\n");
});

test("a missing E2E command restores the working tree", () => {
  const repo = fixture();
  writeFileSync(join(repo, "src.txt"), "fixed\n");
  const result = run(repo, ["demo", "--", "src.txt"], { REDGREEN_RUN: "no-such-command-xyz" });
  assert.equal(result.status, 1);
  assert.equal(readFileSync(join(repo, "src.txt"), "utf8"), "fixed\n");
});
