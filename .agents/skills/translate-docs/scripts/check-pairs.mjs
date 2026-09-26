#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";

const args = process.argv.slice(2);
let root = process.cwd();
const rootIndex = args.indexOf("--root");
if (rootIndex !== -1) {
  if (!args[rootIndex + 1]) throw new Error("--root requires a project directory");
  root = resolve(args[rootIndex + 1]);
  args.splice(rootIndex, 2);
}
const mode = args[0] ?? "check";
if (!["check", "--record", "--remove"].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
const paths = args.slice(1);
if ((mode === "check" && args.length > 1) || (mode !== "check" && !paths.length)) {
  throw new Error("Use no arguments to check; --record or --remove requires explicit source paths");
}
const absolute = (path) => resolve(root, path);
const read = (path) => readFileSync(absolute(path), "utf8");
const hash = (path) => createHash("sha256").update(read(path)).digest("hex");
const translated = (path) => path.replace(/\.md$/, ".zh.md");
const eligible = (path) =>
  path.startsWith("docs/") &&
  path.endsWith(".md") &&
  !path.endsWith(".zh.md") &&
  !/(^|\/)(AGENTS|CLAUDE)\.md$/.test(path) &&
  relative(root, absolute(path)).replaceAll("\\", "/") === path;
const walk = (path) =>
  readdirSync(absolute(path)).flatMap((name) => {
    const child = `${path}/${name}`;
    const stat = lstatSync(absolute(child));
    if (stat.isSymbolicLink()) return [];
    return stat.isDirectory() ? walk(child) : [child];
  });
const files = walk("docs");
const sources = files.filter(eligible).sort();
const sourceSet = new Set(sources);
const manifestPath = ".agents/translation-pairs.json";
const manifest = existsSync(absolute(manifestPath))
  ? JSON.parse(read(manifestPath))
  : { version: 1, pairs: {} };
if (
  manifest.version !== 1 ||
  !manifest.pairs ||
  typeof manifest.pairs !== "object" ||
  Array.isArray(manifest.pairs)
) {
  throw new Error(
    "Unsupported or malformed translation-pairs.json; expected version 1 and pairs object",
  );
}

// Compare Markdown structure, never translation meaning. Fences include their opening language.
function structure(text) {
  const result = { headings: [], lists: [], tables: [], fences: [] };
  let fence;
  for (const line of text.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      fence.lines.push(line);
      if (
        marker &&
        marker[1][0] === fence.char &&
        marker[1].length >= fence.size &&
        !marker[2].trim()
      ) {
        result.fences.push(fence.lines.join("\n"));
        fence = undefined;
      }
      continue;
    }
    if (marker) {
      fence = { char: marker[1][0], size: marker[1].length, lines: [line] };
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) result.headings.push(heading[1].length);
    const list = line.match(/^(\s*)([-+*]|\d+[.)])\s+/);
    if (list) result.lists.push([list[1].length, /^\d/.test(list[2]) ? list[2] : "bullet"]);
    if (/^\s*\|.*\|\s*$/.test(line)) {
      result.tables.push(line.replace(/\\\|/g, "").split("|").length - 2);
    }
  }
  if (fence) throw new Error("Unclosed Markdown code fence");
  return result;
}
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
    .replace(/\s/g, "-");
function anchors(text) {
  const ids = new Set([...text.matchAll(/<a\s+id="([^"]+)"\s*><\/a>/g)].map((match) => match[1]));
  const counts = new Map();
  const outside = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "");
  for (const match of outside.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(match[1]);
    const count = counts.get(base) ?? 0;
    ids.add(count ? `${base}-${count}` : base);
    counts.set(base, count + 1);
  }
  return ids;
}
const links = (text) =>
  [
    ...text
      .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
      .matchAll(/\]\(([^\s)]+)\)/g),
  ].map((match) => match[1]);
