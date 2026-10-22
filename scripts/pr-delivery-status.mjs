#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
}

function json(command, args) {
  const output = run(command, args);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${command} returned invalid JSON`);
  }
}

function section(body, title) {
  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)];
  const matches = headings.filter((match) => match[1].trim().toLowerCase() === title.toLowerCase());
  if (matches.length !== 1) return "";
  const heading = matches[0];
  const start = heading.index + heading[0].length;
  const next = headings.find((match) => match.index > heading.index);
  return body.slice(start, next?.index ?? body.length).trim();
}

function requireContent(name, value) {
  if (!value) throw new Error(`PR ${name} section is empty`);
}

function workflowRunId(check) {
  try {
    return new URL(check.link).pathname.match(/\/actions\/runs\/(\d+)(?:\/|$)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function main() {
  const [number, ...extra] = process.argv.slice(2);
  if (!number || extra.length || !/^\d+$/.test(number)) {
    throw new Error("Usage: node scripts/pr-delivery-status.mjs <pull-request-number>");
  }

  const branch = run("git", ["branch", "--show-current"]);
  if (!branch) throw new Error("Checkout is detached; switch to the PR branch");
  const status = run("git", ["status", "--porcelain", "--untracked-files=normal"]);
  if (status) throw new Error("Checkout is dirty; commit or remove local changes before preflight");
  const head = run("git", ["rev-parse", "HEAD"]);
  const pr = json("gh", [
    "pr",
    "view",
    number,
    "--json",
    "number,state,headRefName,headRefOid,baseRefName,body",
  ]);

  if (String(pr.number) !== number)
    throw new Error(`GitHub returned PR ${pr.number}, expected ${number}`);
  if (pr.state !== "OPEN") throw new Error(`PR must be open; current state is ${pr.state}`);
  if (pr.baseRefName !== "main")
    throw new Error(`PR base must be main; current base is ${pr.baseRefName}`);
  if (pr.headRefName !== branch)
    throw new Error(`Local branch ${branch} does not match PR branch ${pr.headRefName}`);
  if (pr.headRefOid !== head)
    throw new Error(`Local HEAD ${head} differs from PR head ${pr.headRefOid}`);

  const summary = section(pr.body ?? "", "Summary");
  const evidence = section(pr.body ?? "", "Evidence");
  const danger = section(pr.body ?? "", "Merge Danger");
  requireContent("Summary", summary);
  requireContent("Evidence", evidence);
  requireContent("Merge Danger", danger);

  const checks = json("gh", ["pr", "checks", number, "--json", "name,state,workflow,link"]);
  if (!Array.isArray(checks) || checks.length === 0)
    throw new Error("GitHub returned no PR checks");

  const skipped = checks.filter((check) => check.state === "SKIPPED");
  const approvedWorkerSkips = skipped.filter(
    (check) =>
      check.workflow === "CI" && /^cli-acceptance-workers(?:\s+\([^)]+\))?$/.test(check.name),
  );
  const workerRunIds = new Set(approvedWorkerSkips.map(workflowRunId));
  const hasSuccessfulCiJob = (name, runId) =>
    checks.some(
      (check) =>
        check.workflow === "CI" &&
        check.name === name &&
        check.state === "SUCCESS" &&
        workflowRunId(check) === runId,
    );
  if (approvedWorkerSkips.length !== skipped.length) {
    const states = skipped.map(({ name, state }) => `${name}: ${state}`).join(", ");
    throw new Error(`Unexplained skipped checks: ${states}`);
  }
  if (
    approvedWorkerSkips.length > 0 &&
    (workerRunIds.size !== 1 ||
      workerRunIds.has("") ||
      !hasSuccessfulCiJob("cli-acceptance-plan", [...workerRunIds][0]) ||
      !hasSuccessfulCiJob("cli-acceptance", [...workerRunIds][0]))
  ) {
    throw new Error(
      "Skipped CLI workers require successful CI cli-acceptance-plan and cli-acceptance checks from the same CI run",
    );
  }

  const incomplete = checks.filter(
    (check) => check.state !== "SUCCESS" && !approvedWorkerSkips.includes(check),
  );
  if (incomplete.length) {
    const states = incomplete.map(({ name, state }) => `${name}: ${state}`).join(", ");
    throw new Error(`Every current-head check must be SUCCESS; incomplete checks: ${states}`);
  }

  const latestPr = json("gh", [
    "pr",
    "view",
    number,
    "--json",
    "number,state,headRefName,headRefOid,baseRefName,body",
  ]);
  if (
    latestPr.state !== pr.state ||
    latestPr.headRefName !== pr.headRefName ||
    latestPr.headRefOid !== pr.headRefOid ||
    latestPr.baseRefName !== pr.baseRefName ||
    latestPr.body !== pr.body
  ) {
    throw new Error("PR changed during preflight; rerun against its latest head and body");
  }

  process.stdout.write(`PR #${number} delivery preflight passed\n`);
  process.stdout.write(
    `Branch: ${branch}\nHead: ${head}\nChecks: ${checks.length - approvedWorkerSkips.length} SUCCESS, ${approvedWorkerSkips.length} approved CLI worker SKIPPED\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`PR delivery preflight failed: ${error.message}\n`);
  process.exitCode = 1;
}
