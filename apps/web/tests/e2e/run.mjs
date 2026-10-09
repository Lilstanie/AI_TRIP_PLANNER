// Runs E2E scripts against a server this runner starts and stops itself, so several worktrees or
// agents can run E2E side by side without picking ports, finding Playwright or killing servers by hand.
//
//   pnpm --filter @trip/web e2e <name...> [--prod]
//   DATA_MODE=mock pnpm --filter @trip/web e2e timeline 'phone-*'
//   BASE_URL=http://localhost:3000 pnpm --filter @trip/web e2e settings   # use a server already running
//
// <name> is a script under apps/web/tests/e2e/ without `.e2e.mjs`; `*` matches any run of characters.
// --prod builds and runs `next start` (for scripts whose header asks for a production server).
// The environment is passed to the server and to every script, so set provider and data-mode
// variables the way each script's header says. Scripts run one after another from the repository
// root, so their output lands in output/ there. A summary of each run is written to
// output/e2e/runner/<time>.json.
//
// Each script has E2E_SCRIPT_TIMEOUT_MS (default 600000, ten minutes) to finish. A script still running
// then is stopped with its browsers, reported as "timeout" rather than a failure of its checks, and the
// next script runs. A timeout makes the run exit 1, as a failure does.
//
// A script names the environment variables it cannot run without in a header line, before its code:
//   // requires-env: DEEPSEEK_API_KEY[, OTHER_KEY]
// A variable that is unset or empty makes the runner report the script as "skipped: needs KEY" instead
// of running it, so a missing key never reads as a regression. Skips do not change the exit code; a
// failed script still does. If every named script is skipped, no server is started.
//
// Failure inventory this runner was written from:
// - the port is already held by another server, so the scripts test someone else's build;
// - the server exits before it is ready (compile error, bad env) and the runner waits forever;
// - the server never answers, and the runner hangs instead of failing with the server's last output;
// - two runs in one worktree, or a run beside `pnpm dev`, share one `.next` folder and corrupt it;
// - the runner is interrupted or a script crashes, and the server or the script is left running;
// - the runner stops a process it did not start;
// - a misspelt script name matches nothing and the run reports success;
// - a script writes its output under apps/web, where `next dev` watches and reloads;
// - Playwright cannot be resolved from the scripts;
// - the runner exits 0 while a script failed;
// - a script that needs a live key is run without it and its failure is mistaken for a regression;
// - a skip is reported as a pass, or hides a script that failed in the same run;
// - a script that never finishes (a wait with no timeout) holds the whole run until its caller gives up,
//   and every result is lost;
// - a stopped script leaves its browser processes running;
// - a timeout is reported as an ordinary failure, or not at all.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const ROOT = resolve(WEB, "../..");
const NEXT = resolve(WEB, "node_modules/.bin/next");
const READY_TIMEOUT_MS = 5 * 60_000;
const SCRIPT_TIMEOUT_MS = (() => {
  const raw = process.env.E2E_SCRIPT_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 10 * 60_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0)
    fail(`E2E_SCRIPT_TIMEOUT_MS must be a positive whole number of milliseconds, not "${raw}"`);
  return value;
})();

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const patterns = args.filter((arg) => !arg.startsWith("--"));

function fail(message) {
  console.error(`e2e: ${message}`);
  process.exit(2);
}

const available = readdirSync(HERE)
  .filter((file) => file.endsWith(".e2e.mjs"))
  .map((file) => file.slice(0, -".e2e.mjs".length))
  .sort();
