import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/budget-source-replacement");
mkdirSync(out, { recursive: true });
const results = [];
const requests = [];
const responses = [];
let phase = "browser launch";
let diagnosticPage;
const check = (ok, name, detail) => {
  results.push({ ok, name, ...(detail ? { detail } : {}) });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });

try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  diagnosticPage = page;
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    if (request.url().endsWith("/api/chat") && request.method() === "POST") {
      try {
        requests.push(JSON.parse(request.postData() ?? "{}"));
      } catch {
        requests.push({ invalidJson: true });
      }
    }
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/api/chat")) responses.push(response.status());
  });

  const send = page.getByRole("button", { name: "Send", exact: true });
  const input = page.getByRole("textbox", { name: "Message AI Trip Planner" });
  const current = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"));
  const waitForPlan = async (expected) =>
    page.waitForFunction(
      (budget) => {
        const brief = JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief;
        return brief?.budgetTotal === budget;
      },
      expected,
      { timeout: 180_000 },
    );
  const waitForState = async (expected) =>
    page.waitForFunction(
      (state) => {
        const brief = JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief;
        if (!brief) return false;
        if (state.budgetTotal !== undefined && brief.budgetTotal !== state.budgetTotal)
          return false;
        if (state.sourceCurrency === null && brief.budgetSource !== undefined) return false;
        if (
          state.sourceCurrency !== undefined &&
          state.sourceCurrency !== null &&
          brief.budgetSource?.currency !== state.sourceCurrency
        )
          return false;
        if (state.sourceAmount !== undefined && brief.budgetSource?.amount !== state.sourceAmount)
          return false;
        if (state.displayCurrency !== undefined && brief.displayCurrency !== state.displayCurrency)
          return false;
        return true;
      },
      expected,
      { timeout: 60_000 },
    );
  const message = async (text, expected) => {
    const repliesBefore = await page.locator(".msg-item--agent .msg-item__body").count();
    const responseFinished = page.waitForEvent("requestfinished", {
      predicate: (request) => request.url().endsWith("/api/chat") && request.method() === "POST",
      timeout: 180_000,
    });
    await input.fill(text);
    await send.click();
    await responseFinished;
    await page.waitForFunction(
      (count) => document.querySelectorAll(".msg-item--agent .msg-item__body").length > count,
      repliesBefore,
      { timeout: 180_000 },
    );
    await waitForState(expected);
    await page.waitForTimeout(150);
  };
  const lastReply = async () =>
    (await page.locator(".msg-item--agent .msg-item__body").last().textContent())?.trim() ?? "";
  const budgetChip = async () =>
    (await page.getByRole("button", { name: /^Budget:/ }).textContent())
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  phase = "load workspace";
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await page.locator(".workspace-app").waitFor();
  phase = "set display currency CNY";
  await page.locator('button[aria-label^="Account settings:"]:visible').first().click();
  const settings = page.getByRole("dialog");
  await settings.getByRole("tab", { name: "Language & region" }).click();
  await settings.getByRole("button", { name: "Change Display currency" }).click();
  await settings
    .getByRole("group", { name: "Display currency", exact: true })
    .getByRole("button", { name: "CNY", exact: true })
    .click();
  await page.keyboard.press("Escape");
  phase = "set initial CNY source budget";
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await page.getByLabel("Or enter an amount (CNY)").fill("5000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  phase = "create initial plan";
  await input.fill("Sydney, 2026-11-10 to 2026-11-14, 2 travellers.");
  await send.click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 60_000 });
  await waitForPlan(1050);

  let saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "CNY" &&
      saved.plan.brief.budgetSource?.amount === 5000 &&
      saved.plan.brief.budgetTotal === 1050,
    "initial trip stores the stated CNY source and AUD planning total",
  );

  phase = "replace CNY source with AUD";
  await message("Change the total budget to AUD 3000.", {
    budgetTotal: 3000,
    sourceCurrency: null,
    displayCurrency: "AUD",
  });
  saved = await current();
  check(
    saved.plan.brief.budgetSource === undefined &&
      saved.plan.brief.displayCurrency === "AUD" &&
      saved.plan.budgetTotal === 3000,
    "foreign-to-AUD replacement clears the old source and replans at AUD 3000",
    JSON.stringify(saved.plan.brief),
  );
  check(
    requests.at(-1)?.brief?.budgetSource?.currency === "CNY" &&
      requests.at(-1)?.brief?.budgetSource?.amount === 5000,
    "replacement request resends the prior plan source for the server to replace",
  );
  check(
    !(await lastReply()).includes("CNY 5,000") &&
      (await budgetChip()).includes("AUD") &&
      (await page.locator(".trip__budget").textContent())?.includes("AUD"),
    "assistant, visible budget and limit no longer show the stale CNY source",
  );

  phase = "replace AUD with JPY source";
  await message("Change my total budget to JPY 500000.", {
    sourceCurrency: "JPY",
    sourceAmount: 500000,
  });
  saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "JPY" &&
      saved.plan.brief.budgetSource?.amount === 500000 &&
      saved.plan.brief.budgetTotal !== 3000,
    "foreign-to-foreign replacement stores the newly stated JPY source",
    JSON.stringify(saved.plan.brief),
  );
  check(
    requests.at(-1)?.brief?.budgetTotal === 3000 &&
      requests.at(-1)?.brief?.budgetSource === undefined,
    "next request resends the replacement's AUD plan without its former CNY source",
  );
  check(
    (await budgetChip()).includes("JPY") &&
      (await page.locator(".trip__budget").textContent())?.includes("JPY"),
    "new JPY source is reflected by the budget display and limit",
  );

  phase = "replace JPY source with bare AUD";
  await message("Change the total budget to 3000.", {
    budgetTotal: 3000,
    sourceCurrency: null,
    displayCurrency: "JPY",
  });
  saved = await current();
  check(
    saved.plan.brief.budgetSource === undefined &&
      saved.plan.brief.displayCurrency === "JPY" &&
      saved.plan.budgetTotal === 3000,
    "foreign-to-bare replacement clears source while preserving JPY display currency",
    JSON.stringify(saved.plan.brief),
  );
  check(
    requests.at(-1)?.brief?.budgetSource?.currency === "JPY" &&
      requests.at(-1)?.brief?.budgetSource?.amount === 500000,
    "bare replacement request resends the prior JPY source before replacing it",
  );
  check(
    !(await lastReply()).includes("JPY 500,000") &&
      (await budgetChip()).includes("JPY") &&
      (await page.locator(".trip__budget").textContent())?.includes("JPY"),
    "assistant, converted display and limit agree after the bare AUD replacement",
  );
  phase = "set new CNY source";
  await message("Set the total budget to CNY 5000.", {
    sourceCurrency: "CNY",
    sourceAmount: 5000,
  });
  saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "CNY" &&
      saved.plan.brief.budgetSource?.amount === 5000,
    "a new foreign replacement creates its own source metadata",
  );
  phase = "change display currency only";
  await message("Show the trip budget in JPY.", {
    sourceCurrency: "CNY",
    sourceAmount: 5000,
    displayCurrency: "JPY",
  });
  saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "CNY" &&
      saved.plan.brief.budgetSource?.amount === 5000 &&
      saved.plan.brief.displayCurrency === "JPY",
    "display-currency-only update preserves the active foreign source",
    JSON.stringify(saved.plan.brief),
  );
  phase = "reload and restore foreign source";
  await page.reload();
  await page.locator(".workspace-app").waitFor();
  saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "CNY" &&
      saved.plan.brief.budgetSource?.amount === 5000 &&
      saved.plan.brief.displayCurrency === "JPY",
    "browser reload recovers the replacement source and display currency",
    JSON.stringify(saved.plan.brief),
  );
  await page.getByRole("button", { name: /^Chats/ }).click();
  await page.locator(".history-item__open").first().click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief?.budgetSource
        ?.currency === "CNY",
  );
  saved = await current();
  check(
    saved.plan.brief.budgetSource?.currency === "CNY" &&
      saved.plan.brief.budgetSource?.amount === 5000 &&
      saved.plan.brief.displayCurrency === "JPY",
    "saved conversation snapshot restores the replacement source without the prior source",
    JSON.stringify(saved.plan.brief),
  );
  check(errors.length === 0, "no browser errors", errors.join(" | "));
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "no desktop horizontal overflow",
  );
  await page.screenshot({ path: `${out}/desktop-budget-source-replacement.png`, fullPage: true });
  await context.close();
} catch (error) {
  const diagnostic = { phase, error: String(error), responses, requestCount: requests.length };
  if (diagnosticPage) {
    try {
      diagnostic.state = await diagnosticPage.evaluate(() => ({
        url: location.href,
        body: document.body.innerText.slice(0, 4000),
        workspace: JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"),
      }));
      await diagnosticPage.screenshot({ path: `${out}/failure.png`, fullPage: true });
    } catch (diagnosticError) {
      diagnostic.diagnosticError = String(diagnosticError);
    }
  }
  check(false, "journey completed", JSON.stringify(diagnostic));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, `${JSON.stringify(results, null, 2)}\n`);
}

if (results.some((result) => !result.ok)) process.exit(1);
