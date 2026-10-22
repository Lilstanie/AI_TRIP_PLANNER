#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const usage =
  "usage: node scripts/redgreen.mjs [--base <ref>] <e2e-name> [--prod] -- <source-path>...";
const args = process.argv.slice(2);
let base = "origin/main";
if (args[0] === "--base") [, base] = args.splice(0, 2);
const split = args.indexOf("--");
const [name, ...e2eArgs] = split < 0 ? [] : args.slice(0, split);
const paths = split < 0 ? [] : args.slice(split + 1);

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (!name || !paths.length) fail(usage);

const baseContent = (path) => {
  const result = spawnSync("git", ["show", `${base}:${path}`]);
  return result.status === 0 ? result.stdout : null;
};

const files = paths.map((path) => {
  if (path === `apps/web/tests/e2e/${name}.e2e.mjs`)
    fail(`${path} is the E2E script itself; list only the source it tests.`);
  const current = existsSync(path) ? readFileSync(path) : null;
  const before = baseContent(path);
  if (current === null && before === null) fail(`${path} exists neither in ${base} nor here.`);
  if (current && before && current.equals(before)) fail(`${path} is unchanged from ${base}.`);
  return { path, current, before };
});

const put = (path, content) =>
  content === null ? rmSync(path, { force: true }) : writeFileSync(path, content);
const restore = () => files.forEach(({ path, current }) => put(path, current));

let child;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (child) process.kill(-child.pid, signal);
    restore();
    process.exit(130);
  });

function e2e() {
  const command = process.env.REDGREEN_RUN ?? `DATA_MODE=mock pnpm --filter @trip/web e2e`;
  return new Promise((done) => {
    child = spawn(`${command} ${[name, ...e2eArgs].join(" ")}`, {
      shell: true,
      detached: true,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      process.stdout.write(chunk);
    });
    child.on("close", (code) => {
      const ok = out.match(/^ok /gm)?.length ?? 0;
      const failed = out.match(/^FAIL /gm)?.length ?? 0;
      done({ code, ok, total: ok + failed, passed: code === 0 && failed === 0 });
    });
  });
}

const line = (label, r) =>
  `${label}: exit ${r.code}, ${r.ok}/${r.total} ok (${r.passed ? "passed" : "failed"})`;

let before;
try {
  files.forEach(({ path, before }) => put(path, before));
  before = await e2e();
} finally {
  restore();
}
const after = await e2e();
console.log(`\n${line(`before (${base})`, before)}\n${line("after", after)}`);
if (before.passed) console.log("The check passes without the fix, so it does not expose the bug.");
process.exit(!before.passed && after.passed ? 0 : 1);
