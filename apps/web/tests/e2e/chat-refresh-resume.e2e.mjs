import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/chat-refresh-resume",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const pendingRuns = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-planner:pending-runs") ?? "{}"));

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem("trip.settings.v1"))
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          language: "en",
          dataMode: "mock",
          travel: { homeCity: "", preferences: [] },
          appearance: "system",
          updatedAt: new Date().toISOString(),
        }),
      );
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("dialog", (dialog) => void dialog.accept());
  const replays = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/chat?run=")) replays.push(response.status());
  });
  await page.goto(BASE, { waitUntil: "networkidle" });

  let intercepted;
  const posted = new Promise((resolve) => (intercepted = resolve));
  await page.route("**/api/chat", (route) => {
    if (route.request().method() !== "POST" || !intercepted) return route.continue();
    intercepted(route.request());
    intercepted = undefined;
    void route.fetch().catch(() => undefined);
  });
  await page.locator(".chat-suggestions__chip").first().click();
  const request = await posted;
  const prompt = request.postDataJSON().message;
  const runId = request.headers()["x-chat-run"];
  check(/^[0-9a-f-]{36}$/.test(runId ?? ""), "the turn is sent with a run id", runId);
  await page.waitForTimeout(400);
  const before = await pendingRuns(page);
  check(
    Object.values(before).some((run) => run.runId === runId),
    "the running turn is remembered before the refresh",
    Object.keys(before),
  );
  await page.screenshot({ path: resolve(out, "01-before-refresh.png") });

  await page.reload({ waitUntil: "domcontentloaded" });
  const restored = await page
    .getByText(/Estimated total/)
    .first()
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  check(restored, "the reply appears after the refresh");
  if (!restored) await page.screenshot({ path: resolve(out, "02-reply-missing.png") });
  await page.waitForTimeout(1000);
  const transcript = (await page.locator(".msg-item").allInnerTexts()).map((text) =>
    text.replace(/\s+/g, " ").slice(0, 120),
  );
  check(replays.includes(200), "the reloaded page replays the run from the server", replays);
  check(
    transcript.filter((text) => text.includes(prompt.slice(0, 40))).length === 1,
    "the traveller's message appears once after the refresh",
    transcript,
  );
  check(!(await page.getByText(/could not be recovered/).count()), "no lost-reply notice is shown");
  check(
    Object.keys(await pendingRuns(page)).length === 0,
    "the finished turn is no longer pending",
  );
  await page.screenshot({ path: resolve(out, "03-reply-restored.png") });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}");
    return (catalog.conversations ?? []).map((item) => item.messages.map((m) => m.role));
  });
  check(
    saved.some((roles) => roles.join() === "user,agent") && replays.length === 1,
    "a second refresh keeps the saved reply without replaying again",
    { saved, replays },
  );
  await page.screenshot({ path: resolve(out, "04-second-refresh.png") });

  const lost = await page.request.get(`${BASE}/api/chat?run=${crypto.randomUUID()}`);
  check(lost.status() === 404, "an unknown run id is not found", lost.status());

  check(pageErrors.length === 0, "no page errors", pageErrors);
  await context.close();
} finally {
  await browser.close();
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ base: BASE, checks }, null, 2));
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
