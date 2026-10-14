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
const NOTE_PATHS = [".agents/notes/implemented", ".agents/notes/archived"];

const root = resolve(process.cwd());
const git = (...gitArgs) =>
  execFileSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();

const CHECKPOINT_PATH = ".agents/skills/skill-maintenance/assets/review-checkpoint.json";
function readCheckpoint() {
  try {
    if (git("rev-parse", "--is-shallow-repository") === "true")
      throw new Error("history is shallow; fetch complete history before accepting a review");
    const recordCommit = git("log", "-1", "--format=%H", "--", CHECKPOINT_PATH);
    if (!recordCommit) throw new Error("no committed completed-full-review checkpoint");
    const record = JSON.parse(git("show", `HEAD:${CHECKPOINT_PATH}`));
    if (record.version !== 1 || !/^[a-f0-9]{40}$/.test(record.reviewedRevision))
      throw new Error("invalid checkpoint version or reviewed revision");
    git("merge-base", "--is-ancestor", record.reviewedRevision, recordCommit);
    git("merge-base", "--is-ancestor", recordCommit, "HEAD");
    const names = (revision) =>
      git("ls-tree", "-r", "--name-only", revision, "--", ".agents/skills")
        .split("\n")
        .map((path) => path.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/)?.[1])
        .filter(Boolean)
        .sort();
    const substantive = (value) =>
      typeof value === "string" && value.trim().length >= 20 && !/^#\d+$/.test(value.trim());
    if (
      !Array.isArray(record.skills) ||
      !record.skills.length ||
      record.skills.some(
        (skill) => !skill || typeof skill.name !== "string" || !substantive(skill.summary),
      )
    )
      throw new Error("checkpoint needs substantive all-skill coverage");
    const covered = record.skills.map((skill) => skill.name).sort();
    if (
      JSON.stringify(covered) !== JSON.stringify(names(record.reviewedRevision)) ||
      JSON.stringify(covered) !== JSON.stringify(names("HEAD"))
    )
      throw new Error("checkpoint coverage does not match every project skill");
    if (
      !Array.isArray(record.reviewedIssues) ||
      record.reviewedIssues.some(
        (issue) =>
          !issue ||
          !Number.isSafeInteger(issue.number) ||
          issue.number < 1 ||
          !substantive(issue.reason) ||
          !Array.isArray(issue.evidence) ||
          !issue.evidence.length ||
          issue.evidence.some((path) => {
            if (typeof path !== "string" || path.startsWith("/") || path.split("/").includes(".."))
              return true;
            try {
              git("cat-file", "-e", `${recordCommit}:${path}`);
              return false;
            } catch {
              return true;
            }
          }),
      )
    )
      throw new Error("checkpoint Issue exclusions need rationale and committed evidence paths");
    const baselineDate = git("show", "-s", "--format=%cI", record.reviewedRevision);
    return {
      valid: true,
      recordCommit,
      revision: record.reviewedRevision,
      date: baselineDate,
      recordedAt: git("show", "-s", "--format=%cI", recordCommit),
      reviewedIssues: record.reviewedIssues,
    };
  } catch (error) {
    return {
      valid: false,
      reason: `review checkpoint unavailable: ${error.message.split("\n")[0]}`,
    };
  }
}
const checkpoint = readCheckpoint();
const baseline = checkpoint.valid ? checkpoint.revision : null;
const baselineDate = checkpoint.valid ? checkpoint.date : null;
const reviewedIssueNumbers = new Set(
  checkpoint.valid ? checkpoint.reviewedIssues.map((issue) => issue.number) : [],
);

