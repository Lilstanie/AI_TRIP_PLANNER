import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSelection } from "./runner-plan.mjs";

const root = resolve(import.meta.dirname, "../../../..");
const args = process.argv.slice(2);
let selection;
try {
  const entries = readdirSync(import.meta.dirname, { withFileTypes: true }).filter(
    (entry) => entry.name.endsWith(".e2e.mjs") || entry.name === "report-cli.mjs",
  );
  if (entries.some((entry) => !entry.isFile()))
    throw new Error("Acceptance inventory must contain regular files");
  const discoveredScripts = entries.map((entry) => entry.name).sort();
  selection = loadSelection(args, discoveredScripts);
} catch (error) {
  console.error(`CLI acceptance: ${error.message}`);
  process.exit(1);
}
const { scripts } = selection;
const reports = resolve(root, "output/e2e/cli-acceptance");
mkdirSync(reports, { recursive: true });
const out = mkdtempSync(resolve(reports, `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-`));
mkdirSync(resolve(root, "output/e2e/local-test-cli"), { recursive: true });
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const retainedPlan = resolve(out, "plan.json");
if (selection.plan) writeFileSync(retainedPlan, `${JSON.stringify(selection.plan, null, 2)}\n`);
const results = scripts.map((script) => ({ script, status: "not_run" }));
const summary = {
  reproductionCommand:
    "node apps/web/tests/cli-e2e/run.mjs" +
    (selection.plan ? ` --plan ${quote(retainedPlan)} --shard ${quote(selection.shard)}` : ""),
  mode: selection.plan?.mode ?? "full",
  shard: selection.shard ?? null,
  sourcePlan: selection.planPath ?? null,
  plan: selection.plan ?? null,
  outcome: "running",
  results,
};
const save = () =>
  writeFileSync(resolve(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
save();
let active;
let interrupted = false;
let escalation;
const stop = (child, signal) => {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") child.kill(signal);
  }
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    summary.interruptionSignal = signal;
    save();
    stop(active, signal);
    if (active && !escalation) {
      const child = active;
      escalation = setTimeout(() => stop(child, "SIGKILL"), 1000);
    }
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
    detached: process.platform !== "win32",
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
  clearTimeout(escalation);
  escalation = undefined;
  if (interrupted) stop(child, "SIGKILL");
  active = undefined;
  await new Promise((done) => log.end(done));
  Object.assign(result, exit, {
    durationMs: Date.now() - started,
    status: interrupted || exit.signal ? "interrupted" : exit.code === 0 ? "passed" : "failed",
  });
  save();
  if (result.status !== "passed") break;
}
summary.outcome =
  interrupted || results.some((result) => result.status === "interrupted")
    ? "interrupted"
    : results.every((result) => result.status === "passed")
      ? "passed"
      : "failed";
save();
console.log(`CLI acceptance ${summary.outcome}: ${out}/summary.json`);
process.exitCode = summary.outcome === "passed" ? 0 : 1;
