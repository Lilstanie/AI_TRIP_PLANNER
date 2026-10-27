import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3218";
const provider = process.env.MODEL_URL ?? "http://127.0.0.1:3219";
const local = process.env.LOCAL_BASE_URL ?? "http://127.0.0.1:3220";
const out = resolve("output/e2e/anonymous-model-boundary");
await mkdir(out, { recursive: true });
const results = [];
const check = (condition, name) => {
  results.push({ name, passed: Boolean(condition) });
  if (!condition) throw new Error(name);
};
try {
  const status = await (await fetch(`${base}/api/data-mode`)).json();
  check(status.liveAvailable === false, "deployment blocks anonymous live data");
  const before = await (await fetch(`${provider}/count`)).json();
  for (const mode of ["mock", "live"]) {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-trip-data-mode": mode },
      body: JSON.stringify({
        tripId: "auth-boundary-e2e",
        message: "I want to visit Sydney",
        mode: "chat",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const frames = await response.text();
    check(response.ok && frames.trim().length > 0, `anonymous ${mode} chat returns a response`);
    const after = await (await fetch(`${provider}/count`)).json();
    check(after.count === before.count, `anonymous ${mode} chat makes no real model request`);
  }
  const lab = await fetch(`${base}/api/agent-lab/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenarioId: "tokyo-couple",
      strategyId: "multi-agent-no-revision",
      dataMode: "live",
    }),
  });
  check(lab.status === 401, "anonymous live Agent Lab request is refused");
  assert.equal((await (await fetch(`${provider}/count`)).json()).count, before.count);
  const localStatus = await (await fetch(`${local}/api/data-mode`)).json();
  check(localStatus.liveAvailable === true, "local development without auth allows model access");
  await fetch(`${local}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
    body: JSON.stringify({
      tripId: "auth-local-e2e",
      message: "I want to visit Sydney",
      mode: "chat",
    }),
    signal: AbortSignal.timeout(20000),
  }).then((response) => response.text());
  check(
    (await (await fetch(`${provider}/count`)).json()).count > before.count,
    "local no-auth chat reaches the model stub",
  );
} catch (error) {
  results.push({ name: "execution", passed: false, error: String(error) });
}
await writeFile(`${out}/summary.json`, JSON.stringify({ base, results }, null, 2));
for (const result of results)
  console.log(
    `${result.passed ? "ok" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`,
  );
if (results.some((result) => !result.passed)) process.exitCode = 1;
