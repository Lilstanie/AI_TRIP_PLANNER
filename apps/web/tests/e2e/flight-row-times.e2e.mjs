import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/flight-row-times");
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
    day: (n) => new RegExp(`^Day ${n}\\b`),
    unset: "time not set",
  },
  zh: {
    chip: "墨尔本 → 悉尼 · 5 天",
    notNow: "暂不",
    trip: /^行程/,
    day: (n) => new RegExp(`^第 ?${n} ?天`),
    unset: "时间未定",
  },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const copy = COPY[language];
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
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
          updatedAt: "2026-10-25T00:00:00Z",
        }),
      );
    }, language);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const notNow = page.getByRole("button", { name: copy.notNow });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await page.getByRole("button", { name: copy.chip }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
    const panel = page.locator("#phone-panel-trip");
    for (const day of [1, 5]) {
      await panel
        .getByRole("tab", { name: copy.day(day) })
        .first()
        .click();
      const row = panel.locator(".timeline-fixed--flight").first();
      await row.waitFor();
      const time = (await row.locator(".timeline-row__time").innerText()).trim();
      const meta = (await row.locator(".timeline-row__meta").innerText()).trim();
      await row.screenshot({ path: `${OUT}/${language}-day-${day}.png` });
      check(
        /\d{1,2}:\d{2}/.test(time) || meta.includes(copy.unset),
        `${language}: the day ${day} flight row gives its times or says the time is not set`,
        { time, meta },
      );
    }
    check(errors.length === 0, `${language}: no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