if (patterns.length === 0) {
  fail(`name at least one script. Available:\n  ${available.join("\n  ")}`);
}
const scripts = [];
for (const pattern of patterns) {
  const name = pattern.replace(/\.e2e\.mjs$/, "");
  const re = new RegExp(`^${name.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  const matched = available.filter((script) => re.test(script));
  if (matched.length === 0)
    fail(`no script matches "${pattern}". Available:\n  ${available.join("\n  ")}`);
  for (const script of matched) if (!scripts.includes(script)) scripts.push(script);
}

const KEY_NAME = /^[A-Z][A-Z0-9_]*$/;

// The keys named by a script's `requires-env` header line, or []. A malformed line is a runner error,
// not a silent run: a typo must not turn a skip into a failure or the reverse.
function requiredKeys(script) {
  const file = `${script}.e2e.mjs`;
  for (const line of readFileSync(resolve(HERE, file), "utf8").split("\n")) {
    if (!line.startsWith("//")) {
      if (line.trim() === "") continue;
      break;
    }
    const match = line.match(/^\/\/\s*requires-env:\s*(.*?)\s*$/);
    if (!match) continue;
    const keys = match[1].split(",").map((key) => key.trim());
    if (!keys.every((key) => KEY_NAME.test(key)))
      fail(`${file}: bad requires-env line "${line}". Use "// requires-env: KEY[, KEY]".`);
    return keys;
  }
  return [];
}

/** "needs KEY[, KEY]" when a key the script declares is unset or empty, else undefined. */
function skipReason(script) {
  const missing = requiredKeys(script).filter((key) => !process.env[key]);
  return missing.length ? `needs ${missing.join(", ")}` : undefined;
}

try {
  createRequire(import.meta.url).resolve(process.env.PLAYWRIGHT ?? "playwright");
} catch {
  fail(
    "Playwright is not installed. Run `pnpm install`, then `pnpm --filter @trip/web exec playwright install chromium` once.",
  );
}

function freePort() {
  return new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Each concurrent run in one worktree takes its own dist folder (a slot), so runs never share
// `.next`; a slot keeps its compiled output for the next run. The slots are listed in
// apps/web/tsconfig.json so that Next does not add them there itself.
const SLOTS = [".next-e2e", ".next-e2e-2", ".next-e2e-3", ".next-e2e-4"];

function claimDist() {
  for (const name of SLOTS) {
    const lock = resolve(WEB, `${name}.lock`);
    const owner = Number.parseInt(readFileSafe(lock), 10);
    if (Number.isInteger(owner) && owner !== process.pid && pidAlive(owner)) continue;
    writeFileSync(lock, String(process.pid));
    return { name, lock };
  }
  fail(
    `all ${SLOTS.length} dist folders are in use by other runs in this worktree; wait for one to finish.`,
  );
}

function readFileSafe(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

let server;
let current;
let dist;
const serverLog = [];

const serverRunning = () => server && server.exitCode === null && server.signalCode === null;

// The server was started in its own process group; signalling the group reaches it and its
// workers only, never a server this runner did not start.
function signalServer(signal) {
  try {
    process.kill(-server.pid, signal);
  } catch {}
}

function releaseDist() {
  if (dist && readFileSafe(dist.lock) === String(process.pid)) rmSync(dist.lock, { force: true });
}

async function stopServer() {
  if (serverRunning()) {
    const exited = new Promise((done) => server.once("exit", done));
    signalServer("SIGTERM");
    const timer = setTimeout(() => signalServer("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timer);
  }
  releaseDist();
}

// A script runs in its own process group too, so stopping it also stops the browsers it launched.
function signalScript(signal) {
  if (!current) return;
  try {
    process.kill(-current.pid, signal);
  } catch {
    current.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    signalScript("SIGTERM");
    await stopServer();
    process.exit(130);
  });
}
// Last resort for an exit that skipped stopServer (fail(), an uncaught error): stop, never wait.
process.on("exit", () => {
  signalScript("SIGKILL");
  if (serverRunning()) signalServer("SIGKILL");
  releaseDist();
});

/** Resolves to the exit code, or to "timeout" when `timeoutMs` passed first and the process group was stopped. */
function run(command, commandArgs, { timeoutMs, ...options } = {}) {
  return new Promise((done) => {
    let timedOut = false;
    current = spawn(command, commandArgs, {
      stdio: "inherit",
      ...options,
      detached: timeoutMs !== undefined,
    });
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            console.error(`e2e: still running after ${timeoutMs / 1000}s; stopping it`);
            signalScript("SIGTERM");
            setTimeout(() => signalScript("SIGKILL"), 10_000).unref();
          }, timeoutMs);
    current.on("exit", (code, signal) => {
      clearTimeout(timer);
      // Browsers the script launched may outlive it; its group is stopped either way.
      if (timeoutMs !== undefined) signalScript("SIGKILL");
      current = undefined;
      done(timedOut ? "timeout" : (code ?? (signal ? 1 : 0)));
    });
  });
}

async function startServer() {
  const port = await freePort();
  dist = claimDist();
  const env = { ...process.env, PORT: String(port), NEXT_DIST_DIR: dist.name };
  if (prod) {
    console.log(`e2e: building into ${dist.name}`);
    const code = await run(NEXT, ["build"], { cwd: WEB, env });
    if (code !== 0) fail(`next build exited with ${code}`);
  }
  const mode = prod ? "start" : "dev";
  server = spawn(NEXT, [mode, "-p", String(port)], {
    cwd: WEB,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      serverLog.push(...String(chunk).split("\n").filter(Boolean));
      if (serverLog.length > 60) serverLog.splice(0, serverLog.length - 60);
    });
  }
  const url = `http://localhost:${port}`;
  console.log(`e2e: next ${mode} on ${url} (pid ${server.pid}, ${dist.name})`);
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      fail(`the server exited before it was ready. Last output:\n${serverLog.join("\n")}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (response.status < 500) return url;
    } catch {}
    await new Promise((wait) => setTimeout(wait, 1000));
  }
  fail(
    `the server did not answer within ${READY_TIMEOUT_MS / 1000}s. Last output:\n${serverLog.join("\n")}`,
  );
}

const started = new Date();
const skips = new Map(scripts.map((script) => [script, skipReason(script)]));
const toRun = scripts.filter((script) => !skips.get(script));
const baseUrl = toRun.length === 0 ? undefined : (process.env.BASE_URL ?? (await startServer()));
const results = [];
for (const script of scripts) {
  console.log(`\ne2e: ── ${script} ──`);
  const skipped = skips.get(script);
  if (skipped) {
    console.log(`e2e: skipped: ${skipped}`);
    results.push({ script, ok: null, skipped, exitCode: null, seconds: 0 });
    continue;
  }
  const begin = Date.now();
  const code = await run(process.execPath, [resolve(HERE, `${script}.e2e.mjs`)], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL: baseUrl },
    timeoutMs: SCRIPT_TIMEOUT_MS,
  });
  results.push({
    script,
    ok: code === 0,
    ...(code === "timeout" ? { timedOut: true, exitCode: null } : { exitCode: code }),
    seconds: Math.round((Date.now() - begin) / 1000),
  });
}

const summaryDir = resolve(ROOT, "output/e2e/runner");
mkdirSync(summaryDir, { recursive: true });
const summaryFile = resolve(summaryDir, `${started.toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(
  summaryFile,
  `${JSON.stringify({ started: started.toISOString(), baseUrl, prod, results }, null, 2)}\n`,
);

console.log("\ne2e: summary");
for (const result of results) {
  const label = result.skipped ? "skip" : result.ok ? "ok  " : result.timedOut ? "TIME" : "FAIL";
  console.log(
    `  ${label} ${result.script} (${result.skipped ? `skipped: ${result.skipped}` : result.timedOut ? `timeout after ${result.seconds}s` : `${result.seconds}s`})`,
  );
}
console.log(`  written to ${summaryFile.slice(ROOT.length + 1)}`);
await stopServer();
process.exit(results.some((result) => result.ok === false) ? 1 : 0);
