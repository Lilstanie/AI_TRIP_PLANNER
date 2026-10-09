#!/usr/bin/env node
// Fails when an E2E script targets a CSS class that no web source defines any more, so removing a component
// class and leaving a script that still looks for it fails in CI, not at the next full E2E run.
//
//   node scripts/verify-e2e-selectors.mjs            # pnpm verify:e2e-selectors
//   node scripts/verify-e2e-selectors.mjs <e2e-dir> <source-dir...>   # used by the tests
//
// A class counts as defined when any script file under the source directories (.ts, .tsx, .js, .jsx, .mjs)
// contains it as a whole word. Stylesheets do not count: a rule left behind for a class no markup renders any
// more (`.section__row` after the one-day drawer) would otherwise hide the stale script. A modifier or element built at runtime (`timeline-stop--${kind}`) counts when the
// source holds its stem followed by `${`. ALLOWED lists classes no source file can show, each with its reason.
// A line that checks a class is gone on purpose ends with the comment `// e2e-selectors: absent`; its classes
// are not looked up, while every other use of the same class still is.
//
// Failure inventory this check was written from:
// - a removed class still targeted by a script passes CI (the reason this check exists);
// - a class built from a template string (`--${kind}`) is reported as missing;
// - a class set by a third-party library (Leaflet, Next) is reported as missing;
// - a file name or URL inside a string ("summary.json", "localhost:3000") is read as a class;
// - a method call in a template's code (`${id.padEnd(20)}`) is read as a class;
// - a class mentioned only in a comment is checked;
// - a script that checks a removed class stays gone is reported for the class it checks;
// - a class that moved to another file is reported as missing;
// - a stylesheet rule left behind for a class no markup renders any more makes the class look defined;
// - the scan is slow enough that nobody runs it locally.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

/** Classes no source file shows, with why each is allowed. Keep this short; a new entry is reviewed like code. */
export const ALLOWED = new Map(
  /** @type {[string, string][]} */ (
    [
      // ["leaflet-popup", "set by Leaflet on a marker's popup"],
    ]
  ),
);

const SOURCE_EXT = /\.(?:tsx?|jsx?|mjs)$/;

function filesUnder(dir, keep) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".next")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path, keep));
    else if (keep(name)) out.push(path);
  }
  return out;
}

// A class selector inside a string: a dot after the start of the string, a space, a combinator or a bracket,
// never after a word character, so "summary.json" and "localhost:3000" are not read as classes. A name followed
// by "(" is a method call in a template's code (`${id.padEnd(20)}`), not a class.
const CLASS_IN_STRING = /(?:^|[\s"'`>+~,([])\.(-?[a-zA-Z_][\w-]*)(?![\w-]*\()/g;
// String literals on one line: '…', "…" and `…` (template text between `${…}` included).
const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const ABSENT = /\/\/\s*e2e-selectors:\s*absent\b/;

/** Every class a script's string literals select, with the line it is on. Comments are not read. */
export function classesIn(text) {
  const found = [];
  const lines = text.split("\n");
  lines.forEach((raw, index) => {
    if (ABSENT.test(raw)) return;
    const line = raw.replace(/^\s*(?:\/\/|\*|\/\*).*$/, "").replace(/\s\/\/\s.*$/, "");
    for (const literal of line.match(STRING) ?? []) {
      const body = literal.slice(1, -1);
      for (const match of body.matchAll(CLASS_IN_STRING))
        found.push({ name: match[1], line: index + 1 });
    }
  });
  return found;
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `source` defines `name`, literally or as a stem followed by a template placeholder. */
export function defines(source, name) {
  if (source.includes(name) && new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(source))
    return true;
  // `timeline-stop--booked` from `timeline-stop--${kind}`, or `day-3` from `day-${n}`.
  for (const cut of ["--", "__", "-"]) {
    const at = name.lastIndexOf(cut);
    if (at > 0 && source.includes(`${name.slice(0, at + cut.length)}\${`)) return true;
  }
  return false;
}

/** The selectors in `e2eDir` that no file under `sourceDirs` defines and ALLOWED does not list. */
export function missingSelectors(e2eDir, sourceDirs, allowed = ALLOWED) {
  const source = sourceDirs
    .flatMap((dir) => filesUnder(dir, (name) => SOURCE_EXT.test(name)))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const missing = [];
  const known = new Map();
  for (const file of filesUnder(e2eDir, (name) => name.endsWith(".e2e.mjs")).sort()) {
    for (const { name, line } of classesIn(readFileSync(file, "utf8"))) {
      if (allowed.has(name)) continue;
      if (!known.has(name)) known.set(name, defines(source, name));
      if (!known.get(name)) missing.push({ file, line, name });
    }
  }
  return missing;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [e2eArg, ...sourceArgs] = process.argv.slice(2);
  const e2eDir = resolve(e2eArg ?? join(ROOT, "apps/web/tests/e2e"));
  const sourceDirs = sourceArgs.length
    ? sourceArgs.map((dir) => resolve(dir))
    : ["components", "app", "lib"].map((dir) => join(ROOT, "apps/web", dir));
  const missing = missingSelectors(e2eDir, sourceDirs);
  for (const { file, line, name } of missing)
    console.error(
      `${relative(process.cwd(), file)}:${line}: .${name} is not defined by any web source`,
    );
  if (missing.length) {
    console.error(
      `\n${missing.length} selector(s) target classes that no longer exist. Update the script, or add the class to ALLOWED in scripts/verify-e2e-selectors.mjs with a reason.`,
    );
    process.exit(1);
  }
  console.log("Every class an E2E script selects is defined by a web source.");
}
