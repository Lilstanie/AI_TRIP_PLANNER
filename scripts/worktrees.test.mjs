import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("./worktrees.mjs", import.meta.url));
const MARKER = ".codex-worktree-name";

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

function write(path, text = "x\n") {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function identity(repo) {
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
}

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "worktrees-"));
  const remote = join(base, "remote.git");
  const repo = join(base, "repo");
  const scan = join(base, "scan");
  const trash = join(base, "trash");
  git(base, "init", "-q", "--bare", "-b", "main", remote);
  git(base, "clone", "-q", remote, repo);
  identity(repo);
  write(join(repo, "src.txt"));
  write(join(repo, "apps/web/.turbo/keep.txt"));
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  git(repo, "push", "-q", "origin", "HEAD:main");
  mkdirSync(scan);
  const worktree = (name, ...extra) => {
    const path = join(scan, name, "AI");
    mkdirSync(join(scan, name));
    write(join(scan, name, MARKER), name);
    git(repo, "worktree", "add", "-q", ...extra, path);
    identity(path);
    return path;
  };
  return { base, remote, repo, scan, trash, worktree };
}

function run(cwd, args) {
  return spawnSync("node", [cli, ...args], { cwd, encoding: "utf8" });
}

test("usage errors exit 2 and a directory outside Git exits 1", () => {
  const { repo, base } = fixture();
  for (const args of [["--bogus"], ["--root"], ["--trash", "--apply"]]) {
    assert.equal(run(repo, args).status, 2, args.join(" "));
  }
  const outside = mkdtempSync(join(tmpdir(), "worktrees-outside-"));
  assert.equal(run(outside, []).status, 1);
  assert.ok(existsSync(base));
});

test("dry run moves nothing; --apply moves only safe entries to the Trash", () => {
  const { remote, repo, scan, trash, worktree, base } = fixture();
  const clean = worktree("clean", "-b", "feat-clean");
  const modified = worktree("modified", "-b", "feat-modified");
  write(join(modified, "src.txt"), "changed\n");
  write(join(modified, "apps/web/.next/cache/a.bin"));
  const staged = worktree("staged", "-b", "feat-staged");
  write(join(staged, "new.txt"));
  git(staged, "add", "new.txt");
  const untracked = worktree("untracked", "-b", "feat-untracked");
  write(join(untracked, "loose.txt"));
  const lost = worktree("lost", "--detach");
  write(join(lost, "src.txt"), "lost\n");
  git(lost, "commit", "-qam", "unreachable");
  const detachedOk = worktree("detached-ok", "--detach");
  const locked = worktree("locked", "-b", "feat-locked");
  git(repo, "worktree", "lock", locked);
  const gone = worktree("gone", "-b", "feat-gone");
  rmSync(gone, { recursive: true });
  for (let index = 0; index < 7; index += 1) write(join(scan, `husk-${index}`, MARKER));
  write(join(scan, "husk-plus", MARKER));
  write(join(scan, "husk-plus", "notes.txt"));
  const cloneOk = join(scan, "clone-ok");
  git(base, "clone", "-q", remote, cloneOk);
  const cloneUnpushed = join(scan, "nested", "clone-unpushed");
  mkdirSync(join(scan, "nested"));
  git(base, "clone", "-q", remote, cloneUnpushed);
  identity(cloneUnpushed);
  write(join(cloneUnpushed, "src.txt"), "local\n");
  git(cloneUnpushed, "commit", "-qam", "local only");
  const otherRemote = join(base, "other.git");
  git(base, "init", "-q", "--bare", "-b", "main", otherRemote);
  const cloneOther = join(scan, "clone-other");
  git(base, "clone", "-q", otherRemote, cloneOther);
  write(join(repo, ".next/cache/b.bin"));
  write(join(trash, "clean", "older.txt"));

  const args = ["--root", scan, "--trash", trash];
  const dry = run(repo, args);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /dry run/);
  assert.match(dry.stdout, /clean worktrees: 2/);
  assert.match(dry.stdout, /marker-only directories: 7/);
  assert.match(dry.stdout, /… and 2 more/);
  assert.match(dry.stdout, /worktrees holding work: 3/);
  assert.match(dry.stdout, /registry entries without a directory: 1/);
  assert.doesNotMatch(dry.stdout, /a\.bin|cache/);
  assert.ok(existsSync(clean) && existsSync(join(scan, "husk-0")) && existsSync(cloneOk));
  assert.match(git(repo, "worktree", "list"), /gone/);

  const applied = run(repo, [...args, "--apply"]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /no branch was deleted/);

  for (const path of [
    join(scan, "clean"),
    join(scan, "detached-ok"),
    join(scan, "husk-0"),
    cloneOk,
  ]) {
    assert.equal(existsSync(path), false, `${path} should be in the Trash`);
  }
  assert.equal(existsSync(join(modified, "apps/web/.next")), false);
  for (const path of [modified, staged, untracked, lost, locked, cloneUnpushed, cloneOther]) {
    assert.ok(existsSync(path), `${path} should be kept`);
  }
  assert.ok(existsSync(join(modified, "apps/web/.turbo/keep.txt")));
  assert.ok(existsSync(join(scan, "husk-plus", "notes.txt")));
  assert.ok(existsSync(join(repo, ".next/cache/b.bin")));
  assert.ok(existsSync(join(trash, "clean", "older.txt")));
  const trashed = readdirSync(trash);
  assert.ok(
    trashed.some((name) => name.startsWith("clean ")),
    trashed.join(", "),
  );
  assert.ok(trashed.includes("clone-ok") && trashed.includes("husk-6"));

  const list = git(repo, "worktree", "list");
  assert.doesNotMatch(list, /scan\/clean|gone|detached-ok/);
  for (const branch of ["feat-clean", "feat-gone", "feat-modified"]) {
    assert.equal(git(repo, "branch", "--list", "--format=%(refname:short)", branch), branch);
  }
});

test("the worktree the command runs from is kept", () => {
  const { scan, trash, worktree } = fixture();
  const self = worktree("self", "-b", "feat-self");
  const result = run(self, ["--root", scan, "--trash", trash, "--apply"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /the worktree this command runs from: 1/);
  assert.ok(existsSync(self));
});
