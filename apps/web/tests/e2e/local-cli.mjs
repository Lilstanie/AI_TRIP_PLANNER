import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SMOKE_JOURNEYS, SUPPORTED_JOURNEYS } from "./local-cli-collections.mjs";
import {
  canonicalResources,
  captureIdentity,
  createRunOwnershipRecord,
  writeOwnershipRecord,
} from "./resource-ownership.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const ROOT = resolve(WEB, "../..");
const NEXT = resolve(WEB, "node_modules/.bin/next");
const ROOT_OUTPUT = resolve(ROOT, "output/e2e/local-test-cli");
const SUPPORTED = new Set(SUPPORTED_JOURNEYS);
const CREDENTIALS = [
  "DEEPSEEK_API_KEY",
  "MINIMAX_API_KEY",
  "MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID",
  "SERPAPI_KEY",
  "WEATHER_API_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const START_TIMEOUT_MS = 5 * 60_000;

function parseOptions(args) {
  const options = { mode: "production", json: false, timeoutMs: DEFAULT_TIMEOUT_MS, scripts: [] };
  let all = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--dev") options.mode = "development";
    else if (arg === "--all") all = true;
    else if (arg === "--timeout-ms") {
      const timeout = Number(args[index + 1]);
      if (!Number.isInteger(timeout) || timeout < 1000)
        throw new Error("--timeout-ms must be a whole number of at least 1000");
      options.timeoutMs = timeout;
      options.timeoutProvided = true;
      index += 1;
    } else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else options.scripts.push(arg.replace(/\.e2e\.mjs$/, ""));
  }
  if (all && options.scripts.length) throw new Error("--all cannot be combined with script names");
  if (new Set(options.scripts).size !== options.scripts.length)
    throw new Error("run accepts each script name once");
  if (all) {
    options.scripts = SUPPORTED_JOURNEYS;
    options.selectionMode = "all";
  } else if (options.scripts.length === 0) {
    options.scripts = SMOKE_JOURNEYS;
    options.selectionMode = "smoke";
  } else options.selectionMode = "named";
  return options;
}

function inheritedRuntimeEnv() {
  const env = {};
  for (const name of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "CI",
    "LANG",
    "LC_ALL",
    "TZ",
    "TERM",
    "SystemRoot",
  ]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  for (const name of CREDENTIALS) env[name] = "";
  return env;
}

function fixtureEnv({ port, distDir, evidenceDirectory, mode, tsconfigPath }) {
  return {
    ...inheritedRuntimeEnv(),
    NODE_ENV: mode === "production" ? "production" : "development",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(port),
    NEXT_DIST_DIR: distDir,
    NEXT_TSCONFIG_PATH: tsconfigPath,
    USE_MOCK_TOOLS: "true",
    MAPS_PROVIDER: "osm",
    AGENT_LAB_LIVE_ENABLED: "false",
    AGENT_LAB_LIVE_MAX_CONCURRENT: "0",
    AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR: "0",
    ...(evidenceDirectory ? { E2E_OUTPUT_DIR: evidenceDirectory } : {}),
  };
}

function portAvailable() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolvePort(port));
    });
  });
}

function signalGroup(child, signal) {
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}

