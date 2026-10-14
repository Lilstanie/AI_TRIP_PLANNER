import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

try {
  const options = {};
  const allowed = new Set(["--repo", "--output", "--event", "--base", "--head"]);
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!allowed.has(key)) throw new Error(`Unknown argument: ${key}`);
    if (Object.hasOwn(options, key.slice(2))) throw new Error(`Duplicate option: ${key}`);
    if (args[index + 1] === undefined) throw new Error(`Missing option value: ${key}`);
    options[key.slice(2)] = args[index + 1];
  }
  if (!options.output) throw new Error("Missing required --output option");
  const root = resolve(options.repo ?? resolve(import.meta.dirname, "../../../.."));
  let entries;
  try {
    entries = readdirSync(resolve(root, "apps/web/tests/cli-e2e"), { withFileTypes: true });
  } catch (error) {
    throw new Error(`Invalid acceptance inventory: ${error.message}`);
  }
  const scripts = entries.filter(
    (entry) => entry.name.endsWith(".e2e.mjs") || entry.name === "report-cli.mjs",
  );
  if (
    !scripts.length ||
    scripts.some(
      (entry) => !entry.isFile() || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.mjs$/.test(entry.name),
    )
  )
    throw new Error(
      "Invalid acceptance inventory: expected nonempty regular files with safe basenames",
    );
  const discoveredScripts = scripts.map((entry) => entry.name).sort();
  const featureScripts = new Set([
    "discovery.e2e.mjs",
    "legacy-runner.e2e.mjs",
    "local-cleanup.e2e.mjs",
    "local-cli-collections.e2e.mjs",
    "local-test-cli-repeat.e2e.mjs",
    "local-test-cli.e2e.mjs",
    "report-cli.mjs",
    "report-interrupted.e2e.mjs",
    "review-comment-policy.e2e.mjs",
    "skill-maintenance.e2e.mjs",
    "translation-pairs.e2e.mjs",
  ]);
  const knownScripts = new Set([
    ...featureScripts,
    "selection.e2e.mjs",
    "runner-plan.e2e.mjs",
    "ci-integration.e2e.mjs",
  ]);
  const unclassified = discoveredScripts.filter((script) => !knownScripts.has(script));
  const missing = [...featureScripts].filter((script) => !discoveredScripts.includes(script));
  const inventoryReason =
    unclassified.length || missing.length
      ? `Inventory drift requires complete coverage; unclassified: ${unclassified.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}`
      : null;
  const changes = new Map();
  let comparisonFailure = null;
  try {
    if (
      !options.base ||
      !options.head ||
      options.base.startsWith("-") ||
      options.head.startsWith("-")
    )
      throw new Error("Missing or invalid explicit revisions");
    const git = (...args) => {
      const result = spawnSync("git", args, {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 16 * 1024 * 1024,
      });
      if (result.status !== 0)
        throw new Error(`Git ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`);
      return result.stdout;
    };
    if (git("rev-parse", "--is-shallow-repository").trim() !== "false")
      throw new Error("Shallow Git history requires complete coverage");
    const baseCommit = git(
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${options.base}^{commit}`,
    ).trim();
    const headCommit = git(
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${options.head}^{commit}`,
    ).trim();
    const mergeBase = git("merge-base", baseCommit, headCommit).trim();
    const comparison = git(
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      "--find-copies-harder",
      mergeBase,
      headCommit,
      "--",
    );
    const fields = comparison.split("\0");
    if (fields.pop() !== "") throw new Error("Invalid Git comparison terminator");
    while (fields.length) {
      const status = fields.shift();
      if (!/^(?:[AMDT]|[RC]\d+)$/.test(status))
        throw new Error(`Unknown Git comparison status: ${status}`);
      const count = /^[RC]\d+$/.test(status) ? 2 : 1;
      for (let index = 0; index < count; index++) {
        const path = fields.shift();
        if (
          !path ||
          path.startsWith("/") ||
          path.split("/").some((part) => part === ".." || part === ".")
        )
          throw new Error("Invalid Git comparison path");
        changes.set(path, status);
      }
    }
  } catch (error) {
    comparisonFailure = `Revision comparison unavailable: ${error.message}`;
    changes.clear();
  }
  const changedFiles = [...changes.keys()].sort();
  const matchedRules = changedFiles.map((path) => {
    if (path === "apps/web/tests/e2e/report-cli.mjs")
      return {
        path,
        rule: "report-reader",
        scripts: ["report-cli.mjs", "report-interrupted.e2e.mjs"],
      };
    if (path.startsWith(".agents/skills/skill-maintenance/scripts/"))
      return { path, rule: "skill-maintenance", scripts: ["skill-maintenance.e2e.mjs"] };
    if (path.startsWith(".agents/skills/translate-docs/scripts/"))
      return { path, rule: "translation-pairs", scripts: ["translation-pairs.e2e.mjs"] };
    if (path === "apps/web/tests/e2e/legacy-runner.mjs")
      return {
        path,
        rule: "legacy-runner",
        scripts: ["legacy-runner.e2e.mjs", "local-test-cli.e2e.mjs"],
      };
    if (path === ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs")
      return { path, rule: "added-comment-checker", scripts: ["review-comment-policy.e2e.mjs"] };
    if (
      path.startsWith("apps/web/tests/cli-e2e/") &&
      featureScripts.has(path.slice("apps/web/tests/cli-e2e/".length)) &&
      changes.get(path) === "M"
    )
      return {
        path,
        rule: "acceptance-script",
        scripts: [path.slice("apps/web/tests/cli-e2e/".length)],
      };
    if (
      !/(^|\/)(AGENTS|CLAUDE)\.md$/i.test(path) &&
      ((path.startsWith("docs/") && path.endsWith(".md")) ||
        /^README(?:\.[a-z-]+)?\.md$/.test(path) ||
        /^\.agents\/session-logs\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/.test(path) ||
        path === ".agents/translation-pairs.json")
    )
      return { path, rule: "ordinary-documentation", scripts: [] };
    return { path, rule: "shared-or-unknown", scripts: discoveredScripts };
  });
  const eventReason =
    options.event === "push"
      ? "Push events always require complete coverage"
      : options.event !== "pull_request"
        ? `Unsupported event: ${options.event ?? "missing"}; complete coverage required`
        : null;
  const fullReason =
    [eventReason, inventoryReason, comparisonFailure].filter(Boolean).join("; ") ||
    (matchedRules.some((rule) => rule.rule === "shared-or-unknown")
      ? "Shared infrastructure or unknown paths require complete coverage"
      : null);
  const full = Boolean(fullReason);
  const selectedScripts = full
    ? discoveredScripts
    : [...new Set(matchedRules.flatMap((rule) => rule.scripts))].sort();
  const baseline = {
    source:
      "https://github.com/Lilstanie/AI_TRIP_PLANNER/actions/runs/38216568999/job/114702587834",
    durationMs: {
      "discovery.e2e.mjs": 2180,
      "legacy-runner.e2e.mjs": 43615,
      "local-cleanup.e2e.mjs": 100281,
      "local-cli-collections.e2e.mjs": 300408,
      "local-test-cli-repeat.e2e.mjs": 92128,
      "local-test-cli.e2e.mjs": 125431,
      "report-cli.mjs": 23794,
      "report-interrupted.e2e.mjs": 226,
      "review-comment-policy.e2e.mjs": 6739,
      "skill-maintenance.e2e.mjs": 8413,
      "translation-pairs.e2e.mjs": 1500,
    },
  };
  const estimate = (script) => baseline.durationMs[script] ?? 60000;
  const shards = Array.from({ length: Math.min(3, selectedScripts.length) }, (_, index) => ({
    id: String(index + 1),
    scripts: [],
  }));
  const loads = shards.map(() => 0);
  const ordered = [...selectedScripts].sort(
    (a, b) => estimate(b) - estimate(a) || (a < b ? -1 : a > b ? 1 : 0),
  );
  for (const script of ordered) {
    const index = loads.indexOf(Math.min(...loads));
    shards[index].scripts.push(script);
    loads[index] += estimate(script);
  }
  for (const shard of shards) shard.scripts.sort();
  const plan = {
    schemaVersion: 1,
    mode: full ? "full" : selectedScripts.length ? "selected" : "skip",
    reason:
      fullReason ??
      (selectedScripts.length
        ? "Matched reviewed dependency rules"
        : changedFiles.length
          ? "Only ordinary documentation changed"
          : "No changed paths in verified comparison"),
    base: options.base ?? null,
    head: options.head ?? null,
    changedFiles,
    matchedRules,
    discoveredScripts,
    selectedScripts,
    shards,
  };
  mkdirSync(dirname(resolve(options.output)), { recursive: true });
  writeFileSync(resolve(options.output), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`CLI acceptance ${plan.mode}: ${plan.reason}`);
  console.log(
    `Shard estimates: ${loads.join(", ")} ms; baseline ${baseline.source}; unmeasured scripts default to 60000 ms`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
