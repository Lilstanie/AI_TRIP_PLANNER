#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const args = process.argv.slice(2);
const json = args.includes("--json");
const only = args.filter((arg) => !arg.startsWith("--"));
const root = resolve(process.cwd());
const skillsDir = join(root, ".agents/skills");

const git = (...gitArgs) =>
  execFileSync("git", gitArgs, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const tracked = git("ls-files").split("\n").filter(Boolean);
const trackedDirs = new Set();
for (const file of tracked) {
  const parts = file.split("/");
  for (let i = 1; i < parts.length; i += 1) trackedDirs.add(parts.slice(0, i).join("/"));
}
const shallow = git("rev-parse", "--is-shallow-repository") === "true";

const RECORD_FILES = new Set([".agents/translation-pairs.json", "pnpm-lock.yaml"]);
const EXTENSIONS =
  /\.(md|mjs|cjs|js|jsx|ts|tsx|json|ya?ml|py|css|html|svg|png|pdf|pptx|mmd|sh|sql|toml|txt)$/i;

function resolvePath(token, skillDir) {
  const clean = token.replace(/\/+$/, "");
  const candidates = [clean, relative(root, join(skillDir, clean))];
  for (const candidate of candidates) {
    if (tracked.includes(candidate) || trackedDirs.has(candidate)) return candidate;
  }

  for (const candidate of candidates) if (existsSync(join(root, candidate))) return candidate;
  const suffix = `/${clean}`;
  const fileMatch = tracked.find((file) => file.endsWith(suffix));
  if (fileMatch) return fileMatch;
  const dirMatch = [...trackedDirs].find((dir) => dir.endsWith(suffix));
  return dirMatch ?? null;
}

function pathCandidate(raw) {
  if (/\s|^https?:|[<>{}$|[\]]|YYYY|\bfoo\b|\.\.\.|^-/.test(raw)) return null;
  const token = raw.split("*")[0].replace(/^\.\//, "");
  if (!token || token === "/") return null;
  if (token.startsWith("/")) return null;
  if (raw.includes("*") && !token.includes("/")) return null;
  if (/^[\w.-]+\/$/.test(token)) return null;
  const hasSlash = token.includes("/");
  const hasExtension = EXTENSIONS.test(token) && !/^\.[a-z.]+$/i.test(token);
  if (!hasSlash && !hasExtension) return null;
  if (token.startsWith("@")) return null;
  if (/^[A-Z_]+=/.test(token)) return null;
  return token;
}

const rootScripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
const packages = new Map();
for (const file of tracked.filter((path) => /^(apps|packages)\/[^/]+\/package\.json$/.test(path))) {
  const manifest = JSON.parse(readFileSync(join(root, file), "utf8"));
  packages.set(manifest.name, manifest.scripts ?? {});
}
const PNPM_BUILTINS = new Set([
  "install",
  "exec",
  "dlx",
  "add",
  "remove",
  "run",
  "why",
  "list",
  "update",
]);

function scriptProblems(text) {
  const problems = [];
  for (const match of text.matchAll(/pnpm\s+(?:--filter[= ](\S+)\s+)?([a-z][\w:-]*)/g)) {
    const [, filter, script] = match;
    if (PNPM_BUILTINS.has(script) || script === "turbo") continue;
    if (filter) {
      if (filter.startsWith("...") || /[*<]/.test(filter)) continue;
      const scripts = packages.get(filter);
      if (!scripts) problems.push(`pnpm --filter ${filter}: no such workspace package`);
      else if (!(script in scripts))
        problems.push(`pnpm --filter ${filter} ${script}: no such script`);
    } else if (!(script in rootScripts)) {
      problems.push(`pnpm ${script}: no such root script`);
    }
  }
  return problems;
}

function lastChange(path) {
  const line = git("log", "-1", "--format=%H%x09%cs", "--", path);
  if (!line) return null;
  const [sha, date] = line.split("\t");
  return { sha, date };
}

function commitsSince(sha, paths, skillPath) {
  if (!paths.length) return [];
  const log = git("log", "--format=%H%x09%cs%x09%s", `${sha}..HEAD`, "--", ...paths);
  if (!log) return [];
  return log
    .split("\n")
    .map((line) => {
      const [hash, date, subject] = line.split("\t");
      return { hash: hash.slice(0, 7), date, subject, full: hash };
    })
    .map((commit) => {
      const touched = git("show", "--name-only", "--format=", commit.full).split("\n");
      const via = paths.filter((path) =>
        touched.some((file) => file === path || file.startsWith(`${path}/`)),
      );

      const updatedSkill = touched.some((file) => file.startsWith(`${skillPath}/`));
      return { hash: commit.hash, date: commit.date, subject: commit.subject, via, updatedSkill };
    })
    .filter((commit) => !commit.updatedSkill)
    .map(({ updatedSkill, ...commit }) => commit);
}

const skills = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(skillsDir, entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .filter((name) => !only.length || only.includes(name))
  .sort();

const report = [];
for (const name of skills) {
  const skillDir = join(skillsDir, name);
  const skillPath = relative(root, skillDir);
  const body = readFileSync(join(skillDir, "SKILL.md"), "utf8").replace(/^---[\s\S]*?\n---\n/, "");
  const spans = [...body.matchAll(/```[\s\S]*?```|`([^`\n]+)`/g)].map((m) => m[1] ?? m[0]);

  const missing = new Set();
  const named = new Set();
  for (const span of spans) {
    for (const raw of span.startsWith("```") ? span.split(/\s+/) : [span]) {
      const token = pathCandidate(raw.replace(/^[("'`]+|[)"'`,;:.]+$/g, ""));
      if (!token) continue;
      const found = resolvePath(token, skillDir);
      if (found) {
        const isFile = tracked.includes(found);
        if (isFile && !RECORD_FILES.has(found) && !found.startsWith(`${skillPath}/`))
          named.add(found);
      } else missing.add(token);
    }
  }
  const scripts = [...new Set(spans.flatMap(scriptProblems))];

  const last = lastChange(skillPath);
  let drift = [];
  let driftNote = null;
  if (!last) driftNote = "skill has no commit yet";
  else if (shallow && git("rev-list", "--max-parents=0", "HEAD").split("\n").includes(last.sha)) {
    driftNote = "history is shallow; run `git fetch --unshallow` for an exact count";
  }
  if (last) drift = commitsSince(last.sha, [...named], skillPath);

  report.push({
    skill: name,
    lastChanged: last?.date ?? null,
    missingPaths: [...missing].sort(),
    brokenScripts: scripts,
    commitsSinceOnNamedPaths: drift,
    note: driftNote,
  });
}

if (json) {
  process.stdout.write(`${JSON.stringify({ shallow, skills: report }, null, 2)}\n`);
} else {
  let flagged = 0;
  for (const entry of report) {
    const problems = entry.missingPaths.length + entry.brokenScripts.length;
    if (!problems && !entry.commitsSinceOnNamedPaths.length && !entry.note) continue;
    flagged += 1;
    console.log(`\n${entry.skill} (last changed ${entry.lastChanged ?? "never"})`);
    for (const path of entry.missingPaths) console.log(`  missing path      ${path}`);
    for (const script of entry.brokenScripts) console.log(`  broken command    ${script}`);
    for (const commit of entry.commitsSinceOnNamedPaths) {
      console.log(`  changed since     ${commit.hash} ${commit.date} ${commit.subject}`);
      console.log(`                    via ${commit.via.join(", ")}`);
    }
    if (entry.note) console.log(`  note              ${entry.note}`);
  }
  console.log(
    flagged
      ? `\n${flagged} of ${report.length} skills need a look. Missing paths and broken commands are errors; commits since are prompts to review.`
      : `All ${report.length} skills match the repository.`,
  );
}

const errors = report.some((entry) => entry.missingPaths.length || entry.brokenScripts.length);
process.exitCode = errors ? 1 : 0;
