import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureIdentity,
  createRepeatOwnershipRecord,
  writeOwnershipRecord,
} from "./resource-ownership.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const ROOT = resolve(WEB, "../..");
const ROOT_OUTPUT = resolve(ROOT, "output/e2e/local-test-cli");
const CLI = resolve(HERE, "run.mjs");
const CHILD_SUMMARY_PATH =
  /^output\/e2e\/local-test-cli\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+-[a-z0-9]{6})\/summary\.json$/;

function invocationId() {
  return `repeat-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseRepeat(args) {
  const optionIndex = args.indexOf("--repeat");
  if (optionIndex < 0) throw new Error("--repeat requires a positive whole number");
  const rawCount = args[optionIndex + 1];
  if (!rawCount || !/^\d+$/.test(rawCount))
    throw new Error("--repeat requires a positive whole number");
  const repeatCount = Number(rawCount);
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1)
    throw new Error("--repeat requires a positive whole number");
  const childArgs = args.filter((_, index) => index !== optionIndex && index !== optionIndex + 1);
  if (args.lastIndexOf("--repeat") !== optionIndex)
    throw new Error("run accepts one --repeat option");
  return { repeatCount, childArgs };
}

function writeSummary(directory, summary) {
  const summaryFile = resolve(directory, "summary.json");
  summary.summaryFile = summaryFile.slice(ROOT.length + 1);
  summary.evidenceDirectory = resolve(directory, "evidence").slice(ROOT.length + 1);
  const pending = `${summaryFile}.tmp`;
  writeFileSync(pending, `${JSON.stringify(summary, null, 2)}\n`);
  renameSync(pending, summaryFile);
  return summary;
}

function outputResult(result, json) {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    console.log(`Local E2E repeat ${result.outcome}: ${result.requestedRepeatCount} attempts`);
    console.log(`Summary: ${result.summaryFile}`);
    if (result.diagnostic) console.log(`Details: ${result.diagnostic}`);
  }
}

function childEnvironment() {
  return { ...process.env };
}

function runChild(args, logPath, onSpawn) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CLI, "run", ...args], {
      cwd: ROOT,
      env: childEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    onSpawn(child);
    const log = (chunk) => appendFileSync(logPath, chunk);
    child.stdout.on("data", log);
    child.stderr.on("data", log);
    child.once("error", (error) => done({ code: 1, error: error.message }));
    child.once("close", (code, signal) => done({ code: code ?? 1, signal }));
  });
}

function childResult(logPath) {
  if (!existsSync(logPath)) return undefined;
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const result = JSON.parse(lines[index]);
      if (result.summaryFile && result.outcome) return result;
    } catch {}
  }
  return undefined;
}

function readChildSummary(result) {
  if (!result?.summaryFile) return undefined;
  try {
    return JSON.parse(readFileSync(resolve(ROOT, result.summaryFile), "utf8"));
  } catch {
    return undefined;
  }
}

function normalizeChildOutcome(exitCode, result, summary) {
  const outcome = summary?.outcome ?? result?.outcome ?? "failed";
  return outcome === "passed" && exitCode !== 0 ? "failed" : outcome;
}

function exitCode(outcome) {
  return outcome === "passed" ? 0 : outcome === "unsupported" || outcome === "blocked" ? 2 : 1;
}

export async function runLocalRepeatCli(args) {
  let parsed;
  try {
    parsed = parseRepeat(args);
  } catch (error) {
    const result = {
      outcome: "unsupported",
      requested: [],
      results: [],
      diagnostic: error.message,
    };
    outputResult(result, args.includes("--json"));
    return 2;
  }

  const json = args.includes("--json");
  const id = invocationId();
  const directory = resolve(ROOT_OUTPUT, id);
  mkdirSync(resolve(directory, "evidence"), { recursive: true });
  const command = `pnpm --filter @trip/web e2e run ${parsed.childArgs.join(" ")}`;
  const summary = {
    schemaVersion: 1,
    recordType: "repeat",
    invocationId: id,
    startedAt: new Date().toISOString(),
    requested: [],
    requestedRepeatCount: parsed.repeatCount,
    reproductionCommand: `${command} --repeat ${parsed.repeatCount}`,
    attempts: [],
    results: [],
    completedAttempts: 0,
    remainingAttempts: parsed.repeatCount,
  };
  let activeChild;
  let interrupted = false;
  let interruptSignal;
  const onSignal = (signal) => {
    interrupted = true;
    interruptSignal = signal;
    if (activeChild?.pid) {
      try {
        activeChild.kill(signal);
      } catch {}
    }
  };
  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [signal, () => onSignal(signal)]),
  );
  for (const [signal, handler] of signalHandlers) process.on(signal, handler);
  let outcome = "passed";
  let diagnostic;
  writeSummary(directory, summary);

  try {
    for (let index = 0; index < parsed.repeatCount; index += 1) {
      if (interrupted) break;
      summary.attempts.push({
        attempt: index + 1,
        status: "running",
        reproductionCommand: command,
      });
      const startedAttempt = summary.attempts.at(-1);
      startedAttempt.startedAt = new Date().toISOString();
      const logPath = resolve(directory, `attempt-${index + 1}.log`);
      summary.remainingAttempts = parsed.repeatCount - summary.attempts.length;
      writeSummary(directory, summary);
      const childArgs = parsed.childArgs.includes("--json")
        ? parsed.childArgs
        : [...parsed.childArgs, "--json"];
      const child = await runChild(childArgs, logPath, (spawned) => {
        activeChild = spawned;
      });
      activeChild = undefined;
      startedAttempt.completedAt = new Date().toISOString();
      startedAttempt.exitCode = child.code;
      startedAttempt.signal = child.signal ?? null;
      startedAttempt.diagnostics = logPath.slice(ROOT.length + 1);
      if (child.error) startedAttempt.diagnostic = child.error;
      const childOutput = childResult(logPath);
      const childSummary = readChildSummary(childOutput);
      if (index === 0) summary.requested = childSummary?.requested ?? childOutput?.requested ?? [];
      startedAttempt.status = interrupted
        ? "interrupted"
        : normalizeChildOutcome(child.code, childOutput, childSummary);
      if (childSummary?.summaryFile) startedAttempt.summaryFile = childSummary.summaryFile;
      if (childSummary?.evidenceDirectory)
        startedAttempt.evidenceDirectory = childSummary.evidenceDirectory;
      startedAttempt.reproductionCommand = childSummary?.reproductionCommand ?? command;
      if (startedAttempt.status === "running") startedAttempt.status = "failed";
      if (startedAttempt.status !== "passed" && outcome === "passed")
        outcome = startedAttempt.status;
      if (interrupted) {
        outcome = "interrupted";
        diagnostic = `Interrupted by ${interruptSignal}; completed attempt records and available evidence are retained.`;
      }
      summary.completedAttempts = summary.attempts.filter(
        (item) => item.status !== "running",
      ).length;
      summary.remainingAttempts = parsed.repeatCount - summary.attempts.length;
      summary.results = summary.attempts.map((item) => ({ ...item }));
      summary.outcome = outcome;
      summary.completedAt = new Date().toISOString();
      if (diagnostic) summary.diagnostic = diagnostic;
      writeSummary(directory, summary);
    }
  } catch (error) {
    outcome = interrupted ? "interrupted" : "failed";
    diagnostic = `${error.message}; repeat evidence is retained.`;
  } finally {
    if (activeChild?.pid) {
      try {
        activeChild.kill("SIGTERM");
      } catch {}
    }
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  }

  for (const attempt of summary.attempts) {
    if (attempt.status === "running") attempt.status = interrupted ? "interrupted" : "failed";
  }
  summary.completedAttempts = summary.attempts.filter((item) => item.status !== "running").length;
  summary.remainingAttempts = parsed.repeatCount - summary.attempts.length;
  summary.results = summary.attempts.map((item) => ({ ...item }));
  summary.outcome = outcome;
  summary.completedAt = new Date().toISOString();
  if (diagnostic) summary.diagnostic = diagnostic;
  const saved = writeSummary(directory, summary);
  const children = saved.attempts.map((attempt) => {
    if (!attempt.summaryFile) return null;
    try {
      const match = CHILD_SUMMARY_PATH.exec(attempt.summaryFile);
      if (!match || match[0] !== attempt.summaryFile) return null;
      const childId = match[1];
      const childSummaryPath = resolve(ROOT_OUTPUT, childId, "summary.json");
      const childOwnershipPath = resolve(ROOT_OUTPUT, childId, "ownership.json");
      const childSummary = JSON.parse(readFileSync(childSummaryPath, "utf8"));
      if (childSummary.invocationId !== childId || childSummary.recordType !== "run") return null;
      return {
        invocationId: childId,
        summaryFile: attempt.summaryFile,
        summaryIdentity: captureIdentity(childSummaryPath, "file"),
        ownershipIdentity: captureIdentity(childOwnershipPath, "file"),
      };
    } catch {
      return null;
    }
  });
  if (children.some((child) => !child)) {
    diagnostic = "One or more repeat attempts have no finalized child ownership record.";
    outcome = interrupted ? "interrupted" : "failed";
    summary.outcome = outcome;
    summary.diagnostic = diagnostic;
    writeSummary(directory, summary);
  }
  const ownerRecord = createRepeatOwnershipRecord({
    invocationId: id,
    createdAt: summary.startedAt,
    directoryIdentity: captureIdentity(directory, "directory"),
    evidenceIdentity: captureIdentity(resolve(directory, "evidence"), "directory"),
    summaryIdentity: captureIdentity(resolve(directory, "summary.json"), "file"),
    children,
  });
  writeOwnershipRecord(directory, ownerRecord);
  outputResult(
    {
      outcome,
      requested: saved.requested,
      requestedRepeatCount: saved.requestedRepeatCount,
      attempts: saved.attempts,
      results: saved.results,
      summaryFile: saved.summaryFile,
      evidenceDirectory: saved.evidenceDirectory,
      ...(diagnostic ? { diagnostic } : {}),
    },
    json,
  );
  return exitCode(outcome);
}
