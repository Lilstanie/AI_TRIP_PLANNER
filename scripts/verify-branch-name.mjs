#!/usr/bin/env node
// Fails when a pull request's head branch breaks the branch-name rule in AGENTS.md:
// - the name must start with feature/, fix/, refactor/, docs/, chore/ or test/;
// - the name must not contain an AI tool name, even when a harness assigned the branch.
// Dependabot branches are exempt. Pushes to main never reach this check (CI runs it on pull requests).
// Usage: node scripts/verify-branch-name.mjs <branch>
const PREFIXES = ["feature/", "fix/", "refactor/", "docs/", "chore/", "test/"];
const AI_TOOL_NAMES = ["claude", "codex", "copilot", "cursor", "gemini", "chatgpt", "openai"];

export function branchNameProblems(branch) {
  if (branch.startsWith("dependabot/")) return [];
  const problems = [];
  if (!PREFIXES.some((prefix) => branch.startsWith(prefix))) {
    problems.push(`must start with one of ${PREFIXES.join(", ")}`);
  }
  const lower = branch.toLowerCase();
  const tool = AI_TOOL_NAMES.find((name) => lower.includes(name));
  if (tool) problems.push(`must not contain the AI tool name "${tool}"`);
  return problems;
}

const branch = process.argv[2];
if (!branch) {
  console.error("Usage: node scripts/verify-branch-name.mjs <branch>");
  process.exit(2);
}

const problems = branchNameProblems(branch);
if (problems.length > 0) {
  console.error(`Branch "${branch}" breaks the branch-name rule:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("");
  console.error("AGENTS.md applies this rule even when a tool or harness assigns a branch.");
  console.error(
    "To fix: branch from origin/main with a proper name, push it, and close this pull request:",
  );
  console.error("  git checkout -b feature/<short-name> origin/main");
  console.error("  git push -u origin feature/<short-name>");
  process.exit(1);
}
console.log(`Branch "${branch}" follows the branch-name rule.`);
