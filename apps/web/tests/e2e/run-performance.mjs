import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fixtureEnv } from "./local-cli.mjs";

const root = resolve(import.meta.dirname, "../../../..");
const label = `acceptance-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}`;
const out = resolve(root, "output/e2e/performance-acceptance", label);
mkdirSync(out, { recursive: true });
const log = createWriteStream(resolve(out, "runner.log"));
const env = fixtureEnv({ port: 0, mode: "production" });
delete env.NEXT_DIST_DIR;
delete env.NEXT_TSCONFIG_PATH;
env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "map-animation-fixture";
env.LABEL = label;
const summary = {
  outcome: "running",
  reproductionCommand: "node apps/web/tests/e2e/run-performance.mjs",
  label,
  workspaceEvidence: `output/playwright/workspace-performance/${label}/summary.json`,
  mapEvidence: `output/playwright/map-animation-lifecycle/${label}/summary.json`,
  boundary:
    "Production fixture server; integrations disabled; synthetic Google SDK, real MapLibre empty style; no live provider verification or user p75 claim",
};
const save = () =>
  writeFileSync(resolve(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
save();
const child = spawn(
  process.execPath,
  [
    resolve(import.meta.dirname, "legacy-runner.mjs"),
    "workspace-performance",
    "map-animation-lifecycle",
    "--prod",
  ],
  { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
);
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    child.kill(signal);
  });
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
const exit = await new Promise((done) => {
  child.once("error", (error) => done({ code: 1, error: error.message }));
  child.once("close", (code, signal) => done({ code: code ?? 1, signal }));
});
await new Promise((done) => log.end(done));
Object.assign(summary, exit, {
  outcome: interrupted ? "interrupted" : exit.code === 0 ? "passed" : "failed",
});
save();
console.log(`Performance acceptance ${summary.outcome}: ${out}/summary.json`);
process.exitCode = summary.outcome === "passed" ? 0 : 1;
