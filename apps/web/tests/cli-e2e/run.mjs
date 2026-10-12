import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../..");
const out = resolve(
  root,
  "output/e2e/cli-acceptance",
  new Date().toISOString().replaceAll(/[:.]/g, "-"),
);
mkdirSync(out, { recursive: true });
mkdirSync(resolve(root, "output/e2e/local-test-cli"), { recursive: true });
const scripts = readdirSync(import.meta.dirname)
  .filter((name) => name.endsWith(".e2e.mjs") || name === "report-cli.mjs")
  .sort();
const results = scripts.map((script) => ({ script, status: "not_run" }));
const summary = {
  reproductionCommand: "node apps/web/tests/cli-e2e/run.mjs",
  outcome: "running",
  results,
};
const save = () =>
  writeFileSync(resolve(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
save();
let active;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    active?.kill(signal);
  });
for (const result of results) {
  if (interrupted) break;
  console.log(`CLI acceptance: ${result.script}`);
  const started = Date.now();
  const logPath = resolve(out, `${result.script}.log`);
  const log = createWriteStream(logPath);
  result.status = "running";
  result.log = logPath.slice(root.length + 1);
  save();
  const child = spawn(process.execPath, [resolve(import.meta.dirname, result.script)], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  active = child;
  child.stdout.on("data", (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    log.write(chunk);
    process.stderr.write(chunk);
  });
  const exit = await new Promise((done) => {
    child.once("error", (error) => done({ code: 1, error: error.message }));
    child.once("close", (code, signal) => done({ code: code ?? 1, signal }));
  });
  active = undefined;
  await new Promise((done) => log.end(done));
  Object.assign(result, exit, {
    durationMs: Date.now() - started,
    status: interrupted ? "interrupted" : exit.code === 0 ? "passed" : "failed",
  });
  save();
  if (result.status !== "passed") break;
}
summary.outcome = interrupted
  ? "interrupted"
  : results.every((result) => result.status === "passed")
    ? "passed"
    : "failed";
save();
console.log(`CLI acceptance ${summary.outcome}: ${out}/summary.json`);
process.exitCode = summary.outcome === "passed" ? 0 : 1;
