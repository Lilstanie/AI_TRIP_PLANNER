import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const output = resolve(process.cwd(), "output/playwright/thinking-disclosure");
mkdirSync(output, { recursive: true });

const raw =
  "All independent — call in one block. Write objectives as one concrete sentence naming trip facts. Stop here and summarize.";
const checks = [];
const check = (condition, name) => {
  checks.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? "ok" : "FAIL"} ${name}`);
};

async function run({ language, width, height, name }) {
  const context = await browser.newContext({
    locale: language,
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  const knownConsoleErrors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    const detail = `${message.text()} (${source || "no source URL"})`;
    if (source?.endsWith("/favicon.ico")) knownConsoleErrors.push(detail);
    else errors.push(detail);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${base}/debug/thinking`);
  await page.waitForFunction(
    (expected) => document.documentElement.lang === expected,
    language === "zh-CN" ? "zh-CN" : "en-AU",
  );
  const turn = page.locator(".thinking-turn");
  check(
    (await turn.getAttribute("data-state")) === "ok",
    `${name}: completed fixture retains its success state`,
  );
  await page.getByRole("button", { name: "Failed" }).click();
  check(
    (await turn.getAttribute("data-state")) === "error",
    `${name}: failed fixture retains its error state`,
  );
  await turn.locator(":scope > .thinking-row__line").click();
  check(
    (await page.locator(".thinking-error").innerText()) === "Fixture failure",
    `${name}: failed fixture retains its visible error message`,
  );
  await turn.locator(":scope > .thinking-row__line").click();
  await page.getByRole("button", { name: "Mid-flight" }).click();
  const turnSummary = turn.locator(".thinking-row__summary-text");
  await turnSummary.waitFor();
  check(
    !(await turnSummary.innerText()).includes(raw),
    `${name}: collapsed Think hides raw orchestration reasoning`,
  );
  check(
    (await page.locator("html").getAttribute("lang")) ===
      (language === "zh-CN" ? "zh-CN" : "en-AU"),
    `${name}: interface locale is ${language}`,
  );
  if (language === "zh-CN")
    check(
      (await turnSummary.innerText()).startsWith("住宿"),
      `${name}: live progress is localized`,
    );

  await page.screenshot({ path: `${output}/${name}-collapsed-turn.png`, fullPage: true });
  await turn.locator(".thinking-row__line").click();
  const itinerary = page
    .locator(".thinking-subagent")
    .filter({ has: page.locator(".thinking-row__name", { hasText: /每日行程|Day plan/ }) })
    .first();
  const subagentSummary = itinerary.locator(".thinking-row__summary-text");
  await subagentSummary.waitFor();
  check(
    !(await subagentSummary.innerText()).includes(raw),
    `${name}: expanded Think still keeps collapsed subagent summary safe`,
  );

  await itinerary.locator(".thinking-row__line").click();
  const reasoning = itinerary.locator(".thinking-reasoning").last();
  const reasoningSummary = reasoning.locator(".thinking-row__summary-text");
  await reasoningSummary.waitFor();
  check(
    !(await reasoningSummary.innerText()).includes(raw),
    `${name}: expanded subagent still keeps collapsed reasoning row safe`,
  );
  await page.screenshot({ path: `${output}/${name}-nested-collapsed.png`, fullPage: true });

  await reasoning.locator(".thinking-row__line").click();
  check(
    (await reasoning.locator(".thinking-reasoning__body").innerText()).includes(raw),
    `${name}: explicit reasoning disclosure retains the complete raw stream`,
  );
  check(
    (await page.locator(".thinking-turn").getAttribute("data-state")) === "running",
    `${name}: running state remains visible`,
  );
  if (width <= 520)
    check(
      await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
      `${name}: phone has no horizontal page overflow`,
    );
  check(
    !errors.length,
    `${name}: no application browser console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  if (knownConsoleErrors.length)
    console.log(`${name}: known pre-existing favicon request: ${knownConsoleErrors.join(" | ")}`);
  check(
    !failedResponses.length,
    `${name}: no failed browser requests${failedResponses.length ? `: ${failedResponses.join(" | ")}` : ""}`,
  );
  await page.screenshot({ path: `${output}/${name}-expanded-reasoning.png`, fullPage: true });
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? "chrome" });
try {
  await run({ language: "en-AU", width: 800, height: 600, name: "english-800x600" });
  await run({ language: "zh-CN", width: 390, height: 844, name: "chinese-phone-390x844" });
} finally {
  await browser.close();
}
assert(
  checks.every((item) => item.passed),
  `${checks
    .filter((item) => !item.passed)
    .map((item) => item.name)
    .join("; ")}`,
);
console.log(`\nSimulated streamed-event fixture; not a live planner run. Screenshots: ${output}`);
