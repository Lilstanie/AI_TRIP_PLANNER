#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

const usage =
  "usage: node scripts/worktrees.mjs [--apply] [--sizes] [--worktree <path>]... [--idle-hours <n>] [--root <dir>]... [--trash <dir>]";
const MARKER = ".codex-worktree-name";
const IGNORABLE = new Set([MARKER, ".DS_Store"]);
const BUILD_DIRS = [".next", ".turbo", "apps/web/.next", "apps/web/.turbo"];
const LIST_LIMIT = 5;

const args = process.argv.slice(2);
let apply = false;
let sizes = false;
let trashOption;
let idleHours = 24;
const rootOptions = [];
const targetOptions = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--apply") apply = true;
  else if (arg === "--sizes") sizes = true;
  else if (["--root", "--trash", "--worktree", "--idle-hours"].includes(arg)) {
    const value = args[index + 1];
    const hours = Number(value);
    if (!value || value.startsWith("--") || (arg === "--idle-hours" && !(hours >= 0))) {
      console.error(usage);
      process.exit(2);
    }
    index += 1;
    if (arg === "--root") rootOptions.push(resolve(value));
    else if (arg === "--worktree") targetOptions.push(resolve(value));
    else if (arg === "--idle-hours") idleHours = hours;
    else trashOption = resolve(value);
  } else {
    console.error(usage);
    process.exit(2);
  }
}

const git = (cwd, ...gitArgs) => {
  const result = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim() };
};
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};
const isDirectory = (path) => {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
};
const exists = (path) => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};
const inside = (child, parent) => {
  const path = relative(parent, child);
  return path !== "" && !path.startsWith(`..${sep}`) && path !== "..";
};

const top = git(process.cwd(), "rev-parse", "--show-toplevel");
if (!top.ok) {
  console.error("Not inside a Git repository, so nothing was moved.");
  process.exit(1);
}
const current = real(top.out);

const entries = [];
for (const block of git(current, "worktree", "list", "--porcelain").out.split(/\n\n+/)) {
  const entry = {};
  for (const line of block.split("\n")) {
    const [key, ...rest] = line.split(" ");
    entry[key] = rest.length ? rest.join(" ") : true;
  }
  if (entry.worktree) entries.push(entry);
}
const [mainEntry, ...linked] = entries;
const registered = new Set(entries.map((entry) => real(entry.worktree)));
const origin = git(current, "remote", "get-url", "origin");
const targets = new Set(targetOptions.map(real));
const scoped = targets.size > 0;
const idleLabel = `used in the last ${idleHours} h`;

const defaultRoot = join(homedir(), ".codex", "worktrees");
const roots = scoped
  ? []
  : (rootOptions.length ? rootOptions : existsSync(defaultRoot) ? [defaultRoot] : []).map(real);
const trashDir =
  trashOption ??
  (platform() === "darwin"
    ? join(homedir(), ".Trash")
    : join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "Trash", "files"));

const moves = [];
const kept = [];
let pruneEntries = 0;
const move = (category, path, detail = "") => moves.push({ category, path, detail });
const keep = (category, path, detail = "") => kept.push({ category, path, detail });

const recentlyUsed = (path) => {
  if (scoped) return false;
  const gitDir = git(path, "rev-parse", "--absolute-git-dir");
  if (!gitDir.ok) return false;
  const times = ["index", "HEAD", join("logs", "HEAD")].map((name) => {
    try {
      return statSync(join(gitDir.out, name)).mtimeMs;
    } catch {
      return 0;
    }
  });
  return Date.now() - Math.max(...times) < idleHours * 3600 * 1000;
};
const status = (path) => git(path, "--no-optional-locks", "status", "--porcelain=v1");
const reachable = (cwd, rev) =>
  git(cwd, "for-each-ref", "--contains", rev, "--count=1", "refs/heads", "refs/remotes").out !== "";
const onlyMarker = (path) => {
  const names = readdirSync(path);
  return names.includes(MARKER) && names.every((name) => IGNORABLE.has(name));
};
const huskParent = (path) => {
  const parent = dirname(path);
  const names = readdirSync(parent).filter((name) => !IGNORABLE.has(name));
  return names.length === 1 && names[0] === basename(path) && exists(join(parent, MARKER))
    ? parent
    : undefined;
};
const buildOutput = (worktree) => {
  for (const dir of BUILD_DIRS) {
    const path = join(worktree, dir);
    if (!isDirectory(path)) continue;
    if (git(worktree, "ls-files", "--", dir).out !== "") continue;
    move("build output in kept worktrees", path);
  }
};

for (const target of targets) {
  if (!linked.some((entry) => real(entry.worktree) === target)) {
    keep("named paths that are not linked worktrees of this repository", target);
  }
}