function groupAlive(child) {
  if (!child?.pid) return false;
  try {
    process.kill(process.platform === "win32" ? child.pid : -child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function terminateGroup(child, graceMs = 5000) {
  if (!child) return { cancel() {}, done: Promise.resolve() };
  if (child.termination) return child.termination;
  signalGroup(child, "SIGTERM");
  let canceled = false;
  let resolveDone;
  const done = new Promise((resolveDonePromise) => {
    resolveDone = resolveDonePromise;
  });
  const cancel = () => {
    if (canceled) return;
    canceled = true;
    clearTimeout(escalation);
    clearInterval(monitor);
    child.termination = undefined;
    resolveDone();
  };
  const escalation = setTimeout(() => {
    if (groupAlive(child)) {
      signalGroup(child, "SIGKILL");
      setTimeout(cancel, 1000);
    } else cancel();
  }, graceMs);
  const monitor = setInterval(() => {
    if (!groupAlive(child)) cancel();
  }, 100);
  child.termination = { cancel, done };
  return child.termination;
}

function execute(command, args, { cwd, env, logPath, timeoutMs, onSpawn }) {
  return new Promise((done) => {
    const log = (chunk) => appendFileSync(logPath, chunk);
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    onSpawn?.(child);
    child.stdout.on("data", log);
    child.stderr.on("data", log);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      terminateGroup(child);
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      done({ code: 1, error: error.message, timedOut });
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      const finish = () => done({ code: timedOut ? 124 : (code ?? 1), signal, timedOut });
      if (groupAlive(child)) terminateGroup(child).done.then(finish);
      else {
        child.termination?.cancel();
        finish();
      }
    });
  });
}

function startOwnedServer({ port, mode, distDir, logPath, tsconfigPath }) {
  const child = spawn(
    NEXT,
    [mode === "production" ? "start" : "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: WEB,
      env: fixtureEnv({ port, distDir, mode, tsconfigPath }),
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let readinessOutput = "";
  const capture = (chunk) => {
    appendFileSync(logPath, chunk);
    readinessOutput = `${readinessOutput}${String(chunk)}`.slice(-128);
    if (readinessOutput.includes("Ready in")) child.serverReady = true;
  };
  child.once("error", (error) => {
    child.spawnError = error;
    appendFileSync(logPath, `\n${error.stack ?? error.message}\n`);
  });
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return child;
}

async function waitUntilReady(child, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.spawnError)
      return { ready: false, reason: `server could not start: ${child.spawnError.message}` };
    if (child.exitCode !== null || child.signalCode !== null)
      return { ready: false, reason: `server exited (${child.exitCode ?? child.signalCode})` };
    if (child.serverReady) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (response.status < 500) return { ready: true };
      } catch {}
    }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  return { ready: false, reason: `server did not answer within ${timeoutMs}ms` };
}

async function stopOwned(child) {
  if (!child || !groupAlive(child)) return;
  await terminateGroup(child).done;
}

