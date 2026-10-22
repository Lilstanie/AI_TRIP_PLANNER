#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const base = option("--base", "origin/main");
const allowlistPath = resolve(option("--allowlist", resolve(here, "../references/ui-copy-allowlist.txt")));
const diff = args.includes("--stdin")
  ? readFileSync(0, "utf8")
  : execFileSync(
      "git",
      ["diff", "--unified=0", "--no-color", `${base}...HEAD`, "--", "apps/web/components", "apps/web/app"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );

const allowed = new Set(
  existsSync(allowlistPath)
    ? readFileSync(allowlistPath, "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [],
);

const classAttribute = /className="([^"]*)"/g;
const helperToken = /(^|[-_])(hint|helper|description|subtitle|caption|microcopy|tagline|eyebrow|lede)($|[-_])/;

const helperClasses = (text) => {
  const found = [];
  for (const match of text.matchAll(classAttribute)) {
    for (const token of match[1].split(/\s+/)) {
      if (helperToken.test(token)) found.push(token);
    }
  }
  return found;
};

const violations = [];
let file = null;
let line = 0;
for (const text of diff.split("\n")) {
  if (text.startsWith("+++ ")) {
    file = text.startsWith("+++ b/") ? text.slice(6) : null;
    continue;
  }
  const hunk = text.match(/^@@ -\S+ \+(\d+)/);
  if (hunk) {
    line = Number(hunk[1]) - 1;
    continue;
  }
  if (!text.startsWith("+")) continue;
  line += 1;
  if (!file || !/\.(tsx|jsx)$/.test(file)) continue;
  for (const token of helperClasses(text.slice(1))) {
    if (allowed.has(`${file} ${token}`)) continue;
    violations.push(`${file}:${line}: added helper-copy class "${token}"`);
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  console.error(
    "\nAdded helper copy repeats what the layout already explains. Remove the copy. If the copy carries information the layout cannot show, add a line `<path> <class>` to .agents/skills/better-ui/references/ui-copy-allowlist.txt and name the reason in the pull request.",
  );
  process.exit(1);
}
console.log("No added helper-copy classes.");
