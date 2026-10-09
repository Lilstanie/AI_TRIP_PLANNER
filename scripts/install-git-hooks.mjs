#!/usr/bin/env node
// Points Git at the committed hooks in .githooks/ (`core.hooksPath`), so `git push` runs the changed-files
// format check that CI runs. Called by the root `postinstall`; it never fails an install.
//
// Failure inventory this script was written from:
// - an install outside a Git checkout (a deploy build from a tarball) fails because `git` has no repository;
// - an install in CI rewrites the runner's Git config;
// - a hooks path someone set for another tool is overwritten without a word;
// - a hook file loses its executable bit and Git skips it silently.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const HOOKS = ".githooks";
const git = (...args) =>
  execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

try {
  if (process.env.CI) process.exit(0);
  try {
    git("rev-parse", "--git-dir");
  } catch {
    process.exit(0);
  }
  let current = "";
  try {
    current = git("config", "--get", "core.hooksPath");
  } catch {}
  if (current && current !== HOOKS) {
    console.warn(
      `install-git-hooks: core.hooksPath is "${current}", so ${HOOKS}/pre-push (format check) is not active. ` +
        `Run \`git config core.hooksPath ${HOOKS}\` to use it.`,
    );
    process.exit(0);
  }
  const hook = resolve(ROOT, HOOKS, "pre-push");
  if (existsSync(hook)) chmodSync(hook, 0o755);
  if (current !== HOOKS) git("config", "core.hooksPath", HOOKS);
} catch (error) {
  console.warn(`install-git-hooks: hooks not installed (${error.message}).`);
}
