import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("./check-file-length.mjs", import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
}

function write(repo, file, lines, trailingNewline = true) {
  mkdirSync(join(repo, file, ".."), { recursive: true });
  const body = Array.from({ length: lines }, (_, i) => `l${i}`).join("\n");
  writeFileSync(join(repo, file), trailingNewline ? `${body}\n` : body);
}

function fixture() {
  const repo = mkdtempSync(join(tmpdir(), "file-length-"));
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  write(repo, "old-big.ts", 20);
  write(repo, "moved.ts", 20);
  write(repo, "gone.ts", 20);
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  git(repo, "branch", "base");
  return repo;
}

const run = (repo, ...args) =>
  spawnSync(process.execPath, [cli, "--base", "base", "--max", "10", ...args], {
    cwd: repo,
    encoding: "utf8",
  });

test("usage errors exit 2", () => {
  const repo = fixture();
  assert.equal(run(repo, "--bogus").status, 2);
  assert.equal(run(repo, "--max").status, 2);
  assert.equal(run(repo, "--max", "0").status, 2);
  assert.equal(run(repo, "--max", "ten").status, 2);
  rmSync(repo, { recursive: true, force: true });
});

test("an unresolvable base exits 2", () => {
  const repo = fixture();
  const result = spawnSync(process.execPath, [cli, "--base", "nope"], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not resolve/);
  rmSync(repo, { recursive: true, force: true });
});

test("flags changed, staged and untracked source over the limit, nothing else", () => {
  const repo = fixture();
  write(repo, "src/committed.tsx", 11);
  write(repo, "src/at-limit.ts", 10);
  write(repo, "src/no-newline.css", 11, false);
  write(repo, "docs/long.md", 50);
  write(repo, "data.json", 50);
  write(repo, "apps/web/next-env.d.ts", 50);
  write(repo, "pnpm-lock.yaml", 50);
  rmSync(join(repo, "gone.ts"));
  renameSync(join(repo, "moved.ts"), join(repo, "renamed.ts"));
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "change");
  write(repo, "src/staged.mjs", 12);
  git(repo, "add", "src/staged.mjs");
  write(repo, "src/untracked.ts", 13);
  const result = run(repo);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(
    result.stdout.split("\n").filter((line) => line.includes("lines (limit")),
    [
      "renamed.ts: 20 lines (limit 10)",
      "src/committed.tsx: 11 lines (limit 10)",
      "src/no-newline.css: 11 lines (limit 10)",
      "src/staged.mjs: 12 lines (limit 10)",
      "src/untracked.ts: 13 lines (limit 10)",
    ],
  );
  assert.doesNotMatch(
    result.stdout,
    /old-big|at-limit|long\.md|data\.json|next-env|pnpm-lock|gone/,
  );
  rmSync(repo, { recursive: true, force: true });
});

test("passes when no changed source file is over the limit", () => {
  const repo = fixture();
  write(repo, "small.ts", 5);
  const result = run(repo);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  rmSync(repo, { recursive: true, force: true });
});
