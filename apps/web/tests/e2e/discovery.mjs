import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_JOURNEYS, SUPPORTED_JOURNEYS } from "./local-cli-collections.mjs";

const HERE = new URL(".", import.meta.url);
const E2E = fileURLToPath(HERE);
const WEB = resolve(E2E, "../..");
const ROOT = resolve(WEB, "../..");
const REQUIRE = createRequire(import.meta.url);
export const SUPPORTED_SCRIPT_NAMES = SUPPORTED_JOURNEYS;
const SUPPORTED = new Set(SUPPORTED_SCRIPT_NAMES);
const JOURNEY_BY_NAME = new Map(LOCAL_JOURNEYS.map((journey) => [journey.name, journey]));
const EXCLUSIONS = {
  "agent-lab-live-gate":
    "Requires multiple app servers; the isolated local runner owns one server.",
  "map-provider-http":
    "Starts an HTTP provider stub alongside the app server; multiple-server journeys are unsupported initially.",
  "leg-mode-choice":
    "Contains a model-dependent chat scenario that can print SKIP when the model falls back; the command can otherwise exit successfully.",
  "plan-quality":
    "Defaults to live data and checks model-generated planning; not a fixture-only journey.",
  "conversation-scope":
    "Defaults to live data and requires model-backed responses; not a fixture-only journey.",
};
const KNOWN_PREREQUISITES = {
  "conversation-scope": ["DEEPSEEK_API_KEY"],
  "plan-quality": ["DEEPSEEK_API_KEY"],
};

function check(id, status, summary, remediation) {
  return { id, status, summary, ...(remediation ? { remediation } : {}) };
}

function hasAccess(path, mode = constants.R_OK) {
  try {
    accessSync(path, mode);
    return true;
  } catch {
    return false;
  }
}

function packageManagerEnv() {
  const env = {};
  for (const name of ["PATH", "PATHEXT", "HOME", "USERPROFILE", "SystemRoot", "COREPACK_HOME"]) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  env.COREPACK_ENABLE_NETWORK = "0";
  env.COREPACK_ENABLE_DOWNLOAD_PROMPT = "0";
  return env;
}

function doctorChecks() {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const nodeReady = Number.isInteger(nodeMajor) && nodeMajor >= 22;
  const checks = [
    check(
      "node",
      nodeReady ? "ready" : "blocked",
      `Node.js ${process.versions.node}; repository requires ${packageJson.engines.node}.`,
      nodeReady ? undefined : "Install Node.js 22 or newer and rerun doctor.",
    ),
  ];

  const manager = String(packageJson.packageManager ?? "");
  const [managerName, expectedVersion] = manager.split("@");
  const actualManager =
    managerName === "pnpm"
      ? spawnSync("pnpm", ["--version"], {
          cwd: ROOT,
          encoding: "utf8",
          timeout: 5000,
          env: packageManagerEnv(),
        })
      : undefined;
  const actualVersion = actualManager?.status === 0 ? actualManager.stdout.trim() : "";
  const managerReady = Boolean(expectedVersion && actualVersion === expectedVersion);
  checks.push(
    check(
      "package-manager",
      managerReady ? "ready" : "blocked",
      managerReady
        ? `pnpm ${actualVersion} matches the repository pin.`
        : actualManager?.error?.code === "ENOENT"
          ? `pnpm is unavailable; repository requires ${manager || "a pinned package manager"}.`
          : `pnpm ${actualVersion || "is unavailable"}; repository requires ${manager || "a pinned package manager"}.`,
      managerReady ? undefined : "Run corepack enable and activate the pinned pnpm version.",
    ),
  );

  const nextPath = resolve(WEB, "node_modules/.bin/next");
  checks.push(
    check(
      "workspace-dependencies",
      hasAccess(nextPath, constants.R_OK | constants.X_OK) ? "ready" : "blocked",
      hasAccess(nextPath, constants.R_OK | constants.X_OK)
        ? "The web Next.js executable is installed and accessible."
        : "The web Next.js executable is missing or inaccessible.",
      hasAccess(nextPath, constants.R_OK | constants.X_OK)
        ? undefined
        : "Run pnpm install --frozen-lockfile from the repository root.",
    ),
  );

  let tsconfigReady = false;
  try {
    const tsconfig = JSON.parse(readFileSync(resolve(WEB, "tsconfig.json"), "utf8"));
    tsconfigReady =
      Boolean(tsconfig) &&
      !Array.isArray(tsconfig) &&
      Array.isArray(tsconfig.include) &&
      tsconfig.include.every((entry) => typeof entry === "string");
  } catch {}
  checks.push(
    check(
      "typescript-config",
      tsconfigReady ? "ready" : "blocked",
      tsconfigReady
        ? "The web TypeScript config is readable JSON with an include string array."
        : "apps/web/tsconfig.json is missing, unreadable, malformed, or has an invalid include array.",
      tsconfigReady
        ? undefined
        : "Restore a valid apps/web/tsconfig.json with an include string array.",
    ),
  );

  let playwright;
  try {
    playwright = REQUIRE("playwright");
  } catch {}
  const browserPath = playwright?.chromium?.executablePath();
  const browserReady = Boolean(
    browserPath && hasAccess(browserPath, constants.R_OK | constants.X_OK),
  );
  checks.push(
    check(
      "browser",
      browserReady ? "ready" : "blocked",
      browserReady
        ? "Playwright and its Chromium executable are installed."
        : playwright
          ? "Playwright is installed, but its Chromium executable is missing or inaccessible."
          : "Playwright is missing from the web workspace.",
      browserReady ? undefined : "Run pnpm --filter @trip/web exec playwright install chromium.",
    ),
  );

  const envFiles = readdirSync(WEB)
    .filter((name) => name.startsWith(".env"))
    .sort();
  checks.push(
    check(
      "app-environment",
      "ready",
      envFiles.length
        ? `App dotenv files are present (${envFiles.join(", ")}); doctor did not read their contents or modify them.`
        : "No app dotenv files are present; local fixture execution needs no provider credentials.",
    ),
  );
  checks.push(
    check(
      "fixture-profile",
      "ready",
      "Local run uses its isolated fixture profile, forces mock tools, disables Agent Lab live runs, and blanks known integration credentials.",
    ),
  );
  return checks;
}

