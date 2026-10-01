// Format rules for agent skills under `.agents/skills`, checked by `scripts/verify-docs.mjs`.
// Sources: the Agent Skills specification (https://agentskills.io/specification), the Claude Code skill
// guide at https://qiao1.top/posts/fcc443a7.html, and this project's own layout. Only what a script can
// decide is checked; whether a rule is the most important one, or an operation deserves a script, is
// judgement and is left to review.
//
// The rules come in two tiers, returned separately by `checkSkills`:
// - `errors` fail `verify:docs`. They are requirements of the specification (name, description and
//   compatibility limits, frontmatter) and this project's conventions: the description says when to use the
//   skill, supporting files live under references/, scripts/ or assets/, and references stay one level deep.
// - `warnings` do not fail anything. They are recommendations or client-specific limits: 500 lines in
//   SKILL.md (the specification says "keep under"), the 1536-character trigger budget of Claude Code, and
//   frontmatter fields this list does not know. Each is a number or a list that is easy to change here.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const COMPATIBILITY_MAX = 500;
// Claude Code shows name, description and when_to_use together in a shared, limited budget.
const TRIGGER_BUDGET = 1536;
const BODY_MAX_LINES = 500;
const WHEN_PATTERN = /\b[Uu]se (when|before|after|at|for|if)\b/;
const KNOWN_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disallowed-tools",
  "disable-model-invocation",
  "user-invocable",
  "when_to_use",
  "arguments",
  "argument-hint",
  "paths",
  "context",
  "agent",
]);
const ALLOWED_DIRECTORIES = new Set(["scripts", "references", "assets"]);
const LICENCE_FILE = /^licen[cs]e(\..+)?$/i;

/** A small reader for the flat `key: value` frontmatter skills use, including folded `>` and `|` values. */
function parseFrontmatter(block) {
  const fields = new Map();
  let key;
  for (const line of block.split("\n")) {
    const field = line.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/);
    if (field) {
      key = field[1];
      fields.set(key, field[2]);
    } else if (key && /^[ \t]/.test(line)) {
      fields.set(key, `${fields.get(key)} ${line.trim()}`.trim());
    }
  }
  for (const [name, value] of fields) {
    const text = value.replace(/^[>|][+-]?\s*/, "").trim();
    fields.set(name, text.replace(/^(["'])(.*)\1$/, "$2"));
  }
  return fields;
}

function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkMarkdown(path);
    return path.endsWith(".md") ? [path] : [];
  });
}

const insideReferences = (target, skillsDir) => {
  const parts = relative(skillsDir, target).split(sep);
  return parts[0] !== ".." && parts.length >= 3 && parts[1] === "references" ? parts[0] : undefined;
};

function checkLinks(skill, skillsDir, errors) {
  const files = [
    join(skillsDir, skill, "SKILL.md"),
    ...walkMarkdown(join(skillsDir, skill, "references")),
  ];
  for (const file of files) {
    const isReference = file !== files[0];
    const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const [, link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(link) || link.startsWith("/")) continue;
      const target = resolve(dirname(file), link);
      const owner = insideReferences(target, skillsDir);
      if (!owner || target === file) continue;
      if (isReference) {
        errors.push(
          `${file}: links to ${link}; a reference must not link to another reference, so the hierarchy stays one level deep`,
        );
      } else if (owner !== skill) {
        errors.push(
          `${file}: links into another skill's references (${link}); link that skill's SKILL.md instead`,
        );
      }
    }
  }
}

/** Returns `{ errors, warnings }`: one message per violation of the skill format rules under `skillsDir`. */
export function checkSkills(skillsDir) {
  const errors = [];
  const warnings = [];
  for (const skill of readdirSync(skillsDir)) {
    const dir = join(skillsDir, skill);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, "SKILL.md");
    if (!existsSync(file)) {
      errors.push(`${dir}: missing SKILL.md`);
      continue;
    }
    const text = readFileSync(file, "utf8");

    for (const entry of readdirSync(dir)) {
      if (entry === "SKILL.md" || entry.startsWith(".") || LICENCE_FILE.test(entry)) continue;
      const isDirectory = statSync(join(dir, entry)).isDirectory();
      if (!(isDirectory && ALLOWED_DIRECTORIES.has(entry))) {
        errors.push(
          `${join(dir, entry)}: only SKILL.md, scripts/, references/, assets/ and a licence file belong beside a skill; move supporting documents into references/`,
        );
      }
    }

    const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    if (lines > BODY_MAX_LINES) {
      warnings.push(
        `${file}: ${lines} lines; the specification recommends keeping SKILL.md under ${BODY_MAX_LINES} lines and moving detail into references/`,
      );
    }

    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) {
      errors.push(`${file}: must start with YAML frontmatter`);
      continue;
    }
    const fields = parseFrontmatter(match[1]);
    const name = fields.get("name") ?? "";
    const description = fields.get("description") ?? "";

    if (name !== skill) errors.push(`${file}: frontmatter name must be "${skill}"`);
    if (!NAME_PATTERN.test(name)) {
      errors.push(
        `${file}: name must be lower-case letters, digits and single hyphens, not starting or ending with one`,
      );
    }
    if (name.length > NAME_MAX) errors.push(`${file}: name is longer than ${NAME_MAX} characters`);

    if (!description) {
      errors.push(`${file}: frontmatter needs a description`);
    } else {
      if (description.length > DESCRIPTION_MAX) {
        errors.push(
          `${file}: description is longer than ${DESCRIPTION_MAX} characters (${description.length})`,
        );
      }
      if (!WHEN_PATTERN.test(description)) {
        errors.push(
          `${file}: description must also say when to use the skill, for example "Use when …"`,
        );
      }
    }

    for (const key of fields.keys()) {
      if (!KNOWN_FIELDS.has(key)) {
        warnings.push(
          `${file}: unknown frontmatter field "${key}"; a typo drops the field, and a new field belongs in KNOWN_FIELDS`,
        );
      }
    }
    if ((fields.get("compatibility") ?? "").length > COMPATIBILITY_MAX) {
      errors.push(`${file}: compatibility is longer than ${COMPATIBILITY_MAX} characters`);
    }
    const trigger = name.length + description.length + (fields.get("when_to_use") ?? "").length;
    if (trigger > TRIGGER_BUDGET) {
      warnings.push(
        `${file}: name, description and when_to_use together exceed ${TRIGGER_BUDGET} characters (${trigger}), the trigger budget Claude Code shows per skill`,
      );
    }

    checkLinks(skill, skillsDir, errors);
  }
  return { errors, warnings };
}