const localFailures = [];
const commits = (...paths) => {
  try {
    const out = git(
      "log",
      "--first-parent",
      "--format=%h%x09%s",
      ...(baseline ? [`${baseline}..HEAD`] : ["HEAD"]),
      "--",
      ...paths,
    );
    return out ? out.split("\n").map((line) => line.split("\t")) : [];
  } catch {
    localFailures.push(`Git history unavailable for ${paths.join(", ")}`);
    return null;
  }
};
const all = commits(".");
const merged = all?.filter(([, subject]) => /\(#\d+\)\s*$|^Merge pull request #\d+ /.test(subject));
const conventions = commits(...CONVENTION_PATHS);
const notes = commits(...NOTE_PATHS);

function getJson(url) {
  const attempt = (token) => {
    const curlArgs = [
      "--max-time",
      "20",
      "-sS",
      "-w",
      "\n%{http_code}",
      "-H",
      "Accept: application/vnd.github+json",
    ];
    if (token) curlArgs.push("-H", `Authorization: Bearer ${token}`);
    try {
      const out = execFileSync("curl", [...curlArgs, url], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const split = out.lastIndexOf("\n");
      return { status: Number(out.slice(split + 1)), text: out.slice(0, split) };
    } catch (error) {
      return {
        status: 0,
        text: String(error.stderr || `process exited ${error.status ?? "without status"}`).trim(),
      };
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
  try {
    return { ok: true, body: JSON.parse(response.text) };
  } catch {
    return { ok: false, reason: "GitHub returned malformed JSON" };
  }
}

const timestamp = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));

function githubSignals() {
  let origin;
  try {
    origin = git("remote", "get-url", "origin");
  } catch {
    return { available: false, reason: "origin remote is unavailable" };
  }
  const slug = origin.replace(/\.git$/, "").match(/github\.com[/:]([^/]+\/[^/]+)$/)?.[1];
  if (!slug) return { available: false, reason: "origin is not a github.com repository" };
  const items = [];
  const seen = new Set();
  for (let page = 1; ; page += 1) {
    const sinceQuery = baselineDate ? `&since=${encodeURIComponent(baselineDate)}` : "";
    const url = `https://api.github.com/repos/${slug}/issues?state=closed${sinceQuery}&per_page=100&page=${page}`;
    const result = getJson(url);
    if (!result.ok) return { available: false, reason: result.reason };
    if (
      !Array.isArray(result.body) ||
      result.body.some(
        (item) =>
          !item ||
          !Number.isSafeInteger(item.number) ||
          item.number < 1 ||
          typeof item.title !== "string" ||
          !timestamp(item.closed_at) ||
          ("pull_request" in item &&
            (!item.pull_request ||
              typeof item.pull_request !== "object" ||
              Array.isArray(item.pull_request))),
      )
    )
      return { available: false, reason: "GitHub returned invalid closed-Issue data" };
    for (const item of result.body) {
      if (seen.has(item.number))
        return {
          available: false,
          reason: "GitHub pagination repeated an Issue; results are incomplete",
        };
      seen.add(item.number);
      items.push(item);
    }
    if (result.body.length < 100) break;
  }

  const since = baselineDate ? Date.parse(baselineDate) : -Infinity;
  const closedAfter = items.filter((item) => Date.parse(item.closed_at) > since);
  const closedIssues = closedAfter
    .filter(
      (item) =>
        !item.pull_request &&
        !(
          reviewedIssueNumbers.has(item.number) &&
          Date.parse(item.closed_at) <= Date.parse(checkpoint.recordedAt)
        ),
    )
    .map((item) => `#${item.number} ${item.title}`);
  const unmergedPRs = [];
  for (const item of closedAfter.filter((entry) => entry.pull_request)) {
    let detail = item.pull_request;
    if (!("merged_at" in detail)) {
      const result = getJson(`https://api.github.com/repos/${slug}/pulls/${item.number}`);
      if (!result.ok) return { available: false, reason: result.reason, closedIssues };
      detail = result.body;
    }
    if (
      !detail ||
      typeof detail !== "object" ||
      !("merged_at" in detail) ||
      (detail.merged_at !== null && !timestamp(detail.merged_at))
    )
      return { available: false, reason: "GitHub returned invalid PR merge data", closedIssues };
    if (detail.merged_at === null) unmergedPRs.push(`#${item.number} ${item.title}`);
  }
  return { available: true, closedIssues, unmergedPRs };
}

function driftErrors() {
  let out;
  try {
    out = execFileSync(
      process.execPath,
      [".agents/skills/skill-maintenance/scripts/check-skills.mjs", "--json"],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    out = error.stdout;
  }
  try {
    const report = JSON.parse(out);
    if (
      !Array.isArray(report.skills) ||
      report.skills.some(
        (skill) =>
          !skill ||
          typeof skill.skill !== "string" ||
          !Array.isArray(skill.missingPaths) ||
          !Array.isArray(skill.brokenScripts),
      )
    )
      throw new Error("invalid drift report");
    return {
      available: true,
      broken: report.skills
        .filter((skill) => skill.missingPaths.length || skill.brokenScripts.length)
        .map((skill) => skill.skill),
    };
  } catch {
    return {
      available: false,
      broken: [],
      reason: "skill drift check unavailable; inspect command and Git history",
    };
  }
}

const github = githubSignals();
const drift = driftErrors();
const broken = drift.broken;
const signals = {
  mergedPRs: merged?.map(([hash, subject]) => `${hash} ${subject}`) ?? null,
  conventionChanges: conventions?.map(([hash, subject]) => `${hash} ${subject}`) ?? null,
  noteChanges: notes?.map(([hash, subject]) => `${hash} ${subject}`) ?? null,
  closedIssues: github.closedIssues ?? null,
  unmergedPRs: github.available ? github.unmergedPRs : null,
};
const reasons = Object.entries(thresholds)
  .filter(([name, limit]) => signals[name] && signals[name].length >= limit)
  .map(([name, limit]) => `${name}: ${signals[name].length} (threshold ${limit})`);
if (!checkpoint.valid) reasons.push(checkpoint.reason);
reasons.push(...localFailures);
if (!drift.available) reasons.push(drift.reason);
if (broken.length) reasons.push(`skills with broken paths or commands: ${broken.join(", ")}`);
const due = reasons.length > 0;

if (json) {
  process.stdout.write(
    `${JSON.stringify({ due, reasons, baseline: baseline ? { commit: baseline.slice(0, 7), date: baselineDate } : null, checkpoint, thresholds, signals, drift, github: github.available ? "ok" : github.reason }, null, 2)}\n`,
  );
} else {
  console.log(
    baseline
      ? `Skills fully reviewed through ${baseline.slice(0, 7)} (${baselineDate}).`
      : checkpoint.reason,
  );
  for (const [name, limit] of Object.entries(thresholds)) {
    const value = signals[name];
    console.log(`  ${name.padEnd(18)} ${value === null ? "unavailable" : value.length} / ${limit}`);
  }
  if (!github.available) console.log(`  GitHub signals unavailable: ${github.reason}`);
  for (const reason of localFailures) console.log(`  ${reason}`);
  if (!drift.available) console.log(`  ${drift.reason}`);
  if (broken.length) console.log(`  broken skills      ${broken.join(", ")}`);
  console.log(due ? `Review due: ${reasons.join("; ")}` : "No review due.");
}

process.exitCode = due ? 10 : 0;
