import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-planning-flow", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(`${ok ? "ok" : "FAIL"} ${name}: ${JSON.stringify(observed)}`);
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      locale: language === "zh" ? "zh-CN" : "en-AU",
    });
    await context.addInitScript((language) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language,
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-26T00:00:00Z",
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    const suggestions = page.getByLabel(language === "zh" ? "示例行程" : "Example trips");
    await suggestions.waitFor();
    const count = await suggestions.getByRole("button").count();
    check(count > 0 && count <= 2, `${language}: phone offers at most two blank examples`, count);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
      `${language}: short phone has no horizontal overflow`,
    );
    await page.screenshot({ path: `${OUT}/${language}-blank.png` });
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ type: "needs_info", question: "Which dates?", known: {} }),
      }),
    );
    await page.locator(".composer textarea").fill("Plan a trip to Sydney");
    await page
      .getByRole("button", { name: language === "zh" ? "发送" : "Send", exact: true })
      .click();
    await page.getByText("Which dates?", { exact: true }).waitFor();
    check((await suggestions.count()) === 0, `${language}: first message removes examples`);
    check(errors.length === 0, `${language}: no page errors`, errors);
    await page.screenshot({ path: `${OUT}/${language}-message.png` });
    await context.close();
  }
} catch (error) {
  check(false, "phone planning flow completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results }, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
