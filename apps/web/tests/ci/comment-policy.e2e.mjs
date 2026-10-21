import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const command = resolve(
  root,
  ".agents/skills/review-trip-planner/scripts/check-comment-policy-ci.mjs",
);
const exceptions = ".agents/skills/review-trip-planner/assets/comment-exceptions.json";
const out = resolve(root, "output/e2e/comment-policy-ci");
mkdirSync(out, { recursive: true });
const output = mkdtempSync(resolve(out, "run-"));
const results = [];
const write = (cwd, path, text) => {
  mkdirSync(dirname(resolve(cwd, path)), { recursive: true });
  writeFileSync(resolve(cwd, path), text);
};
function fixture(name) {
  const cwd = resolve(output, name);
  mkdirSync(cwd);
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout: 10000 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init", "--quiet");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  write(cwd, exceptions, "[]\n");
  write(cwd, "source.ts", "// retained\nexport const value = 1;\n");
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "--allow-empty", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  return { cwd, git, commit, base: commit() };
}
function check(
  f,
  name,
  expected,
  event = "push",
  base = f.base,
  head = f.git("rev-parse", "HEAD"),
) {
  const report = resolve(output, `${name}.json`);
  const args = [command, "--event", event, "--base", base, "--head", head, "--output", report];
  const r = spawnSync(process.execPath, args, { cwd: f.cwd, encoding: "utf8", timeout: 30000 });
  const entry = { name, args, cwd: f.cwd, status: r.status, stdout: r.stdout, stderr: r.stderr };
  results.push(entry);
  writeFileSync(resolve(output, "summary.json"), JSON.stringify({ results }, null, 2));
  assert.equal(r.status, expected, JSON.stringify(entry));
  const saved = JSON.parse(readFileSync(report, "utf8"));
  assert.equal(saved.exitCode, expected);
  return saved;
}
{
  const f = fixture("multi-push");
  write(f.cwd, "source.ts", "// retained\n// first commit violation\nexport const value = 1;\n");
  f.commit();
  write(f.cwd, "readme.md", "second commit\n");
  f.commit();
  assert.equal(check(f, "multi-push", 1).violations.length, 1);
}
{
  const f = fixture("pr-divergence");
  f.git("checkout", "-qb", "topic");
  write(f.cwd, "source.ts", "// retained\n// PR violation\nexport const value = 1;\n");
  f.commit();
  const head = f.git("rev-parse", "HEAD");
  f.git("checkout", "--detach", f.base);
  write(f.cwd, "main.ts", "// main only\nexport {};\n");
  const base = f.commit();
  f.git("checkout", "--detach", head);
  const r = check(f, "pr-merge-base", 1, "pull_request", base);
  assert.deepEqual(r.paths, ["source.ts"]);
  assert.equal(r.base, f.base);
}
{
  const f = fixture("safe-and-docs");
  write(f.cwd, "source.ts", "// retained\nexport const value = 2;\n");
  f.commit();
  assert.equal(check(f, "retained", 0).violations.length, 0);
  const base = f.git("rev-parse", "HEAD");
  write(f.cwd, "docs.md", "docs\n");
  f.commit();
  assert.equal(check(f, "docs-skip", 0, "push", base).outcome, "skipped");
}
{
  const f = fixture("literal-paths");
  write(f.cwd, "space name\nline.tsx", "export const view = <div>{/* new */}</div>;\n");
  write(f.cwd, "module.mts", "// module\nexport {};\n");
  f.commit();
  const r = check(f, "literal-paths", 1);
  assert.equal(r.violations.length, 2);
  assert(r.paths.includes("space name\nline.tsx"));
}
{
  const f = fixture("rename");
  f.git("mv", "source.ts", "renamed.ts");
  f.commit();
  assert.equal(check(f, "pure-rename", 0).violations.length, 0);
  write(f.cwd, "renamed.ts", "// retained\nexport const value = 1;\n// newly added\n");
  f.commit();
  assert.equal(check(f, "rename-addition", 1).violations.length, 1);
  f.git("rm", "renamed.ts");
  f.commit();
  assert.equal(check(f, "deleted", 0).outcome, "skipped");
}
{
  const f = fixture("exceptions");
  write(f.cwd, "directive.ts", "// @ts-check\nexport {};\n");
  write(
    f.cwd,
    exceptions,
    JSON.stringify([
      { file: "directive.ts", text: "// @ts-check", reason: "compiler directive" },
      { file: "other.ts", text: "/*! licence */", reason: "retained approved notice" },
    ]),
  );
  f.commit();
  assert.equal(check(f, "exact-exception", 0).allowed.length, 1);
  write(f.cwd, "directive.ts", "// @ts-check\n// explanation\nexport {};\n");
  f.commit();
  assert.equal(check(f, "exception-not-file-wide", 1).violations.length, 1);
  write(f.cwd, exceptions, '[{"file":"directive.ts","text":"// @ts-check","reason":""}]');
  f.commit();
  check(f, "bad-exception", 2);
}
{
  const f = fixture("invalid");
  write(f.cwd, "docs.md", "docs\n");
  const head = f.commit();
  check(f, "zero-base", 2, "push", "0".repeat(40));
  check(f, "missing-base", 2, "push", "f".repeat(40));
  check(f, "wrong-head", 2, "push", f.base, f.base);
  check(f, "unknown-event", 2, "release");
  write(f.cwd, "source.ts", "export const bad = (\n");
  check(f, "dirty-tree", 2);
  f.commit();
  check(f, "syntax-error", 2);
  f.git("checkout", "--orphan", "unrelated");
  f.git("rm", "-rf", ".");
  write(f.cwd, exceptions, "[]\n");
  write(f.cwd, "unrelated.ts", "export {};\n");
  f.commit();
  check(f, "unrelated-push", 2, "push", head);
}
{
  const f = fixture("stdout-only");
  write(f.cwd, "source.ts", "// retained\n// stdout violation\nexport const value = 1;\n");
  const head = f.commit();
  const args = [command, "--event", "push", "--base", f.base, "--head", head];
  const r = spawnSync(process.execPath, args, { cwd: f.cwd, encoding: "utf8", timeout: 30000 });
  results.push({
    name: "stdout-only",
    args,
    cwd: f.cwd,
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
  });
  writeFileSync(resolve(output, "summary.json"), JSON.stringify({ results }, null, 2));
  assert.equal(r.status, 1, r.stderr);
  const printed = JSON.parse(r.stdout);
  assert.equal(printed.exitCode, 1);
  assert.equal(printed.violations.length, 1);
  assert.equal(f.git("status", "--porcelain"), "");
}
console.log(`${results.length} CI adapter cases passed; evidence: ${output}`);
