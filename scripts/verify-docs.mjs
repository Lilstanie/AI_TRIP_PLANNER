#!/usr/bin/env node
// Documentation checks, run in CI as `pnpm verify:docs`:
// - Agent Notes follow .agents/notes/README.md: path {lifecycle}/{class}/yyyy-mm-dd-topic.md, a
//   header whose Status matches the lifecycle, and the required sections per lifecycle. Frozen
//   lifecycles (rejected, archived) are checked for path and header only.
// - Every skill folder has a SKILL.md whose frontmatter names the folder and has a description.
// - Relative Markdown links resolve in README.md, AGENTS.md, docs/, .agents/ and package READMEs, except in frozen
//   history (.agents/archive/, dated session logs, rejected and archived notes), which cannot be repaired.
// Usage: node scripts/verify-docs.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = ".agents/notes";
const LIFECYCLES = ["proposed", "implemented", "rejected", "archived"];
const CLASSES = ["feature", "bug-fix", "simplification", "architecture", "process", "testing"];
const ROOT_FILES = ["README.md", "AGENTS.md", "CLAUDE.md"];
const FROZEN = ["rejected", "archived"];
const REQUIRED = {
  proposed: ["Problem", "Proposal", "Alternatives considered", "Acceptance criteria", "Risks"],
  implemented: ["Problem", "Decision", "Alternatives considered", "Consequences"],
};
const FORBIDDEN = { implemented: ["Proposal", "Plan", "Acceptance criteria"] };
const STATUS = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  archived: /^Status: implemented$/,
  rejected: /^Status: rejected — \S.*$/,
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const errors = [];
for (const path of walk(ROOT)) {
  const parts = relative(ROOT, path).split("/");
  if (parts.length === 1 && ROOT_FILES.includes(parts[0])) continue;
  if (parts.length === 2 && parts[1] === ".gitkeep") continue;
  const fail = (message) => errors.push(`${path}: ${message}`);

  const [lifecycle, noteClass, file] = parts;
  if (parts.length !== 3 || !LIFECYCLES.includes(lifecycle) || !CLASSES.includes(noteClass)) {
    fail(`must be ${ROOT}/{${LIFECYCLES.join("|")}}/{${CLASSES.join("|")}}/<file>.md`);
    continue;
  }
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(file)) {
    fail("file name must be yyyy-mm-dd-topic.md in lower-case kebab case");
    continue;
  }

  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  if (!lines[0].startsWith("# Agent Note: ")) fail('line 1 must start with "# Agent Note: "');
  if (lines[1] !== "") fail("line 2 must be blank");
  if (!STATUS[lifecycle].test(lines[2] ?? "")) fail(`line 3 status does not match ${lifecycle}/`);
  const archivedLine = /^Archived: \d{4}-\d{2}-\d{2}$/.test(lines[3] ?? "");
  if (lifecycle === "archived" && !archivedLine) fail('line 4 must be "Archived: YYYY-MM-DD"');
  if (lifecycle !== "archived" && archivedLine) fail("only archived notes carry an Archived line");
  if (FROZEN.includes(lifecycle)) continue;

  const headings = lines.filter((line) => line.startsWith("## ")).map((line) => line.slice(3));
  let cursor = 0;
  for (const section of REQUIRED[lifecycle]) {
    const index = headings.indexOf(section, cursor);
    if (index === -1) fail(`missing or out-of-order section "## ${section}"`);
    else cursor = index + 1;
  }
  for (const section of FORBIDDEN[lifecycle] ?? []) {
    if (headings.includes(section)) fail(`"## ${section}" is not allowed in ${lifecycle}/`);
  }
}

const SKILLS = ".agents/skills";
for (const name of readdirSync(SKILLS)) {
  const dir = join(SKILLS, name);
  if (!statSync(dir).isDirectory()) continue;
  const skill = join(dir, "SKILL.md");
  if (!existsSync(skill)) {
    errors.push(`${dir}: missing SKILL.md`);
    continue;
  }
  const match = readFileSync(skill, "utf8").match(/^---\n([\s\S]*?)\n---\n/);
  const field = (key) => match?.[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1].trim();
  if (!match) errors.push(`${skill}: must start with YAML frontmatter`);
  else if (field("name") !== name) errors.push(`${skill}: frontmatter name must be "${name}"`);
  else if (!field("description")) errors.push(`${skill}: frontmatter needs a description`);
}

const PACKAGE_READMES = [
  "apps/web",
  ...readdirSync("packages").map((name) => join("packages", name)),
]
  .map((dir) => join(dir, "README.md"))
  .filter((path) => existsSync(path));
const LINK_ROOTS = ["README.md", "AGENTS.md", "docs", ".agents", ...PACKAGE_READMES];
const FROZEN_DOCS = [
  /^\.agents\/archive\//,
  /^\.agents\/session-logs\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/,
  /^\.agents\/notes\/(rejected|archived)\//,
];
const markdown = LINK_ROOTS.flatMap((root) =>
  statSync(root).isDirectory() ? walk(root) : [root],
).filter((path) => path.endsWith(".md") && !FROZEN_DOCS.some((pattern) => pattern.test(path)));
for (const path of markdown) {
  const text = readFileSync(path, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/.test(target) || target.startsWith("/")) continue;
    if (!existsSync(resolve(dirname(path), target))) errors.push(`${path}: broken link ${target}`);
  }
}

if (errors.length > 0) {
  console.error(`Documentation check failed:\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("Agent Notes, skills and Markdown links are valid.");
