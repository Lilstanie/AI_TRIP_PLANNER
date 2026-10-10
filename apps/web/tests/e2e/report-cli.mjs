import { existsSync, lstatSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const ROOT = resolve(WEB, "../..");
const INVOCATIONS = resolve(ROOT, "output/e2e/local-test-cli");

function parseArgs(args) {
  const values = args.filter((arg) => arg !== "--json");
  if (args.filter((arg) => arg === "--json").length > 1)
    throw new Error("report accepts --json once");
  if (values.length !== 1)
    throw new Error("usage: e2e report <invocation-id-or-summary-file> [--json]");
  return { target: values[0], json: args.includes("--json") };
}

function isWithin(base, target) {
  const path = relative(base, target);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function resolveTarget(target) {
  let summaryFile;
  if (
    target.includes("/") ||
    target.includes("\\") ||
    target.endsWith(".json") ||
    isAbsolute(target)
  ) {
    const candidate = isAbsolute(target) ? resolve(target) : resolve(ROOT, target);
    const canonicalInput = isAbsolute(target) ? candidate : relative(ROOT, candidate);
    if (target !== canonicalInput) throw new Error("summary file path must be canonical");
    if (!isWithin(INVOCATIONS, candidate) || candidate.split(sep).at(-1) !== "summary.json")
      throw new Error(
        "summary file must be a canonical summary.json path under output/e2e/local-test-cli",
      );
    const parts = relative(INVOCATIONS, candidate).split(sep);
    if (parts.length !== 2 || !/^[A-Za-z0-9-]{1,120}$/.test(parts[0]))
      throw new Error("summary file must identify one saved invocation directory");
    summaryFile = candidate;
  } else {
    if (!/^[A-Za-z0-9-]{1,120}$/.test(target)) throw new Error("invocation ID is invalid");
    summaryFile = resolve(INVOCATIONS, target, "summary.json");
  }

  if (!existsSync(summaryFile)) throw new Error("saved invocation summary was not found");
  const summaryStat = lstatSync(summaryFile);
  if (!summaryStat.isFile() || summaryStat.isSymbolicLink())
    throw new Error("saved invocation summary is not a regular file");
  const invocationDirectory = dirname(summaryFile);
  if (lstatSync(INVOCATIONS).isSymbolicLink() || lstatSync(invocationDirectory).isSymbolicLink())
    throw new Error("saved invocation path contains a symbolic link");
  const canonicalInvocations = realpathSync(INVOCATIONS);
  const canonicalDirectory = realpathSync(invocationDirectory);
  const canonicalSummary = realpathSync(summaryFile);
  if (
    !isWithin(canonicalInvocations, canonicalDirectory) ||
    canonicalDirectory !== invocationDirectory ||
    canonicalSummary !== summaryFile
  )
    throw new Error("saved invocation path is not canonical");
  return { summaryFile, invocationId: invocationDirectory.split(sep).at(-1) };
}

function parseSummary(summaryFile, invocationId) {
  let summary;
  try {
    summary = JSON.parse(readFileSync(summaryFile, "utf8"));
  } catch {
    throw new Error("saved invocation summary is malformed JSON");
  }
  if (!summary || typeof summary !== "object" || Array.isArray(summary))
    throw new Error("saved invocation summary must contain a JSON object");
  if (summary.invocationId !== invocationId)
    throw new Error("saved summary invocation ID does not match its directory");
  return summary;
}

function evidenceState(path) {
  if (typeof path !== "string" || path.length === 0) return "not-recorded";
  const candidate = isAbsolute(path) ? resolve(path) : resolve(ROOT, path);
  if (!isWithin(ROOT, candidate)) return "unavailable";
  try {
    const stat = lstatSync(candidate);
    if (stat.isSymbolicLink()) return "unavailable";
    if (!stat.isDirectory()) return "missing";
    const realRoot = realpathSync(ROOT);
    const realCandidate = realpathSync(candidate);
    if (!isWithin(realRoot, realCandidate)) return "unavailable";
    return readdirSync(candidate).length > 0 ? "available" : "empty";
  } catch {
    return "missing";
  }
}

function requestedCoverageMatches(requested, results) {
  if (
    !Array.isArray(requested) ||
    requested.length === 0 ||
    requested.length !== results.length ||
    requested.some((scenario) => typeof scenario !== "string" || scenario.length === 0)
  )
    return false;
  const counts = new Map();
  for (const scenario of requested) counts.set(scenario, (counts.get(scenario) ?? 0) + 1);
  for (const result of results) {
    const scenario = result.scenario;
    const remaining = counts.get(scenario) ?? 0;
    if (remaining === 0) return false;
    if (remaining === 1) counts.delete(scenario);
    else counts.set(scenario, remaining - 1);
  }
  return counts.size === 0;
}

function runDetails(summary) {
  const results = Array.isArray(summary.results)
    ? summary.results.map((result) => ({
        scenario: typeof result?.scenario === "string" ? result.scenario : null,
        status: typeof result?.status === "string" ? result.status : "incomplete",
        evidenceDirectory:
          typeof result?.evidenceDirectory === "string"
            ? result.evidenceDirectory
            : (summary.evidenceDirectory ?? null),
        evidenceStatus: evidenceState(result?.evidenceDirectory ?? summary.evidenceDirectory),
        diagnostics: typeof result?.diagnostics === "string" ? result.diagnostics : null,
      }))
    : [];
  const complete =
    typeof summary.outcome === "string" &&
    requestedCoverageMatches(summary.requested, results) &&
    results.every(
      (result) =>
        result.status !== "incomplete" &&
        result.status !== "running" &&
        result.evidenceStatus === "available",
    );
  return {
    recordStatus: complete ? "complete" : "incomplete",
    recordedOutcome: typeof summary.outcome === "string" ? summary.outcome : null,
    requested: Array.isArray(summary.requested) ? summary.requested : [],
    reproductionCommand:
      typeof summary.reproductionCommand === "string" ? summary.reproductionCommand : null,
    results,
  };
}

function nestedSummary(summaryPath) {
  if (typeof summaryPath !== "string") return undefined;
  try {
    const resolved = resolveTarget(summaryPath);
    const summary = parseSummary(resolved.summaryFile, resolved.invocationId);
    return { ...resolved, summary };
  } catch {
    return undefined;
  }
}

function repeatDetails(summary) {
  const sourceAttempts = Array.isArray(summary.attempts) ? summary.attempts : [];
  let complete =
    Number.isSafeInteger(summary.requestedRepeatCount) &&
    summary.requestedRepeatCount > 0 &&
    sourceAttempts.length === summary.requestedRepeatCount &&
    summary.remainingAttempts === 0 &&
    summary.completedAttempts === sourceAttempts.length &&
    typeof summary.outcome === "string";
  const attempts = sourceAttempts.map((attempt, index) => {
    const child = nestedSummary(attempt?.summaryFile);
    const details = child ? runDetails(child.summary) : undefined;
    const attemptStatus = typeof attempt?.status === "string" ? attempt.status : "incomplete";
    const evidenceDirectory =
      typeof attempt?.evidenceDirectory === "string"
        ? attempt.evidenceDirectory
        : (child?.summary.evidenceDirectory ?? null);
    const evidenceStatus = evidenceState(evidenceDirectory);
    const recordStatus = child ? details.recordStatus : "missing";
    if (
      !child ||
      !details ||
      recordStatus !== "complete" ||
      attemptStatus === "running" ||
      attemptStatus === "incomplete" ||
      evidenceStatus !== "available"
    )
      complete = false;
    return {
      attempt: Number.isSafeInteger(attempt?.attempt) ? attempt.attempt : index + 1,
      status: attemptStatus,
      recordStatus,
      recordedOutcome: child?.summary.outcome ?? attemptStatus,
      reproductionCommand:
        typeof attempt?.reproductionCommand === "string"
          ? attempt.reproductionCommand
          : (details?.reproductionCommand ?? null),
      summaryFile: child
        ? child.summaryFile.slice(ROOT.length + 1)
        : (attempt?.summaryFile ?? null),
      evidenceDirectory,
      evidenceStatus,
      results: details?.results ?? [],
    };
  });
  return {
    recordStatus: complete ? "complete" : "incomplete",
    recordedOutcome: typeof summary.outcome === "string" ? summary.outcome : null,
    requested: Array.isArray(summary.requested) ? summary.requested : [],
    requestedRepeatCount: Number.isSafeInteger(summary.requestedRepeatCount)
      ? summary.requestedRepeatCount
      : null,
    completedAttempts: Number.isSafeInteger(summary.completedAttempts)
      ? summary.completedAttempts
      : null,
    remainingAttempts: Number.isSafeInteger(summary.remainingAttempts)
      ? summary.remainingAttempts
      : null,
    reproductionCommand:
      typeof summary.reproductionCommand === "string" ? summary.reproductionCommand : null,
    attempts,
  };
}

function makeReport(summary, summaryFile, invocationId) {
  const recordType =
    summary.recordType === undefined || summary.recordType === "run"
      ? "run"
      : summary.recordType === "repeat"
        ? "repeat"
        : "unknown";
  const details = recordType === "repeat" ? repeatDetails(summary) : runDetails(summary);
  if (recordType === "unknown") details.recordStatus = "incomplete";
  return {
    command: "report",
    reportOutcome: "reported",
    ...details,
    recordType,
    invocationId,
    summaryFile: summaryFile.slice(ROOT.length + 1),
  };
}

function output(report, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  console.log(`Local E2E report: ${report.recordStatus.toUpperCase()}`);
  console.log(`Test outcome: ${report.recordedOutcome ?? "unavailable"}`);
  console.log(`Invocation: ${report.invocationId}`);
  if (report.reproductionCommand) console.log(`Reproduce: ${report.reproductionCommand}`);
  if (report.recordType === "repeat") {
    for (const attempt of report.attempts) {
      console.log(`  attempt ${attempt.attempt}: ${attempt.status} (${attempt.recordStatus})`);
      for (const result of attempt.results) {
        console.log(`    ${result.status} ${result.scenario ?? "unnamed check"}`);
        console.log(
          `    evidence ${result.evidenceStatus}: ${result.evidenceDirectory ?? "not recorded"}`,
        );
      }
    }
  } else {
    for (const result of report.results) {
      console.log(`  ${result.status} ${result.scenario ?? "unnamed check"}`);
      console.log(
        `  evidence ${result.evidenceStatus}: ${result.evidenceDirectory ?? "not recorded"}`,
      );
    }
  }
}

export function reportLocalCli(args) {
  let options;
  try {
    options = parseArgs(args);
    const { summaryFile, invocationId } = resolveTarget(options.target);
    const summary = parseSummary(summaryFile, invocationId);
    output(makeReport(summary, summaryFile, invocationId), options.json);
    return 0;
  } catch (error) {
    const json = args.includes("--json");
    const failure = {
      command: "report",
      reportOutcome: "failed",
      diagnostic: error instanceof Error ? error.message : "unable to read saved invocation",
    };
    if (json) process.stdout.write(`${JSON.stringify(failure)}\n`);
    else {
      console.error("Local E2E report: FAILED");
      console.error(failure.diagnostic);
    }
    return 1;
  }
}