for (const entry of linked) {
  const path = real(entry.worktree);
  if (scoped && !targets.has(path)) continue;
  const label = entry.branch ? entry.branch.replace(/^refs\/heads\//, "") : "detached";
  if (entry.prunable || !existsSync(entry.worktree)) {
    pruneEntries += 1;
    continue;
  }
  if (entry.locked) {
    keep("locked worktrees", path, label);
    continue;
  }
  if (path === current) {
    keep("the worktree this command runs from", path, label);
    continue;
  }
  if (recentlyUsed(path)) {
    keep(`worktrees ${idleLabel}`, path, label);
    continue;
  }
  const state = status(path);
  if (!state.ok) {
    keep("worktrees Git cannot read", path, label);
    continue;
  }
  const changes = state.out ? state.out.split("\n").length : 0;
  if (changes > 0) {
    keep("worktrees holding work", path, `${label}, ${changes} changed paths`);
    buildOutput(path);
    continue;
  }
  if (entry.detached && !reachable(path, entry.HEAD)) {
    keep("detached worktrees whose commit is on no branch", path, entry.HEAD.slice(0, 12));
    buildOutput(path);
    continue;
  }
  move("clean worktrees", huskParent(path) ?? path, label);
}

const checkClone = (path) => {
  const url = git(path, "remote", "get-url", "origin");
  if (!origin.ok || !url.ok || url.out !== origin.out) return;
  if (recentlyUsed(path)) return keep(`unregistered clones ${idleLabel}`, path);
  const state = status(path);
  if (!state.ok || state.out) return keep("unregistered clones holding work", path);
  if (git(path, "stash", "list").out) return keep("unregistered clones with a stash", path);
  const unpushed = git(path, "log", "--branches", "--not", "--remotes", "--format=%h", "-1").out;
  if (unpushed || !reachable(path, "HEAD")) {
    return keep("unregistered clones with commits no remote holds", path);
  }
  move("unregistered clones", huskParent(path) ?? path);
};

const scan = (dir, depth) => {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const path = join(dir, item.name);
    const resolved = real(path);
    if (registered.has(resolved)) continue;
    if ([...registered].some((worktree) => inside(worktree, resolved))) {
      if (depth < 2) scan(path, depth + 1);
      continue;
    }
    if (onlyMarker(path)) {
      move("marker-only directories", path);
      continue;
    }
    const dotGit = join(path, ".git");
    if (isDirectory(dotGit)) {
      checkClone(path);
      continue;
    }
    if (exists(dotGit)) {
      if (!git(path, "rev-parse", "--git-dir").ok) keep("orphaned worktree directories", path);
      continue;
    }
    if (depth < 2) scan(path, depth + 1);
  }
};
for (const root of roots) if (isDirectory(root)) scan(root, 1);

const sizeOf = (path) => {
  const result = spawnSync("du", ["-sk", path], { encoding: "utf8" });
  const kb = Number.parseInt(result.stdout ?? "", 10);
  return Number.isFinite(kb) ? kb : 0;
};
const formatKb = (kb) =>
  kb >= 1024 ** 2 ? `${(kb / 1024 ** 2).toFixed(1)} GB` : `${(kb / 1024).toFixed(1)} MB`;

const print = (heading, items) => {
  if (!items.length) return;
  console.log(heading);
  const groups = Map.groupBy(items, (item) => item.category);
  for (const [category, group] of groups) {
    const total = sizes ? group.reduce((sum, item) => sum + (item.kb = sizeOf(item.path)), 0) : 0;
    console.log(`  ${category}: ${group.length}${sizes ? ` (${formatKb(total)})` : ""}`);
    for (const item of group.slice(0, LIST_LIMIT)) {
      const extras = [item.detail, sizes ? formatKb(item.kb) : ""].filter(Boolean).join(", ");
      console.log(`    ${item.path}${extras ? ` (${extras})` : ""}`);
    }
    if (group.length > LIST_LIMIT) console.log(`    … and ${group.length - LIST_LIMIT} more`);
  }
};

console.log(`Repository: ${real(mainEntry.worktree)}`);
console.log(`Scan roots: ${roots.length ? roots.join(", ") : "none"}`);
print(apply ? "Moving to the Trash:" : "Would move to the Trash (dry run; pass --apply):", moves);
if (pruneEntries) {
  console.log(`  registry entries without a directory: ${pruneEntries} (git worktree prune)`);
}
print("Kept:", kept);
if (!moves.length && !pruneEntries) console.log("Nothing to clean.");

if (!apply) process.exit(0);

const trashTarget = (path) => {
  const name = basename(path);
  let target = join(trashDir, name);
  for (let count = 1; exists(target); count += 1) {
    target = join(trashDir, `${name} ${new Date().toISOString().replace(/[:.]/g, "-")} ${count}`);
  }
  return target;
};

let failed = 0;
let moved = 0;
if (moves.length) mkdirSync(trashDir, { recursive: true });
for (const item of moves) {
  try {
    renameSync(item.path, trashTarget(item.path));
    moved += 1;
  } catch (error) {
    failed += 1;
    const reason = error.code === "EXDEV" ? "the Trash is on another file system" : error.message;
    console.error(`Kept ${item.path}: ${reason}.`);
  }
}
if (moved || pruneEntries) git(current, "worktree", "prune");
console.log(`Moved ${moved} to ${trashDir}; no branch was deleted.`);
process.exit(failed ? 1 : 0);
