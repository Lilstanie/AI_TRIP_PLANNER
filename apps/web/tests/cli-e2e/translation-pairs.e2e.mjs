import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  return run(name, cwd, ["--record", "docs/page.md"], expected);
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

console.log(`${results.length} CLI cases passed; evidence: ${output}`);
