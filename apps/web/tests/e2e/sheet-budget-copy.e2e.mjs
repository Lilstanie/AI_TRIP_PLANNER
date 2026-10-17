import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/sheet-budget-copy");
mkdirSync(OUT, { recursive: true });
const results = [];
const requests = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript((savedLanguage) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
          memberships: [],
          assistant: { style: "neutral", memory: true },
          dataMode: "mock",
          appearance: "system",
          language: savedLanguage,
          displayCurrency: "AUD",
          updatedAt: new Date(0).toISOString(),
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("request", (request) => {
      if (request.url().endsWith("/api/chat") && request.method() === "POST") {
        try {
          requests.push({ language, body: JSON.parse(request.postData() ?? "{}") });
        } catch {
          requests.push({ language, invalidJson: true });
        }
      }
    });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const input = page.getByRole("textbox", {
      name: language === "zh" ? "向 AI 旅行规划助手发送消息" : "Message AI Trip Planner",
    });
    await input.fill(
      "Plan a trip to Sydney from Melbourne from 2026-10-24 to 2026-11-25 for 2 travellers, budget AUD 5000",
    );
    await input.press("Enter");
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.locator(".fact-chips__scroller > button").nth(3).click();
    const budget = page.getByRole("dialog");
    const amountLabel = language === "zh" ? "输入金额 (AUD)" : "Or enter an amount (AUD)";
    await budget.getByLabel(amountLabel).fill("1");
    const update = page.getByRole("button", {
      name: language === "zh" ? "更新行程" : "Update trip",
      exact: true,
    });
    const finished = page.waitForEvent("requestfinished", {
      predicate: (request) => request.url().endsWith("/api/chat") && request.method() === "POST",
      timeout: 240_000,
    });
    await update.click();
    await finished;
    await page.waitForFunction(
      () => document.querySelectorAll(".msg-item--user .msg-item__bubble").length >= 2,
    );
    const message = (await page.locator(".msg-item--user .msg-item__bubble").last().innerText())
      .replace(/\s+/g, " ")
      .trim();
    check(
      message ===
        (language === "zh" ? "将预算调整为 AUD 1.00。" : "Change the budget to AUD 1.00."),
      `${language}: the budget edit copy is localized (${message})`,
    );
    check(
      !/\b\d{4}-\d{2}-\d{2}\b/.test(message) && !/accommodation preferences/i.test(message),
      `${language}: the edit copy has no ISO dates or false accommodation claim`,
    );
    const request = requests.filter((item) => item.language === language).at(-1)?.body;
    check(
      request?.brief?.budgetTotal === 1,
      `${language}: planner still receives the new budget`,
      JSON.stringify(request?.brief),
    );
    await page.screenshot({ path: `${OUT}/${language}-budget-edit.png`, fullPage: true });
    check(errors.length === 0, `${language}: no page errors`);
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, requests }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
