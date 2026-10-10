#!/usr/bin/env node
// Runs `prettier --check` on the files changed since a base ref, never on a whole directory.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import prettier from "prettier";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const resolves = (ref) => {
  try {
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

const base = process.argv[2];
let range;
if (base && !/^0+$/.test(base) && resolves(base)) {
  range = `${base}...HEAD`;
} else {
  if (base && !/^0+$/.test(base)) {
    console.warn(`Base "${base}" is not available; checking the files changed by HEAD only.`);
  }
  range = resolves("HEAD~1") ? "HEAD~1..HEAD" : "HEAD";
}

const changed = git("diff", "--name-only", "--diff-filter=ACMR", "-z", range, "--")
  .split("\0")
  .filter(Boolean);

const files = [];
for (const file of changed) {
  if (!existsSync(file)) continue;
  const info = await prettier.getFileInfo(file, { ignorePath: ".prettierignore" });
  if (!info.ignored && info.inferredParser) files.push(file);
}

if (files.length === 0) {
  console.log(`No Prettier-supported files changed in ${range}.`);
  process.exit(0);
}

console.log(`Checking ${files.length} file(s) changed in ${range}.`);
const bad = [];
for (const file of files) {
  const options = (await prettier.resolveConfig(file)) ?? {};
  const ok = await prettier.check(readFileSync(file, "utf8"), { ...options, filepath: file });
  if (!ok) bad.push(file);
}

if (bad.length > 0) {
  console.error("Not formatted. Run `npx prettier --write` on these files, not on a directory:");
  for (const file of bad) console.error(`  ${file}`);
  process.exit(1);
}
console.log("All changed files are formatted.");
