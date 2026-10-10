#!/usr/bin/env node

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
