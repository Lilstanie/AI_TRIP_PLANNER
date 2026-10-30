#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SOURCE = /\.(?:[cm]?[jt]sx?|css|scss|sql|py|sh)$/;
const GENERATED = /(?:^|\/)(?:next-env\.d\.ts|pnpm-lock\.yaml)$|\.snap$|\/drizzle\/meta\//;

function usage(message) {
  console.error(
    `${message}\nusage: node scripts/check-file-length.mjs [--base <ref>] [--max <lines>]`,
  );
  process.exit(2);
}

let base = "origin/main";
let max = 1000;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 1) {
  const flag = args[i];
  if (flag !== "--base" && flag !== "--max") usage(`unknown argument: ${flag}`);
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) usage(`${flag} needs a value`);
  i += 1;
  if (flag === "--base") base = value;
  else if (/^[1-9]\d*$/.test(value)) max = Number(value);
  else usage(`--max must be a positive integer, got ${value}`);
}

const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8" });

let mergeBase;
try {
  mergeBase = git("merge-base", base, "HEAD").trim();
} catch {
  console.error(`base ref ${base} does not resolve; fetch it first (git fetch origin main)`);
  process.exit(2);
}

const changed = new Set(
  [
    git("diff", "--name-only", "--diff-filter=ACMR", "-z", mergeBase, "--"),
    git("ls-files", "--others", "--exclude-standard", "-z"),
  ]
    .join("\0")
    .split("\0")
    .filter(Boolean),
);

const lineCount = (text) => {
  if (text.length === 0) return 0;
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
};

const long = [];
for (const file of [...changed].sort()) {
  if (!SOURCE.test(file) || GENERATED.test(file) || !existsSync(file)) continue;
  const lines = lineCount(readFileSync(file, "utf8"));
  if (lines > max) long.push({ file, lines });
}

if (long.length === 0) {
  console.log(`ok: no changed source file is longer than ${max} lines`);
  process.exit(0);
}
for (const { file, lines } of long) console.log(`${file}: ${lines} lines (limit ${max})`);
console.log(`Split ${long.length === 1 ? "this file" : "these files"} before pushing.`);
process.exit(1);
