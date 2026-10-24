import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/return-flight-fare-label", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const COPY = {
  en: {
    chip: "Melbourne → Sydney · 5 days",
    notNow: "Not now",
    trip: /^Trip/,
    label: "Included in the outbound fare",
  },
  zh: { chip: "墨尔本 → 悉尼 · 5 天", notNow: "暂不", trip: /^行程/, label: "含在去程票价中" },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const copy = COPY[language];
    const context = await browser.newContext({
      viewport: { width: 400, height: 800 },
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
          updatedAt: "2026-10-24T00:00:00Z",
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const notNow = page.getByRole("button", { name: copy.notNow });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await page.getByRole("button", { name: copy.chip }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
    const strip = page.locator("#phone-panel-trip .day-strip");
    await strip.waitFor();
    await strip.getByRole("tab").last().click();
    await page.waitForTimeout(500);
    const costs = await page.locator("#phone-panel-trip .timeline-row__cost").allInnerTexts();
    check(
      costs.includes(copy.label),
      `${language}: the return flight row says the fare is part of the outbound flight`,
      costs,
    );
    check(
      !costs.some((text) => /\bin$/.test(text.trim())),
      `${language}: no price line ends mid-sentence`,
      costs,
    );
    await page
      .locator("#phone-panel-trip li", { hasText: copy.label })
      .locator("[aria-expanded]")
      .first()
      .click();
    const card = await page.locator("#phone-panel-trip .timeline-booking__card").innerText();
    check(
      card.includes(copy.label) && !card.includes("flight in"),
      `${language}: the opened return flight card says the same`,
      card,
    );
    await page.screenshot({ path: `${OUT}/${language}-day5.png` });
    await strip.getByRole("tab").first().click();
    await page.waitForTimeout(300);
    const firstDay = await page.locator("#phone-panel-trip .timeline-row__cost").allInnerTexts();
    check(
      firstDay.some((text) => /\d/.test(text)) && !firstDay.includes(copy.label),
      `${language}: the outbound flight row on day 1 keeps its price`,
      firstDay,
    );
    check(errors.length === 0, `${language}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
