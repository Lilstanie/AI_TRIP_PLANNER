import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const CLI = resolve(ROOT, "apps/web/tests/e2e/run.mjs");
const PREFIX = `report-interrupted-${Date.now()}-${process.pid}`;
const OUTPUT = resolve(ROOT, "output/e2e/report-interrupted-acceptance", PREFIX);
mkdirSync(OUTPUT, { recursive: true });
const checks = [];
const commands = [];
function save(suffix, outcome, status = outcome) {
  const invocationId = `${PREFIX}-${suffix}`;
  const directory = resolve(ROOT, "output/e2e/local-test-cli", invocationId);
  const evidenceDirectory = `${directory}/evidence/check`;
  mkdirSync(evidenceDirectory, { recursive: true });
  writeFileSync(resolve(evidenceDirectory, "result.json"), '{"fixture":true}\n');
  const summary = {
    invocationId,
    requested: ["check"],
    outcome,
    results: [{ scenario: "check", status, evidenceDirectory }],
  };
  const summaryFile = resolve(directory, "summary.json");
  writeFileSync(summaryFile, `${JSON.stringify(summary)}\n`);
  return { summary, summaryFile, evidenceDirectory };
}
function report(record) {
  const before = readFileSync(record.summaryFile, "utf8");
  const args = [CLI, "report", record.summaryFile, "--json"];
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8", timeout: 10000 });
  commands.push({
    command: [process.execPath, ...args],
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(record.summaryFile, "utf8"), before);
  return JSON.parse(result.stdout);
}
function check(message, action) {
  try {
    action();
    checks.push({ message, status: "passed" });
  } catch (error) {
    checks.push({ message, status: "failed", diagnostic: error.message });
  }
}
const interrupted = save("child", "interrupted");
const passed = save("passed", "passed");
check("finalized interrupted run with evidence remains incomplete and preserves outcome", () => {
  const result = report(interrupted);
  assert.equal(result.recordStatus, "incomplete");
  assert.equal(result.recordedOutcome, "interrupted");
  assert.equal(result.results[0].status, "interrupted");
  assert.equal(result.results[0].evidenceStatus, "available");
});
check("interrupted run outcome cannot be hidden by a finalized passing result", () => {
  assert.equal(report(save("outcome-only", "interrupted", "passed")).recordStatus, "incomplete");
});
for (const variant of ["child", "attempt", "parent"]) {
  check(`${variant} interruption before a later pass leaves repeat coverage incomplete`, () => {
    const repeat = save(`repeat-${variant}`, variant === "parent" ? "interrupted" : "failed");
    Object.assign(repeat.summary, {
      recordType: "repeat",
      requestedRepeatCount: 2,
      completedAttempts: 2,
      remainingAttempts: 0,
      attempts: [
        {
          attempt: 1,
          status: variant === "parent" ? "passed" : "interrupted",
          summaryFile: variant === "child" ? interrupted.summaryFile : passed.summaryFile,
          evidenceDirectory:
            variant === "child" ? interrupted.evidenceDirectory : passed.evidenceDirectory,
        },
        {
          attempt: 2,
          status: "passed",
          summaryFile: passed.summaryFile,
          evidenceDirectory: passed.evidenceDirectory,
        },
      ],
    });
    writeFileSync(repeat.summaryFile, `${JSON.stringify(repeat.summary)}\n`);
    const result = report(repeat);
    assert.equal(result.recordStatus, "incomplete");
    assert.equal(result.recordedOutcome, repeat.summary.outcome);
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[1].recordedOutcome, "passed");
  });
}
for (const status of ["passed", "failed"]) {
  check(`finalized ${status} coverage stays complete and report reads successfully`, () => {
    const result = report(save(`control-${status}`, status));
    assert.equal(result.recordStatus, "complete");
    assert.equal(result.recordedOutcome, status);
  });
}
writeFileSync(
  resolve(OUTPUT, "summary.json"),
  `${JSON.stringify({ command: "node apps/web/tests/cli-e2e/report-interrupted.e2e.mjs", commands, checks }, null, 2)}\n`,
);
console.log(JSON.stringify({ checks, evidenceFile: resolve(OUTPUT, "summary.json") }));
if (checks.some((check) => check.status === "failed")) process.exitCode = 1;