function requiredEnv(source) {
  const lines = source.split("\n");
  for (const line of lines) {
    if (line.trim() === "") continue;
    if (!line.startsWith("//")) break;
    const match = line.match(/^\/\/\s*requires-env:\s*(.*?)\s*$/);
    if (match)
      return match[1]
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
  }
  return [];
}

function discoverScripts() {
  return readdirSync(E2E)
    .filter((file) => file.endsWith(".e2e.mjs"))
    .map((file) => {
      const name = file.slice(0, -".e2e.mjs".length);
      const source = readFileSync(resolve(E2E, file), "utf8");
      const prerequisites = requiredEnv(source);
      const supported = SUPPORTED.has(name);
      const limitation = EXCLUSIONS[name];
      return {
        name,
        status: supported ? "supported" : "unsupported",
        prerequisites: supported
          ? ["workspace dependencies", "Playwright Chromium"]
          : prerequisites.length
            ? prerequisites
            : KNOWN_PREREQUISITES[name]
              ? KNOWN_PREREQUISITES[name]
              : ["script-specific prerequisites are not verified"],
        ...(supported
          ? {
              description: JOURNEY_BY_NAME.get(name).description,
            }
          : {
              reason:
                limitation ??
                "Not reviewed for complete fixture-only execution and isolated local state.",
            }),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function render(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  console.log(`Local E2E ${result.command}: ${result.outcome.toUpperCase()}`);
  if (result.command === "doctor") {
    for (const item of result.checks)
      console.log(
        `  ${item.status.toUpperCase()} ${item.id}: ${item.summary}${item.remediation ? ` Fix: ${item.remediation}` : ""}`,
      );
  } else {
    for (const script of result.scripts)
      console.log(
        `  ${script.status.toUpperCase()} ${script.name}: ${script.reason ?? script.description}${script.prerequisites.length ? ` Prerequisites: ${script.prerequisites.join(", ")}.` : ""}`,
      );
  }
}

export function runDiscoveryCli(command, args) {
  const json = args.includes("--json");
  const invalid = args.some((arg) => arg !== "--json");
  if (invalid) {
    const result = {
      command,
      outcome: "unsupported",
      diagnostic: `Usage: e2e ${command} [--json]`,
      ...(command === "doctor" ? { checks: [] } : { scripts: [] }),
    };
    render(result, json);
    return 2;
  }

  if (command === "doctor") {
    const checks = doctorChecks();
    const outcome = checks.some((item) => item.status === "blocked") ? "blocked" : "ready";
    render({ schemaVersion: 1, command, outcome, checks }, json);
    return outcome === "ready" ? 0 : 1;
  }

  const scripts = discoverScripts();
  render(
    {
      schemaVersion: 1,
      command,
      outcome: "ready",
      supported: scripts
        .filter((script) => script.status === "supported")
        .map((script) => script.name),
      unsupported: scripts.filter((script) => script.status === "unsupported").length,
      scripts,
    },
    json,
  );
  return 0;
}
