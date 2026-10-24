import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/weather-unavailable-once");
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
    unavailable: /weather unavailable/g,
  },
  zh: { chip: "墨尔本 → 悉尼 · 5 天", notNow: "暂不", trip: /^行程/, unavailable: /暂无天气数据/g },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const seen = {};
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
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const notNow = page.getByRole("button", { name: copy.notNow });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await page.getByRole("button", { name: copy.chip }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
    const tips = page.locator("#phone-panel-trip .trip-tips");
    await tips.waitFor();
    if (!(await tips.evaluate((node) => node.open))) await tips.locator("summary").click();
    const text = await tips.innerText();
    await tips.screenshot({ path: `${OUT}/${language}.png` });
    const statements = text.match(copy.unavailable) ?? [];
    const lines = text.split("\n").filter((line) => line.match(copy.unavailable));
    seen[language] = { statements: statements.length, lines };
    check(statements.length > 0, `${language}: the plan has days without a forecast`);
    check(
      statements.length === lines.length && lines.length <= 2,
      `${language}: the unavailable statement appears at most once per city (Melbourne, Sydney)`,
      statements.length,
    );
    check(errors.length === 0, `${language}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results, seen }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
