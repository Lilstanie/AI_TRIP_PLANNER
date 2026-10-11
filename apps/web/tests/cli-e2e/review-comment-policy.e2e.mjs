import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const command = resolve(
  root,
  ".agents/skills/review-trip-planner/scripts/check-added-comments.mjs",
);
const output = resolve(
  root,
  "output/e2e/review-comment-policy",
  new Date().toISOString().replaceAll(":", "-"),
);
const fixture = resolve(output, "fixture");
mkdirSync(fixture, { recursive: true });
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const write = (path, text) => writeFileSync(resolve(fixture, path), text);
git("init", "--quiet");
write(
  "existing.ts",
  "// existing\nexport const value = 1; // retained inline\n/* old\n * unchanged\n */\n",
);
write("staged.ts", "export const staged = 1;\n");
write("deleted.ts", "// removed\nexport {};\n");
git("add", ".");
git(
  "-c",
  "user.name=Fixture",
  "-c",
  "user.email=fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "--quiet",
  "-m",
  "baseline",
);
const base = git("rev-parse", "HEAD");
const results = [];
function check(name, paths, expected, extra = [], expectedCount, comparison = base) {
  const args = [
    command,
    "--base",
    comparison,
    ...paths.flatMap((path) => ["--path", path]),
    ...extra,
  ];
  const result = spawnSync(process.execPath, args, { cwd: fixture, encoding: "utf8" });
  const evidence = {
    name,
    args,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
  results.push(evidence);
  writeFileSync(
    resolve(output, "summary.json"),
    JSON.stringify({ base, fixture, results }, null, 2),
  );
  assert.equal(result.status, expected, JSON.stringify(evidence));
  if (expectedCount !== undefined)
    assert.equal(JSON.parse(result.stdout).violations.length, expectedCount);
}
write(
  "existing.ts",
  readFileSync(resolve(fixture, "existing.ts"), "utf8").replace("value = 1", "value = 2"),
);
check("unchanged comments", ["existing.ts"], 0, [], 0);
write("staged.ts", "// staged addition\nexport const staged = 1;\n");
git("add", "staged.ts");
write(
  "existing.ts",
  "// existing\nexport const value = 2; // retained inline\n/* old\n * changed\n */\n// unstaged addition\n",
);
write(
  "new.tsx",
  "export const view = <div>{/* JSX comment */}text // literal</div>;\nexport const text = `literal /* text */ ${1 /* expression */}`;\nexport const regex = /https?:\\/\\//;\nexport const url = 'https://example.invalid';\n",
);
check("staged unstaged and untracked", ["existing.ts", "staged.ts", "new.tsx"], 1, [], 5);
const current = readFileSync(resolve(fixture, "existing.ts"), "utf8");
write("existing.ts", `${current}// existing\n`);
check("duplicate existing comment is new", ["existing.ts"], 1, [], 3);
write("existing.ts", `// existing\n${current}`);
check("duplicate inserted before existing comment", ["existing.ts"], 1, [], 3);
write("existing.ts", `export const other = 1; // existing\n${current}`);
check("inline duplicate before unchanged comment", ["existing.ts"], 1, [], 3);
write("existing.ts", current);
git(
  "-c",
  "user.name=Fixture",
  "-c",
  "user.email=fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "commit",
  "--quiet",
  "-m",
  "committed addition",
);
check("committed addition against original base", ["staged.ts"], 1, [], 1);
write(
  "literals.tsx",
  "export const view = <div>text // literal /* text */</div>;\nexport const text = `literal /* text */ ${1}`;\nexport const regex = /https?:\\/\\//;\nexport const url = 'https://example.invalid';\n",
);
check("literal text and unrelated scope", ["literals.tsx"], 0, [], 0);
write(
  "jsx-prefix.tsx",
  "export const block = <div>/* literal */</div>;\nexport const line = <div>// literal\n</div>;\n",
);
check("JSX text starting with comment delimiters", ["jsx-prefix.tsx"], 0, [], 0);
write("licence.ts", "/*! MIT */\n// @ts-check\nexport {};\n");
check("no implicit exception", ["licence.ts"], 1, [], 2);
write(
  "exceptions.json",
  JSON.stringify([{ file: "licence.ts", text: "/*! MIT */", reason: "fixture licence approved" }]),
);
check("exact justified exception", ["licence.ts"], 1, ["--exceptions", "exceptions.json"], 1);
write("licence.ts", "/*! MIT */\nexport {};\n");
check("allowed licence", ["licence.ts"], 0, ["--exceptions", "exceptions.json"], 0);
write("exceptions.json", JSON.stringify([{ file: "licence.ts", text: "/*! MIT */", reason: "" }]));
check("invalid exception", ["licence.ts"], 2, ["--exceptions", "exceptions.json"]);
git("rm", "--quiet", "deleted.ts");
check("deleted file", ["deleted.ts"], 0, [], 0);
write("deleted.ts", "// removed\nexport {};\n// rebuilt untracked\n");
check("staged deletion rebuilt as untracked", ["deleted.ts"], 1, [], 2);
check("missing path", ["missing.ts"], 2);
check("unsupported extension", ["exceptions.json"], 2);
check("duplicate argument", ["existing.ts"], 2, ["--base", "missing-ref"]);
check("invalid base", ["existing.ts"], 2, [], undefined, "missing-ref");
check("outside repository", ["../outside.ts"], 2);
mkdirSync(resolve(fixture, "directory.ts"));
check("directory scope", ["directory.ts"], 2);
symlinkSync("existing.ts", resolve(fixture, "link.ts"));
check("symlink scope", ["link.ts"], 2);
write("broken.ts", "export const value = (\n");
check("malformed syntax", ["broken.ts"], 2);
const before = git("status", "--porcelain=v1");
check("read only", ["existing.ts"], 1, [], 2);
assert.equal(git("status", "--porcelain=v1"), before);
console.log(`${results.length} CLI cases passed; evidence: ${output}`);
