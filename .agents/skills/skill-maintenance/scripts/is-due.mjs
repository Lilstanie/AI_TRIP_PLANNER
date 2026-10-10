#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const json = args.includes("--json");
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} needs a positive integer`);
  return value;
};

const thresholds = {
  mergedPRs: option("prs", 8),
  closedIssues: option("issues", 5),
  unmergedPRs: option("unmerged", 2),
  conventionChanges: option("conventions", 1),
  noteChanges: option("notes", 2),
};

const CONVENTION_PATHS = [
  "AGENTS.md",
  "docs/development.md",
  "docs/team-workflow.md",
  "docs/AGENTS.md",
  ".github/workflows",
  ".github/pull_request_template.md",
  "scripts/verify-docs.mjs",
  "scripts/verify-protected-files.mjs",
  "scripts/skill-rules.mjs",
  "package.json",
  "turbo.json",
  "tsconfig.base.json",
  ".prettierrc.json",
  ".agents/session-logs/TEMPLATE.md",
  ".agents/notes/README.md",
];
const NOTE_PATHS = [
  ".agents/notes/implemented",
  ".agents/notes/archived",
  ".agents/notes/rejected",
];

const root = resolve(process.cwd());
const git = (...gitArgs) =>
  execFileSync("git", gitArgs, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const baselineLine = git(
  "log",
  "-1",
  "--first-parent",
  "--format=%H%x09%cI",
  "--",
  ".agents/skills",
);
if (!baselineLine) throw new Error("No commit has touched .agents/skills on this branch");
const [baseline, baselineDate] = baselineLine.split("\t");

const [firstParent, ...mergedParents] = git("rev-list", "--parents", "-n", "1", baseline)
  .split(" ")
  .slice(1);
const baselineRange = mergedParents.length ? [`${firstParent}..${baseline}`] : ["-1", baseline];
const absorbedIssues = new Set(
  [...git("log", "--format=%B", ...baselineRange).matchAll(/#(\d+)/g)].map((m) => Number(m[1])),
);

const commits = (...paths) => {
  const out = git(
    "log",
    "--first-parent",
    "--format=%h%x09%s",
    `${baseline}..HEAD`,
    "--",
    ...paths,
  );
  return out ? out.split("\n").map((line) => line.split("\t")) : [];
};
const all = commits(".");
const merged = all.filter(([, subject]) => /\(#\d+\)\s*$|^Merge pull request #\d+ /.test(subject));
const conventions = commits(...CONVENTION_PATHS);
const notes = commits(...NOTE_PATHS);

function getJson(url) {
  const attempt = (token) => {
    const curlArgs = ["-sS", "-w", "\n%{http_code}", "-H", "Accept: application/vnd.github+json"];
    if (token) curlArgs.push("-H", `Authorization: Bearer ${token}`);
    try {
      const out = execFileSync("curl", [...curlArgs, url], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const split = out.lastIndexOf("\n");
      return { status: Number(out.slice(split + 1)), text: out.slice(0, split) };
    } catch (error) {
      return { status: 0, text: String(error.stderr || error.message).trim() };
    }
  };
  let response = attempt(process.env.GITHUB_TOKEN);
  if (process.env.GITHUB_TOKEN && (response.status === 401 || response.status === 403))
    response = attempt();
  if (response.status !== 200) {
    return {
      ok: false,
      reason: response.status
        ? `GitHub answered ${response.status}`
        : `curl failed: ${response.text}`,
    };
  }
  return { ok: true, body: JSON.parse(response.text) };
}

function githubSignals() {
  const slug = git("remote", "get-url", "origin")
    .replace(/\.git$/, "")
    .match(/github\.com[/:]([^/]+\/[^/]+)$/)?.[1];
  if (!slug) return { available: false, reason: "origin is not a github.com repository" };
  const items = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/repos/${slug}/issues?state=closed&since=${encodeURIComponent(baselineDate)}&per_page=100&page=${page}`;
    const result = getJson(url);
    if (!result.ok) return { available: false, reason: result.reason };
    items.push(...result.body);
    if (result.body.length < 100) break;
  }

  const since = Date.parse(baselineDate);
  const closedAfter = items.filter(
    (item) =>
      item.closed_at && Date.parse(item.closed_at) > since && !absorbedIssues.has(item.number),
  );
  return {
    available: true,
    closedIssues: closedAfter
      .filter((item) => !item.pull_request)
      .map((item) => `#${item.number} ${item.title}`),
    unmergedPRs: closedAfter
      .filter((item) => item.pull_request && !item.pull_request.merged_at)
      .map((item) => `#${item.number} ${item.title}`),
  };
}

function driftErrors() {
  try {
    execFileSync("node", [".agents/skills/skill-maintenance/scripts/check-skills.mjs", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [];
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(error.stdout)
      .skills.filter((skill) => skill.missingPaths.length || skill.brokenScripts.length)
      .map((skill) => skill.skill);
  }
}

const github = githubSignals();
const broken = driftErrors();
const signals = {
  mergedPRs: merged.map(([hash, subject]) => `${hash} ${subject}`),
  conventionChanges: conventions.map(([hash, subject]) => `${hash} ${subject}`),
  noteChanges: notes.map(([hash, subject]) => `${hash} ${subject}`),
  closedIssues: github.available ? github.closedIssues : null,
  unmergedPRs: github.available ? github.unmergedPRs : null,
};
const reasons = Object.entries(thresholds)
  .filter(([name, limit]) => signals[name] && signals[name].length >= limit)
  .map(([name, limit]) => `${name}: ${signals[name].length} (threshold ${limit})`);
if (broken.length) reasons.push(`skills with broken paths or commands: ${broken.join(", ")}`);
const due = reasons.length > 0;

if (json) {
  process.stdout.write(
    `${JSON.stringify({ due, reasons, baseline: { commit: baseline.slice(0, 7), date: baselineDate }, thresholds, signals, github: github.available ? "ok" : github.reason }, null, 2)}\n`,
  );
} else {
  console.log(`Skills last changed in ${baseline.slice(0, 7)} (${baselineDate}).`);
  for (const [name, limit] of Object.entries(thresholds)) {
    const value = signals[name];
    console.log(`  ${name.padEnd(18)} ${value === null ? "unavailable" : value.length} / ${limit}`);
  }
  if (!github.available) console.log(`  GitHub signals unavailable: ${github.reason}`);
  if (broken.length) console.log(`  broken skills      ${broken.join(", ")}`);
  console.log(due ? `Review due: ${reasons.join("; ")}` : "No review due.");
}

process.exitCode = due ? 10 : 0;
