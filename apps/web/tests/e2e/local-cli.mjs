import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const ROOT = resolve(WEB, "../..");
const NEXT = resolve(WEB, "node_modules/.bin/next");
const ROOT_OUTPUT = resolve(ROOT, "output/e2e/local-test-cli");
const SUPPORTED = new Set(["agent-lab-single-agent"]);
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
  const options = { mode: "production", json: false, timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--dev") options.mode = "development";
    else if (arg === "--timeout-ms") {
      const timeout = Number(args[index + 1]);
      if (!Number.isInteger(timeout) || timeout < 1000)
        throw new Error("--timeout-ms must be a whole number of at least 1000");
      options.timeoutMs = timeout;
      index += 1;
    } else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else if (options.script === undefined) options.script = arg.replace(/\.e2e\.mjs$/, "");
    else throw new Error("run accepts one script name");
  }
  if (!options.script) throw new Error("usage: e2e run <script> [--dev] [--json]");
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
  const child = spawn(NEXT, [mode === "production" ? "start" : "dev", "-p", String(port)], {
    cwd: WEB,
    env: fixtureEnv({ port, distDir, mode, tsconfigPath }),
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.once("error", (error) => {
    child.spawnError = error;
    appendFileSync(logPath, `\n${error.stack ?? error.message}\n`);
  });
  child.stdout.on("data", (chunk) => appendFileSync(logPath, chunk));
  child.stderr.on("data", (chunk) => appendFileSync(logPath, chunk));
  return child;
}

async function waitUntilReady(child, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.spawnError)
      return { ready: false, reason: `server could not start: ${child.spawnError.message}` };
    if (child.exitCode !== null || child.signalCode !== null)
      return { ready: false, reason: `server exited (${child.exitCode ?? child.signalCode})` };
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.status < 500) return { ready: true };
    } catch {}
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
  const evidenceDirectory = resolve(directory, "evidence", options.script);
  const distDir = `.next-e2e-local-${id}`;
  const tsconfigPath = `.tsconfig-e2e-local-${id}.json`;
  const tsconfigFile = resolve(WEB, tsconfigPath);
  const serverLog = resolve(directory, "server.log");
  const buildLog = resolve(directory, "build.log");
  const journeyLog = resolve(directory, "journey.log");
  mkdirSync(evidenceDirectory, { recursive: true });
  const summary = {
    invocationId: id,
    startedAt: new Date().toISOString(),
    requested: [options.script],
    reproductionCommand: `pnpm --filter @trip/web e2e run ${options.script}${options.mode === "development" ? " --dev" : ""}`,
    server: { mode: options.mode, url: null, port: null, distDir },
    ownedResources: [
      { kind: "next-build-directory", path: `apps/web/${distDir}`, state: "retained" },
      {
        kind: "temporary-tsconfig",
        path: `apps/web/${tsconfigPath}`,
        state: "removed-on-completion",
      },
    ],
    results: [],
  };
  let server;
  let current;
  let tsconfigCreated = false;
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
  try {
    if (!SUPPORTED.has(options.script)) {
      status = "unsupported";
      diagnostic = `No local fixture journey is registered as supported for ${options.script}.`;
    } else {
      try {
        createRequire(import.meta.url).resolve("playwright");
        createRequire(import.meta.url).resolve(NEXT);
      } catch {
        status = "blocked";
        diagnostic = "Workspace dependencies are unavailable. Run pnpm install --frozen-lockfile.";
      }
      if (status !== "blocked") {
        if (existsSync(resolve(WEB, distDir)))
          throw new Error(`Invocation build directory already exists: ${distDir}`);
        const tsconfig = JSON.parse(readFileSync(resolve(WEB, "tsconfig.json"), "utf8"));
        tsconfig.include = [...new Set([...tsconfig.include, `${distDir}/types/**/*.ts`])];
        writeFileSync(tsconfigFile, `${JSON.stringify(tsconfig, null, 2)}\n`, { flag: "wx" });
        tsconfigCreated = true;
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
            writeFileSync(journeyLog, `Starting ${options.script}\n`);
            current = spawn(process.execPath, [resolve(HERE, "agent-lab-single-agent.e2e.mjs")], {
              cwd: ROOT,
              env: {
                ...fixtureEnv({
                  port,
                  distDir,
                  evidenceDirectory,
                  mode: options.mode,
                  tsconfigPath,
                }),
                BASE_URL: url,
              },
              detached: process.platform !== "win32",
              stdio: ["ignore", "pipe", "pipe"],
            });
            current.stdout.on("data", (chunk) => appendFileSync(journeyLog, chunk));
            current.stderr.on("data", (chunk) => appendFileSync(journeyLog, chunk));
            const result = await new Promise((done) => {
              const timer = setTimeout(() => {
                terminateGroup(current);
                done({ status: "timed_out", code: 124 });
              }, options.timeoutMs);
              current.once("error", (error) => {
                clearTimeout(timer);
                done({ status: "failed", code: 1, error: error.message });
              });
              current.once("close", (code, signal) => {
                clearTimeout(timer);
                done({ status: code === 0 ? "passed" : "failed", code: code ?? 1, signal });
              });
            });
            status = result.status;
            if (result.error) diagnostic = result.error;
            if (status === "failed")
              diagnostic = `Journey failed; see ${journeyLog.slice(ROOT.length + 1)}`;
            summary.results.push({
              scenario: options.script,
              status,
              exitCode: result.code,
              evidenceDirectory: evidenceDirectory.slice(ROOT.length + 1),
              diagnostics: journeyLog.slice(ROOT.length + 1),
            });
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
      if (summary.results[0]) summary.results[0].status = status;
    }
    if (tsconfigCreated) rmSync(tsconfigFile, { force: true });
    summary.ownedResources[0].state = existsSync(resolve(WEB, distDir))
      ? "retained"
      : "not-created";
    summary.ownedResources[1].state = tsconfigCreated ? "removed" : "not-created";
  }

  summary.outcome = status;
  summary.completedAt = new Date().toISOString();
  if (diagnostic) summary.diagnostic = diagnostic;
  if (summary.results.length === 0 && options.script) {
    summary.results.push({ status, scenario: options.script, diagnostics: diagnostic ?? null });
  }
  const result = writeSummary(directory, summary);
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
