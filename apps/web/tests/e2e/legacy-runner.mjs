import { spawn } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, resolve } from "node:path";
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

function claimDist() {
  return { name: basename(mkdtempSync(resolve(WEB, ".next-e2e-"))) };
}

function createTsconfig() {
  const path = `.tsconfig-e2e-raw-${dist.name.slice(".next-e2e-".length)}.json`;
  const file = resolve(WEB, path);
  const config = JSON.parse(readFileSync(resolve(WEB, "tsconfig.json"), "utf8"));
  config.include = [...new Set([...config.include, `${dist.name}/types/**/*.ts`])];
  config.compilerOptions = {
    ...config.compilerOptions,
    tsBuildInfoFile: resolve(WEB, dist.name, "tsconfig.tsbuildinfo"),
  };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
  dist.tsconfig = { file, identity: lstatSync(file) };
  return path;
}

function removeTsconfig() {
  if (!dist?.tsconfig) return;
  const { file, identity } = dist.tsconfig;
  try {
    const stat = lstatSync(file);
    if (stat.isFile() && stat.dev === identity.dev && stat.ino === identity.ino) rmSync(file);
  } catch {}
}

let server;
let current;
let dist;
const serverLog = [];

const serverRunning = () => server && server.exitCode === null && server.signalCode === null;

function signalServer(signal) {
  try {
    process.kill(-server.pid, signal);
  } catch {}
}

async function stopServer() {
  if (serverRunning()) {
    const exited = new Promise((done) => server.once("exit", done));
    signalServer("SIGTERM");
    const timer = setTimeout(() => signalServer("SIGKILL"), 10_000);
    await exited;
    clearTimeout(timer);
  }
}

function signalScript(signal, child = current) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, async () => {
    signalScript("SIGTERM");
    await stopServer();
    process.exit(130);
  });
}

process.on("exit", () => {
  signalScript("SIGKILL");
  if (serverRunning()) signalServer("SIGKILL");
  removeTsconfig();
});

function run(command, commandArgs, { timeoutMs, ...options } = {}) {
  return new Promise((done) => {
    let timedOut = false;
    let escalation;
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      ...options,
      detached: timeoutMs !== undefined,
    });
    current = child;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            console.error(`e2e: still running after ${timeoutMs / 1000}s; stopping it`);
            signalScript("SIGTERM", child);
            escalation = setTimeout(() => signalScript("SIGKILL", child), 10_000);
            escalation.unref();
          }, timeoutMs);
    const finish = (code, signal) => {
      clearTimeout(timer);
      clearTimeout(escalation);
      if (timeoutMs !== undefined) signalScript("SIGKILL", child);
      if (current === child) current = undefined;
      done(timedOut ? "timeout" : (code ?? (signal ? 1 : 0)));
    };
    child.once("exit", finish);
    child.once("error", (error) => {
      console.error(`e2e: unable to start ${command}: ${error.message}`);
      finish(1);
    });
  });
}

async function startServer() {
  const port = await freePort();
  dist = claimDist();
  const env = { ...process.env, PORT: String(port), NEXT_DIST_DIR: dist.name };
  if (!env.NEXT_TSCONFIG_PATH) env.NEXT_TSCONFIG_PATH = createTsconfig();
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