function invocationId() {
  return `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function writeSummary(directory, summary) {
  const summaryFile = resolve(directory, "summary.json");
  summary.summaryFile = summaryFile.slice(ROOT.length + 1);
  summary.evidenceDirectory = resolve(directory, "evidence").slice(ROOT.length + 1);
  writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

function outputResult(result, json) {
  if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else {
    console.log(`Local E2E ${result.outcome}: ${result.requested.join(", ")}`);
    console.log(`Summary: ${result.summaryFile}`);
    if (result.diagnostic) console.log(`Details: ${result.diagnostic}`);
  }
}

function aggregateStatus(results) {
  const statuses = results.map((result) => result.status);
  if (statuses.includes("interrupted")) return "interrupted";
  if (statuses.includes("timed_out")) return "timed_out";
  if (statuses.includes("startup_failed")) return "startup_failed";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("unsupported")) return "unsupported";
  return statuses.length > 0 && statuses.every((status) => status === "passed")
    ? "passed"
    : "failed";
}

export async function runLocalCli(args) {
  let options;
  try {
    options = parseOptions(args);
  } catch (error) {
    const json = args.includes("--json");
    outputResult(
      { outcome: "unsupported", requested: [], results: [], diagnostic: error.message },
      json,
    );
    return 2;
  }

  const id = invocationId();
  const directory = resolve(ROOT_OUTPUT, id);
  const evidenceDirectory = resolve(directory, "evidence");
  const journeyEvidenceDirectory = (script) => resolve(evidenceDirectory, script);
  const distDir = `.next-e2e-local-${id}`;
  const tsconfigPath = `.tsconfig-e2e-local-${id}.json`;
  const tsconfigFile = resolve(WEB, tsconfigPath);
  const resourcePaths = canonicalResources(WEB, id);
  const serverLog = resolve(directory, "server.log");
  const buildLog = resolve(directory, "build.log");
  const journeyLog = resolve(directory, "journey.log");
  mkdirSync(evidenceDirectory, { recursive: true });
  const reproductionArgs = ["pnpm", "--filter", "@trip/web", "e2e", "run"];
  if (options.selectionMode === "all") reproductionArgs.push("--all");
  else if (options.selectionMode === "named") reproductionArgs.push(...options.scripts);
  if (options.mode === "development") reproductionArgs.push("--dev");
  if (options.timeoutProvided) reproductionArgs.push("--timeout-ms", String(options.timeoutMs));
  const summary = {
    schemaVersion: 1,
    recordType: "run",
    invocationId: id,
    startedAt: new Date().toISOString(),
    selectionMode: options.selectionMode,
    requested: options.scripts,
    reproductionCommand: reproductionArgs.join(" "),
    server: { mode: options.mode, url: null, port: null, distDir },
    ownedResources: resourcePaths.map(({ kind, path }) => ({ kind, path, state: "not-created" })),
    results: [],
  };
  let server;
  let current;
  let tsconfigCreated = false;
  let tsconfigIdentity;
  let distIdentity;
  let interrupted = false;
  let interruptSignal;
  const onSignal = (signal) => {
    interrupted = true;
    interruptSignal = signal;
    if (current) terminateGroup(current);
    if (server) terminateGroup(server);
  };
  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => [signal, () => onSignal(signal)]),
  );
  for (const [signal, handler] of signalHandlers) process.on(signal, handler);

  let status = "failed";
  let diagnostic;
  const resultsByScript = new Map();
  try {
    const supported = options.scripts.filter((script) => SUPPORTED.has(script));
    for (const script of options.scripts) {
      if (!SUPPORTED.has(script))
        resultsByScript.set(script, {
          scenario: script,
          status: "unsupported",
          diagnostics: `No local fixture journey is registered as supported for ${script}.`,
        });
    }
    if (supported.length === 0) {
      status = "unsupported";
      diagnostic = `No local fixture journey is registered as supported for ${options.scripts.join(", ")}.`;
    } else {
      try {
        createRequire(import.meta.url).resolve("playwright");
        createRequire(import.meta.url).resolve(NEXT);
      } catch {
        status = "blocked";
        diagnostic = "Workspace dependencies are unavailable. Run pnpm install --frozen-lockfile.";
      }
      if (status === "blocked") {
        for (const script of supported)
          resultsByScript.set(script, { scenario: script, status, diagnostics: diagnostic });
      } else {
        if (pathExists(resolve(WEB, distDir)))
          throw new Error(`Invocation build directory already exists: ${distDir}`);
        const tsconfig = JSON.parse(readFileSync(resolve(WEB, "tsconfig.json"), "utf8"));
        tsconfig.include = [...new Set([...tsconfig.include, `${distDir}/types/**/*.ts`])];
        writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`, { flag: "wx" });
        tsconfigCreated = true;
        tsconfigIdentity = captureIdentity(tsconfigFile, "file");
        const port = await portAvailable();
        const url = `http://127.0.0.1:${port}`;
        summary.server.url = url;
        summary.server.port = port;
        if (interrupted) {
          status = "interrupted";
          diagnostic = `Interrupted by ${interruptSignal}; available diagnostics are retained.`;
        } else if (options.mode === "production") {
          const build = await execute(NEXT, ["build"], {
            cwd: WEB,
            env: fixtureEnv({ port, distDir, mode: options.mode, tsconfigPath }),
            logPath: buildLog,
            timeoutMs: START_TIMEOUT_MS,
            onSpawn: (child) => {
              current = child;
            },
          });
          current = undefined;
          if (interrupted) {
            status = "interrupted";
            diagnostic = `Interrupted by ${interruptSignal}; available diagnostics are retained.`;
          } else if (build.code !== 0) {
            status = build.timedOut ? "timed_out" : "startup_failed";
            diagnostic = `Production build failed; see ${buildLog.slice(ROOT.length + 1)}`;
          }
        }
        if (!diagnostic) {
          server = startOwnedServer({
            port,
            mode: options.mode,
            distDir,
            logPath: serverLog,
            tsconfigPath,
          });
          const ready = await waitUntilReady(server, url, START_TIMEOUT_MS);
          if (!ready.ready) {
            status = "startup_failed";
            diagnostic = `${ready.reason}; see ${serverLog.slice(ROOT.length + 1)}`;
          } else {
            for (const script of supported) {
              if (interrupted) break;
              const scriptEvidenceDirectory = journeyEvidenceDirectory(script);
              mkdirSync(scriptEvidenceDirectory, { recursive: true });
              const scriptLog =
                options.scripts.length === 1
                  ? journeyLog
                  : resolve(directory, `journey-${script}.log`);
              writeFileSync(scriptLog, `Starting ${script}\n`);
              current = spawn(process.execPath, [resolve(HERE, `${script}.e2e.mjs`)], {
                cwd: ROOT,
                env: {
                  ...fixtureEnv({
                    port,
                    distDir,
                    evidenceDirectory: scriptEvidenceDirectory,
                    mode: options.mode,
                    tsconfigPath,
                  }),
                  BASE_URL: url,
                },
                detached: process.platform !== "win32",
                stdio: ["ignore", "pipe", "pipe"],
              });
              current.stdout.on("data", (chunk) => appendFileSync(scriptLog, chunk));
              current.stderr.on("data", (chunk) => appendFileSync(scriptLog, chunk));
              const result = await new Promise((done) => {
                let timedOut = false;
                let termination;
                const timer = setTimeout(() => {
                  timedOut = true;
                  termination = terminateGroup(current);
                  termination.done.then(() => done({ status: "timed_out", code: 124 }));
                }, options.timeoutMs);
                current.once("error", (error) => {
                  clearTimeout(timer);
                  done({ status: "failed", code: 1, error: error.message });
                });
                current.once("close", (code, signal) => {
                  clearTimeout(timer);
                  if (timedOut) {
                    termination?.done.then(() => done({ status: "timed_out", code: 124 }));
                  } else
                    done({ status: code === 0 ? "passed" : "failed", code: code ?? 1, signal });
                });
              });
              current = undefined;
              const resultStatus = interrupted ? "interrupted" : result.status;
              resultsByScript.set(script, {
                scenario: script,
                status: resultStatus,
                exitCode: result.code,
                evidenceDirectory: scriptEvidenceDirectory.slice(ROOT.length + 1),
                diagnostics: scriptLog.slice(ROOT.length + 1),
                ...(result.error ? { error: result.error } : {}),
              });
              if (interrupted) break;
            }
          }
        }
      }
    }
  } catch (error) {
    status = "startup_failed";
    diagnostic = `${error.message}; see ${serverLog.slice(ROOT.length + 1)}`;
  } finally {
    if (current && groupAlive(current)) await terminateGroup(current).done;
    await stopOwned(server);
    for (const [signal, handler] of signalHandlers) process.off(signal, handler);
    if (interrupted) {
      status = "interrupted";
      diagnostic = `Interrupted by ${interruptSignal}; available diagnostics are retained.`;
      if (current) current = undefined;
    }
    if (tsconfigCreated) rmSync(tsconfigFile, { force: true });
    const distPath = resolve(WEB, distDir);
    if (pathExists(distPath)) {
      try {
        distIdentity = captureIdentity(distPath, "directory");
        summary.ownedResources[0].state = "retained";
      } catch {
        summary.ownedResources[0].state = "unverifiable";
        if (status === "passed") {
          status = "startup_failed";
          diagnostic = "The invocation build directory could not be verified safely.";
          for (const script of options.scripts) {
            const result = resultsByScript.get(script);
            if (result) {
              result.status = status;
              result.diagnostics = diagnostic;
            }
          }
        }
      }
    } else summary.ownedResources[0].state = "not-created";
    summary.ownedResources[1].state = tsconfigCreated ? "removed" : "not-created";
  }

  for (const script of options.scripts) {
    if (!resultsByScript.has(script))
      resultsByScript.set(script, {
        scenario: script,
        status,
        diagnostics: diagnostic ?? null,
      });
  }
  summary.results = options.scripts.map((script) => resultsByScript.get(script));
  status = aggregateStatus(summary.results);
  summary.outcome = status;
  summary.completedAt = new Date().toISOString();
  if (diagnostic) summary.diagnostic = diagnostic;
  const result = writeSummary(directory, summary);
  const ownerRecord = createRunOwnershipRecord({
    invocationId: id,
    createdAt: summary.startedAt,
    directoryIdentity: captureIdentity(directory, "directory"),
    evidenceIdentity: captureIdentity(resolve(directory, "evidence"), "directory"),
    summaryIdentity: captureIdentity(resolve(directory, "summary.json"), "file"),
    resources: summary.ownedResources,
    resourceIdentities: {
      "next-build-directory": distIdentity,
      "temporary-tsconfig": tsconfigIdentity,
    },
  });
  writeOwnershipRecord(directory, ownerRecord);
  outputResult(
    {
      outcome: status,
      requested: result.requested,
      results: result.results,
      summaryFile: result.summaryFile,
      evidenceDirectory: result.evidenceDirectory,
      ...(diagnostic ? { diagnostic } : {}),
    },
    options.json,
  );
  return status === "passed" ? 0 : status === "unsupported" || status === "blocked" ? 2 : 1;
}
