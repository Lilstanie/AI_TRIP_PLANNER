#!/usr/bin/env node
// Fails when the diff against a base ref breaks a protected-file rule in AGENTS.md:
// - a frozen file is modified, renamed or deleted (it may only be added, or moved unchanged to
//   another frozen path);
// - a shared contract changes without an Agent Note added or updated in the same diff.
// Usage: node scripts/verify-protected-files.mjs [base-ref]   (default: origin/main)
import { execFileSync } from "node:child_process";

const DATED_LOG = String.raw`\d{4}-\d{2}-\d{2}-[^/]+\.md$`;
const FROZEN = [
  /^\.agents\/archive\//,
  // Locations before 2026-09-22; kept so files still there on an old base stay frozen.
  /^docs\/archive\//,
  new RegExp(`^\\.agents/session-logs/${DATED_LOG}`),
  new RegExp(`^docs/session-logs/${DATED_LOG}`),
  /^\.agents\/notes\/(rejected|archived)\//,
];
const CONTRACTS = /^packages\/shared\/src\//;
const DECISION_NOTE = /^\.agents\/notes\/(proposed|implemented)\/[^/]+\/[^/]+\.md$/;
const RETIRED = [
  { pattern: /^docs\/session-logs\//, moved: ".agents/session-logs/" },
  { pattern: /^docs\/archive\//, moved: ".agents/archive/" },
];

const isFrozen = (path) => FROZEN.some((pattern) => pattern.test(path));
const base = process.argv[2] ?? "origin/main";
const output = execFileSync("git", ["diff", "--name-status", "-M", `${base}...HEAD`], {
  encoding: "utf8",
});

const violations = [];
const changes = output
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"));

const contractChanges = changes.filter(([, oldPath, newPath]) =>
  [oldPath, newPath].some((path) => path && CONTRACTS.test(path)),
);
const hasDecisionNote = changes.some(
  ([status, oldPath, newPath]) => status !== "D" && DECISION_NOTE.test(newPath ?? oldPath),
);
if (contractChanges.length > 0 && !hasDecisionNote) {
  for (const [status, oldPath, newPath] of contractChanges) {
    violations.push(`${status}\t${newPath ?? oldPath}  (shared contract: add an Agent Note)`);
  }
}

for (const [status, oldPath, newPath] of changes) {
  const retired = RETIRED.find(({ pattern }) => pattern.test(newPath ?? oldPath));
  if (retired && status !== "D") {
    violations.push(`${status}\t${newPath ?? oldPath}  (this directory moved to ${retired.moved})`);
    continue;
  }
  if (status === "A" || !isFrozen(oldPath)) continue;
  // An unchanged move between frozen locations keeps the content intact.
  if (status === "R100" && isFrozen(newPath)) continue;
  violations.push(`${status}\t${oldPath}${newPath ? ` -> ${newPath}` : ""}`);
}

if (violations.length > 0) {
  console.error(`Protected files changed relative to ${base}:\n${violations.join("\n")}`);
  console.error("See the Protected files section of AGENTS.md.");
  process.exit(1);
}
console.log(`Protected-file rules hold relative to ${base}.`);
