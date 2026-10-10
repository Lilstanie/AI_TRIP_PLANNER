import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../../");
const CLI = resolve(HERE, "../e2e/run.mjs");
const OUTPUT = resolve(ROOT, "output/e2e/local-test-cli-report");
const INVOCATIONS = resolve(ROOT, "output/e2e/local-test-cli");
const fixtureId = `report-test-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const RUN_OUTPUT = resolve(OUTPUT, fixtureId);
mkdirSync(RUN_OUTPUT, { recursive: true });

function writeInvocation(id, summary, evidence = ["evidence/check/result.json"]) {
  const directory = resolve(INVOCATIONS, id);
  mkdirSync(directory, { recursive: true });
  mkdirSync(resolve(directory, "evidence"), { recursive: true });
  for (const relativePath of evidence) {
    const path = resolve(directory, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `saved evidence ${id}\n`);
  }
  const summaryFile = resolve(directory, "summary.json");
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  return {
    summaryFile,
    rootRelativeSummary: summaryFile.slice(ROOT.length + 1),
    evidenceDirectory: `output/e2e/local-test-cli/${id}/evidence/check`,
  };
}

function oneCheck(id, outcome, status, evidenceDirectory) {
  return {
    invocationId: id,
    requested: ["saved-check"],
    outcome,
    reproductionCommand: "pnpm --filter @trip/web e2e run saved-check --dev",
    summaryFile: `output/e2e/local-test-cli/${id}/summary.json`,
    evidenceDirectory: evidenceDirectory.replace(/\/check$/, ""),
    results: [
      {
        scenario: "saved-check",
        status,
        evidenceDirectory,
        diagnostics: "output/e2e/local-test-cli/example/journey.log",
      },
    ],
  };
}

function runCli(args, timeout = 15 * 60_000) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout,
  });
}

function treeDigest(path) {
  const hash = createHash("sha256");
  if (!existsSync(path)) return "missing";
  const visit = (current, relative = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const child = resolve(current, entry.name);
      const name = `${relative}/${entry.name}`;
      hash.update(`${name}:${entry.isDirectory() ? "directory" : "file"}\n`);
      if (entry.isDirectory()) visit(child, name);
      else hash.update(readFileSync(child));
    }
  };
  visit(path);
  return hash.digest("hex");
}

const checks = [];
function check(condition, message) {
  checks.push({ status: condition ? "passed" : "failed", message });
  console.log(`${condition ? "PASS" : "FAIL"} ${message}`);
}

const run = runCli(["run", "agent-lab-single-agent", "--dev", "--json", "--timeout-ms", "300000"]);
check(run.status === 0, "a real local fixture run creates a reportable invocation");
if (run.status === 0) {
  let runResult;
  try {
    runResult = JSON.parse(run.stdout.trim());
  } catch {
    runResult = undefined;
  }
  check(runResult?.outcome === "passed", "the source invocation records a passing journey");
  if (runResult?.summaryFile) {
    const summaryPath = resolve(ROOT, runResult.summaryFile);
    const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
    const beforeSummary = readFileSync(summaryPath);
    const beforeEvidence = treeDigest(resolve(ROOT, summary.evidenceDirectory));
    const byId = runCli(["report", summary.invocationId, "--json"]);
    check(byId.status === 0, "report reads an invocation by ID after its runner has exited");
    let reported;
    try {
      reported = JSON.parse(byId.stdout.trim());
    } catch {
      reported = undefined;
    }
    check(reported?.reportOutcome === "reported", "reading success is distinct from test outcome");
    check(reported?.recordedOutcome === "passed", "report preserves the recorded run outcome");
    check(
      reported?.results?.some((result) => result.status === "passed"),
      "report displays the saved scenario result",
    );
    const byPath = runCli(["report", runResult.summaryFile, "--json"]);
    check(byPath.status === 0, "report accepts the saved root-relative summary path");
    check(
      readFileSync(summaryPath).equals(beforeSummary) &&
        treeDigest(resolve(ROOT, summary.evidenceDirectory)) === beforeEvidence,
      "report leaves the saved summary and browser evidence unchanged",
    );
    writeFileSync(resolve(RUN_OUTPUT, "success-report.json"), byId.stdout);
  } else check(false, "source invocation returns its saved summary path");
}

const failedEvidence = `output/e2e/local-test-cli/${fixtureId}-failed/evidence/check`;
const failedId = `${fixtureId}-failed`;
writeInvocation(failedId, oneCheck(failedId, "failed", "failed", failedEvidence));
const failedReport = runCli(["report", failedId, "--json"]);
const failedJson = JSON.parse(failedReport.stdout.trim());
check(failedReport.status === 0, "reading a saved failed result succeeds as a report operation");
check(failedJson.recordedOutcome === "failed", "report keeps the saved test failure visible");
check(
  failedJson.results?.[0]?.status === "failed",
  "report does not replace a failed scenario status",
);

const partialCoverageId = `${fixtureId}-partial-coverage`;
const partialCoverageEvidence = `output/e2e/local-test-cli/${partialCoverageId}/evidence/first-check`;
writeInvocation(
  partialCoverageId,
  {
    invocationId: partialCoverageId,
    requested: ["first-check", "second-check"],
    outcome: "passed",
    reproductionCommand: "pnpm --filter @trip/web e2e run first-check second-check --dev",
    summaryFile: `output/e2e/local-test-cli/${partialCoverageId}/summary.json`,
    evidenceDirectory: `output/e2e/local-test-cli/${partialCoverageId}/evidence`,
    results: [
      {
        scenario: "first-check",
        status: "passed",
        evidenceDirectory: partialCoverageEvidence,
        diagnostics: "output/e2e/local-test-cli/example/first-check.log",
      },
    ],
  },
  ["evidence/first-check/result.json"],
);
const partialCoverageReport = runCli(["report", partialCoverageId, "--json"]);
const partialCoverageJson = JSON.parse(partialCoverageReport.stdout.trim());
check(partialCoverageReport.status === 0, "report can inspect a partial saved run");
check(
  partialCoverageJson.recordStatus === "incomplete",
  "missing a requested result makes recorded coverage incomplete",
);
check(
  partialCoverageJson.requested.length === 2 && partialCoverageJson.results.length === 1,
  "report preserves the requested and recorded check sets for diagnosis",
);

for (const [label, scenarios] of [
  ["duplicate", ["first-check", "first-check"]],
  ["unrequested", ["first-check", "extra-check"]],
]) {
  const invocationId = `${fixtureId}-${label}-coverage`;
  const results = scenarios.map((scenario) => ({
    scenario,
    status: "passed",
    evidenceDirectory: `output/e2e/local-test-cli/${invocationId}/evidence/${scenario}`,
    diagnostics: "output/e2e/local-test-cli/example/check.log",
  }));
  writeInvocation(
    invocationId,
    {
      invocationId,
      requested: ["first-check", "second-check"],
      outcome: "passed",
      reproductionCommand: "saved command",
      evidenceDirectory: `output/e2e/local-test-cli/${invocationId}/evidence`,
      results,
    },
    [...new Set(scenarios)].map((scenario) => `evidence/${scenario}/result.json`),
  );
  const coverageReport = runCli(["report", invocationId, "--json"]);
  const coverageJson = JSON.parse(coverageReport.stdout.trim());
  check(coverageReport.status === 0, `report can inspect ${label} result coverage`);
  check(
    coverageJson.recordStatus === "incomplete",
    `${label} result coverage cannot satisfy different requested journeys`,
  );
}

const firstId = `${fixtureId}-attempt-1`;
const secondId = `${fixtureId}-attempt-2`;
const firstEvidence = `output/e2e/local-test-cli/${firstId}/evidence/check`;
const secondEvidence = `output/e2e/local-test-cli/${secondId}/evidence/check`;
const first = writeInvocation(firstId, oneCheck(firstId, "failed", "failed", firstEvidence));
const second = writeInvocation(secondId, oneCheck(secondId, "passed", "passed", secondEvidence));
const repeatId = `${fixtureId}-repeat`;
const repeat = {
  recordType: "repeat",
  invocationId: repeatId,
  requested: ["saved-check"],
  requestedRepeatCount: 2,
  completedAttempts: 2,
  remainingAttempts: 0,
  outcome: "failed",
  reproductionCommand: "pnpm --filter @trip/web e2e run saved-check --dev --repeat 2",
  attempts: [
    {
      attempt: 1,
      status: "failed",
      summaryFile: first.rootRelativeSummary,
      evidenceDirectory: firstEvidence,
      reproductionCommand: "pnpm --filter @trip/web e2e run saved-check --dev",
    },
    {
      attempt: 2,
      status: "passed",
      summaryFile: second.rootRelativeSummary,
      evidenceDirectory: secondEvidence,
      reproductionCommand: "pnpm --filter @trip/web e2e run saved-check --dev",
    },
  ],
};
writeInvocation(repeatId, repeat, []);
const repeatReport = runCli(["report", repeatId, "--json"]);
const repeatJson = JSON.parse(repeatReport.stdout.trim());
check(repeatReport.status === 0, "report reads a saved repeat record");
check(repeatJson.recordType === "repeat", "report identifies repeat records");
check(repeatJson.attempts?.length === 2, "report includes every repeat attempt");
check(
  repeatJson.attempts?.[0]?.recordedOutcome === "failed" &&
    repeatJson.attempts?.[1]?.recordedOutcome === "passed" &&
    repeatJson.recordedOutcome === "failed",
  "a later passing attempt does not hide the earlier failure",
);

const missingEvidenceId = `${fixtureId}-missing-evidence`;
const missingEvidencePath = `output/e2e/local-test-cli/${missingEvidenceId}/evidence/check`;
writeInvocation(
  missingEvidenceId,
  oneCheck(missingEvidenceId, "passed", "passed", missingEvidencePath),
  [],
);
const missingEvidenceReport = runCli(["report", missingEvidenceId, "--json"]);
const missingEvidenceJson = JSON.parse(missingEvidenceReport.stdout.trim());
check(
  missingEvidenceReport.status === 0,
  "a valid record remains reportable when its evidence is gone",
);
check(
  missingEvidenceJson.recordStatus === "incomplete",
  "missing evidence makes coverage incomplete",
);
check(
  missingEvidenceJson.results?.[0]?.evidenceStatus === "missing",
  "report calls out missing evidence instead of claiming it is available",
);

const incompleteId = `${fixtureId}-incomplete`;
const incomplete = writeInvocation(
  incompleteId,
  {
    recordType: "repeat",
    invocationId: incompleteId,
    requested: ["saved-check"],
    requestedRepeatCount: 2,
    completedAttempts: 0,
    remainingAttempts: 1,
    outcome: "interrupted",
    attempts: [{ attempt: 1, status: "running", reproductionCommand: "saved command" }],
  },
  [],
);
const incompleteReport = runCli(["report", incomplete.rootRelativeSummary, "--json"]);
const incompleteJson = JSON.parse(incompleteReport.stdout.trim());
check(incompleteReport.status === 0, "an interrupted invocation can still be inspected");
check(
  incompleteJson.recordStatus === "incomplete",
  "interrupted records are explicitly incomplete",
);
check(
  incompleteJson.attempts?.[0]?.status === "running",
  "incomplete attempt status is retained without inventing a pass",
);

const missing = runCli(["report", `${fixtureId}-absent`, "--json"]);
check(missing.status !== 0, "an unknown invocation returns nonzero");
check(
  JSON.parse(missing.stdout.trim()).reportOutcome === "failed",
  "unknown invocation has parseable JSON error",
);
const malformedId = `${fixtureId}-malformed`;
const malformedDirectory = resolve(INVOCATIONS, malformedId);
mkdirSync(malformedDirectory, { recursive: true });
writeFileSync(resolve(malformedDirectory, "summary.json"), `PRIVATE_SENTINEL_${fixtureId} {`);
const malformed = runCli(["report", malformedId, "--json"]);
check(malformed.status !== 0, "malformed saved JSON returns nonzero");
check(
  !`${malformed.stdout}\n${malformed.stderr}`.includes(`PRIVATE_SENTINEL_${fixtureId}`),
  "malformed input never echoes saved file contents",
);
const outside = runCli(["report", resolve(RUN_OUTPUT, "success-report.json"), "--json"]);
check(outside.status !== 0, "a summary outside the invocation directory is rejected");
const noncanonical = runCli([
  "report",
  `${INVOCATIONS}/${failedId}/../${failedId}/summary.json`,
  "--json",
]);
check(noncanonical.status !== 0, "a path containing traversal segments is rejected");

const unchangedSummary = run?.status === 0 ? run.stdout.trim() : "";
check(
  !`${failedReport.stdout}\n${failedReport.stderr}\n${repeatReport.stdout}\n${repeatReport.stderr}`.includes(
    "PRIVATE_SENTINEL",
  ) && unchangedSummary.includes("summaryFile"),
  "valid reporting reads saved metadata without printing unrelated file contents",
);

writeFileSync(
  resolve(RUN_OUTPUT, "summary.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2)}\n`,
);
if (checks.some(({ status }) => status === "failed")) process.exitCode = 1;
