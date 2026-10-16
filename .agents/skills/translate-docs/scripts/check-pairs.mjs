#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const args = process.argv.slice(2);
let root = process.cwd();
let base = "origin/main";
const option = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1]) throw new Error(`${name} requires a value`);
  const [, value] = args.splice(index, 2);
  return value;
};
const rootOption = option("--root");
if (rootOption) root = resolve(rootOption);
base = option("--base") ?? base;
if (args.includes("--record") || args.includes("--remove")) {
  console.error(
    "--record and --remove were retired: the check compares each pair with --base instead of stored hashes.",
  );
  process.exit(1);
}
if (args.length) throw new Error(`Unknown arguments: ${args.join(" ")}`);
const absolute = (path) => resolve(root, path);
const read = (path) => readFileSync(absolute(path), "utf8");
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

const git = (...gitArgs) => spawnSync("git", ["-C", root, ...gitArgs], { encoding: "utf8" });
const mergeBase = (() => {
  const found = git("merge-base", base, "HEAD");
  return found.status === 0 ? found.stdout.trim() : undefined;
})();
const changedSinceBase = (path, ignoreWhitespace) =>
  git("diff", "--quiet", ...(ignoreWhitespace ? ["--ignore-all-space"] : []), mergeBase, "--", path)
    .status === 1;

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
function headingAnchors(text) {
  const result = [];
  const counts = new Map();
  let explicit;
  let fence;
  for (const line of text.split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length)
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    const anchor = line.match(/^<a\s+id="([^"]+)"\s*><\/a>\s*$/);
    if (anchor) {
      explicit = anchor[1];
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const base = slug(heading[1]);
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      result.push({
        own: count ? `${base}-${count}` : base,
        explicit,
        text: heading[1],
      });
    }
    if (line.trim()) explicit = undefined;
  }
  return result;
}
function anchorAlignmentErrors(zh, enText, zhText) {
  const en = headingAnchors(enText);
  const translatedHeadings = headingAnchors(zhText);
  if (en.length !== translatedHeadings.length) return [];
  return en.flatMap((source, index) => {
    const target = translatedHeadings[index];
    return target.own === source.own || target.explicit === source.own
      ? []
      : [`${zh}: heading "${target.text}" needs <a id="${source.own}"></a> to match its source`];
  });
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
  errors.push(...anchorAlignmentErrors(zh, enText, zhText));
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
for (const path of sources) {
  errors.push(...pairErrors(path));
  if (
    mergeBase &&
    existsSync(absolute(translated(path))) &&
    changedSinceBase(path, true) &&
    !changedSinceBase(translated(path), false)
  )
    errors.push(
      `${path}: changed since ${base} but ${translated(path)} was not; update the Chinese counterpart in the same change`,
    );
}
for (const path of files.filter((path) => path.endsWith(".zh.md"))) {
  if (!sourceSet.has(path.replace(/\.zh\.md$/, ".md"))) errors.push(`${path}: orphan translation`);
}
if (!mergeBase)
  console.warn(
    `Base "${base}" is not available; checked pair structure only, not whether both languages changed together.`,
  );
if (errors.length) {
  console.error(`Documentation pairing failed:\n${errors.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${sources.length} documentation pairs${mergeBase ? ` against ${base}` : ""}.`,
  );
}
