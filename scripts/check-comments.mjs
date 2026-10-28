import { execFileSync, spawnSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const base = git("merge-base", "origin/main", "HEAD");
const head = git("rev-parse", "HEAD");
const result = spawnSync(
  process.execPath,
  [
    ".agents/skills/review-trip-planner/scripts/check-comment-policy-ci.mjs",
    "--event",
    "pull_request",
    "--base",
    base,
    "--head",
    head,
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 2);
