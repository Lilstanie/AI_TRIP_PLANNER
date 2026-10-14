#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["output", "apps/web/output", "tmp", ".scratch"];
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

if (args.some((arg) => arg !== "--dry-run")) {
  console.error("Usage: node scripts/clean-output.mjs [--dry-run]");
  process.exit(2);
}

const sizeOf = (path) => {
  const stat = lstatSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((sum, name) => sum + sizeOf(join(path, name)), 0);
};

const format = (bytes) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

let tracked;
try {
  tracked = execFileSync("git", ["ls-files", "-z", "--", ...targets], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
} catch {
  console.error("Cannot list tracked files, so nothing was deleted.");
  process.exit(1);
}

if (tracked.length > 0) {
  console.error(
    `Refusing to delete: tracked files live under the targets, for example ${tracked[0]}.`,
  );
  process.exit(1);
}

let failed = false;
for (const target of targets) {
  const path = join(root, target);
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    console.log(`${target}: not present`);
    continue;
  }
  const label = stat.isSymbolicLink() ? "symlink" : format(sizeOf(path));
  if (dryRun) {
    console.log(`${target}: ${label} (dry run, kept)`);
    continue;
  }
  try {
    rmSync(path, { recursive: true, force: true });
    console.log(`${target}: removed ${label}`);
  } catch (error) {
    failed = true;
    console.error(`${target}: could not remove (${error.message})`);
  }
}

process.exit(failed ? 1 : 0);
