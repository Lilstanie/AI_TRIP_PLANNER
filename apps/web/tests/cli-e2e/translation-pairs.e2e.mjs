import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const failureModes = [
  "a translated heading carries another heading's anchor",
  "a translated heading has no anchor and its own slug differs",
  "an identical code heading is rejected for lacking an explicit anchor",
  "a correct explicit anchor is rejected",
  "duplicate source headings lose their numbered anchor",
  "an anchor separated from its heading by prose still counts",
  "headings inside code fences are compared",
  "a heading-count mismatch crashes or floods alignment errors",
  "the repository's own pairs stop passing",
  "an English edit without a Chinese edit passes",
  "a Chinese-only edit is rejected",
  "an edit to both files is rejected",
  "a whitespace-only English reflow forces a Chinese edit",
  "an uncommitted English edit is missed",
  "an English edit that arrived from the base branch counts against this branch",
  "a new English page without its Chinese pair passes",
  "an unavailable base crashes the check instead of skipping the diff rule",
  "the retired --record mode silently succeeds",
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const script = resolve(root, ".agents/skills/translate-docs/scripts/check-pairs.mjs");
const output = mkdtempSync(resolve(tmpdir(), "translation-pairs-acceptance-"));
const results = [];

function run(name, cwd, args, expected) {
  const argv = [script, "--root", cwd, ...args];
  const r = spawnSync(process.execPath, argv, { encoding: "utf8", timeout: 30000 });
  const evidence = {
    name,
    argv,
    status: r.status,
    signal: r.signal,
    stdout: r.stdout,
    stderr: r.stderr,
  };
  results.push(evidence);
  writeFileSync(
    resolve(output, "summary.json"),
    JSON.stringify({ failureModes, results }, null, 2),
  );
  assert.equal(r.status, expected, JSON.stringify(evidence));
  return r.stderr;
}

function pair(name, english, chinese, expected) {
  const cwd = mkdtempSync(resolve(output, "repo-"));
  mkdirSync(resolve(cwd, "docs"), { recursive: true });
  writeFileSync(resolve(cwd, "docs/page.md"), english);
  writeFileSync(resolve(cwd, "docs/page.zh.md"), chinese);
  return run(name, cwd, [], expected);
}

const en = "# Page\n\n## Alpha\n\nText.\n\n## Beta\n\nText.\n";
const anchored =
  '<a id="page"></a>\n\n# 页面\n\n<a id="alpha"></a>\n\n## 甲\n\n正文。\n\n<a id="beta"></a>\n\n## 乙\n\n正文。\n';

const misplaced = pair(
  "misplaced anchor",
  en,
  '<a id="page"></a>\n\n# 页面\n\n<a id="beta"></a>\n\n## 甲\n\n正文。\n\n## 乙\n\n正文。\n',
  1,
);
assert.match(misplaced, /heading "甲" needs <a id="alpha"><\/a>/);
assert.match(misplaced, /heading "乙" needs <a id="beta"><\/a>/);

const missing = pair("missing anchors", en, "# 页面\n\n## 甲\n\n正文。\n\n## 乙\n\n正文。\n", 1);
assert.equal(missing.match(/needs <a id=/g).length, 3);

pair("identical code heading", "## `GET /api/x`\n\nText.\n", "## `GET /api/x`\n\n正文。\n", 0);

pair("correct explicit anchors", en, anchored, 0);

const duplicateSource = "## Notes\n\nA.\n\n## Notes\n\nB.\n";
pair(
  "numbered duplicate anchors",
  duplicateSource,
  '<a id="notes"></a>\n\n## 说明\n\nA。\n\n<a id="notes-1"></a>\n\n## 说明\n\nB。\n',
  0,
);
assert.match(
  pair(
    "unnumbered duplicate anchor",
    duplicateSource,
    '<a id="notes"></a>\n\n## 说明\n\nA。\n\n<a id="notes"></a>\n\n## 说明\n\nB。\n',
    1,
  ),
  /needs <a id="notes-1"><\/a>/,
);

assert.match(
  pair(
    "anchor separated by prose",
    "## Alpha\n\nText.\n",
    '<a id="alpha"></a>\n\n正文。\n\n## 甲\n\n正文。\n',
    1,
  ),
  /heading "甲" needs <a id="alpha"><\/a>/,
);

const fence = "```sh\n# install\npnpm install\n```\n";
pair(
  "headings inside fences",
  `## Setup\n\n${fence}`,
  `<a id="setup"></a>\n\n## 配置\n\n${fence}`,
  0,
);

const mismatch = pair("heading count mismatch", en, "# 页面\n\n## 甲\n\n正文。\n", 1);
assert.match(mismatch, /headings differ from source/);
assert.doesNotMatch(mismatch, /needs <a id=/);

run("repository pairs", root, [], 0);

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
function history(name) {
  const cwd = mkdtempSync(resolve(output, `${name}-`));
  mkdirSync(resolve(cwd, "docs"), { recursive: true });
  git(cwd, "init", "-q", "-b", "main");
  git(cwd, "config", "user.email", "e2e@example.invalid");
  git(cwd, "config", "user.name", "e2e");
  writeFileSync(resolve(cwd, "docs/page.md"), en);
  writeFileSync(resolve(cwd, "docs/page.zh.md"), anchored);
  git(cwd, "add", ".");
  git(cwd, "commit", "-q", "-m", "base");
  git(cwd, "switch", "-q", "-c", "change");
  return cwd;
}
const commit = (cwd) => {
  git(cwd, "add", ".");
  git(cwd, "commit", "-q", "-m", "change");
};
const edited = en.replace("## Beta\n\nText.", "## Beta\n\nNew text.");
const editedZh = anchored.replace("## 乙\n\n正文。", "## 乙\n\n新正文。");

let cwd = history("english-only");
writeFileSync(resolve(cwd, "docs/page.md"), edited);
commit(cwd);
assert.match(
  run("English edit without Chinese edit", cwd, ["--base", "main"], 1),
  /docs\/page\.md: changed since main but docs\/page\.zh\.md was not/,
);

cwd = history("chinese-only");
writeFileSync(resolve(cwd, "docs/page.zh.md"), editedZh);
commit(cwd);
run("Chinese-only edit", cwd, ["--base", "main"], 0);

cwd = history("both");
writeFileSync(resolve(cwd, "docs/page.md"), edited);
writeFileSync(resolve(cwd, "docs/page.zh.md"), editedZh);
commit(cwd);
run("edit to both files", cwd, ["--base", "main"], 0);

cwd = history("whitespace");
writeFileSync(resolve(cwd, "docs/page.md"), en.replace("Text.\n\n## Beta", "Text.  \n\n## Beta"));
commit(cwd);
run("whitespace-only English reflow", cwd, ["--base", "main"], 0);

cwd = history("uncommitted");
writeFileSync(resolve(cwd, "docs/page.md"), edited);
run("uncommitted English edit", cwd, ["--base", "main"], 1);

cwd = history("from-base");
git(cwd, "switch", "-q", "main");
writeFileSync(resolve(cwd, "docs/page.md"), edited);
writeFileSync(resolve(cwd, "docs/page.zh.md"), editedZh);
commit(cwd);
git(cwd, "switch", "-q", "change");
git(cwd, "merge", "-q", "--no-edit", "main");
run("English edit that arrived from the base branch", cwd, ["--base", "main"], 0);

cwd = history("new-page");
writeFileSync(resolve(cwd, "docs/other.md"), "# Other\n\nText.\n");
commit(cwd);
assert.match(
  run("new English page without its pair", cwd, ["--base", "main"], 1),
  /docs\/other\.md: missing docs\/other\.zh\.md/,
);

cwd = history("missing-base");
const skipped = spawnSync(process.execPath, [script, "--root", cwd, "--base", "no-such-ref"], {
  encoding: "utf8",
  timeout: 30000,
});
results.push({
  name: "unavailable base",
  status: skipped.status,
  stdout: skipped.stdout,
  stderr: skipped.stderr,
});
assert.equal(skipped.status, 0, JSON.stringify(skipped));
assert.match(skipped.stdout + skipped.stderr, /no-such-ref.*not available/);

assert.match(
  run("retired --record mode", cwd, ["--record", "docs/page.md"], 1),
  /--record and --remove were retired/,
);

writeFileSync(resolve(output, "summary.json"), JSON.stringify({ failureModes, results }, null, 2));

console.log(`${results.length} CLI cases passed; evidence: ${output}`);