function translatedTarget(path, target) {
  if (/^[a-z]+:/i.test(target) || target.startsWith("/")) return target;
  const suffixIndex = target.search(/[?#]/);
  const pathname = suffixIndex < 0 ? target : target.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : target.slice(suffixIndex);
  const destination = relative(
    root,
    resolve(dirname(absolute(path)), pathname || path.split("/").at(-1)),
  ).replaceAll("\\", "/");
  return pathname && sourceSet.has(destination)
    ? pathname.replace(/\.md$/, ".zh.md") + suffix
    : target;
}
function pairErrors(path) {
  const zh = translated(path);
  if (!existsSync(absolute(zh))) return [`${path}: missing ${zh}`];
  const enText = read(path);
  const zhText = read(zh);
  const errors = [];
  try {
    const enStructure = structure(enText);
    const zhStructure = structure(zhText);
    for (const key of Object.keys(enStructure)) {
      if (JSON.stringify(enStructure[key]) !== JSON.stringify(zhStructure[key]))
        errors.push(`${zh}: ${key} differ from source`);
    }
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
  }
  const inlineCode = (text) =>
    [
      ...text
        .replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, "")
        .matchAll(/(`+)([^`]*?)\1/g),
    ]
      .map((match) => match[2])
      .sort();
  if (JSON.stringify(inlineCode(enText)) !== JSON.stringify(inlineCode(zhText)))
    errors.push(`${zh}: inline code identifiers differ from source`);
  const switches = new Set([path.split("/").at(-1), zh.split("/").at(-1)]);
  const contentLinks = (text) => links(text).filter((target) => !switches.has(target));
  const expected = contentLinks(enText).map((target) => translatedTarget(path, target));
  if (JSON.stringify(expected) !== JSON.stringify(contentLinks(zhText)))
    errors.push(`${zh}: link destinations or locale differ from source`);
  for (const target of contentLinks(zhText)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
    const [pathname, fragment] = target.split("#");
    const targetPath = pathname
      ? resolve(dirname(absolute(zh)), pathname.split("?")[0])
      : absolute(zh);
    if (!existsSync(targetPath)) errors.push(`${zh}: missing local link target ${target}`);
    if (
      fragment &&
      targetPath.endsWith(".zh.md") &&
      existsSync(targetPath) &&
      !anchors(readFileSync(targetPath, "utf8")).has(decodeURIComponent(fragment))
    ) {
      errors.push(`${zh}: missing anchor for ${target}`);
    }
  }
  return errors;
}

const errors = [];
if (mode === "--record") {
  for (const path of paths) {
    if (!sourceSet.has(path)) errors.push(`${path}: not an eligible source`);
    else errors.push(...pairErrors(path));
  }
  if (!errors.length) {
    for (const path of paths)
      manifest.pairs[path] = {
        sourceSha256: hash(path),
        translationSha256: hash(translated(path)),
      };
  }
} else if (mode === "--remove") {
  for (const path of paths) {
    if (!eligible(path) || existsSync(absolute(path)) || existsSync(absolute(translated(path))))
      errors.push(`${path}: remove both eligible pair files before removing its record`);
    else delete manifest.pairs[path];
  }
} else {
  for (const path of sources) {
    errors.push(...pairErrors(path));
    const record = manifest.pairs[path];
    if (!record) errors.push(`${path}: unrecorded review; translate and review before --record`);
    else if (
      existsSync(absolute(translated(path))) &&
      (record.sourceSha256 !== hash(path) || record.translationSha256 !== hash(translated(path)))
    )
      errors.push(`${path}: stale review; synchronize both languages before --record`);
  }
  for (const path of files.filter((path) => path.endsWith(".zh.md"))) {
    if (!sourceSet.has(path.replace(/\.zh\.md$/, ".md")))
      errors.push(`${path}: orphan translation`);
  }
  for (const path of Object.keys(manifest.pairs))
    if (!sourceSet.has(path))
      errors.push(`${path}: obsolete record; use --remove after deleting both files`);
}
if (errors.length) {
  console.error(`Documentation pairing failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  if (mode !== "check") {
    manifest.pairs = Object.fromEntries(
      Object.entries(manifest.pairs).sort(([a], [b]) => a.localeCompare(b)),
    );
    mkdirSync(dirname(absolute(manifestPath)), { recursive: true });
    writeFileSync(absolute(manifestPath), JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(
    `${mode === "check" ? "Checked" : "Updated"} ${mode === "check" ? sources.length : paths.length} documentation pairs.`,
  );
}
