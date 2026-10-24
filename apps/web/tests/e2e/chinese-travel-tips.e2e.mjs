import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/chinese-travel-tips", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const COPY = {
  en: { chip: "Melbourne → Sydney · 5 days", notNow: "Not now", trip: /^Trip/ },
  zh: { chip: "墨尔本 → 悉尼 · 5 天", notNow: "暂不", trip: /^行程/ },
};
const ENGLISH =
  /\b(the|and|before|verify|check|candidate|suggested|confirm|follow|travel|layers|shoes|documents|requirements|passport|weather)\b/i;

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
    const bodies = await tips.locator("p, li").allInnerTexts();
    const strip = page.locator("#phone-panel-trip .day-strip");
    const stops = [];
    for (let day = 0; day < (await strip.getByRole("tab").count()); day += 1) {
      await strip.getByRole("tab").nth(day).click();
      await page.waitForTimeout(300);
      stops.push(
        ...(await page.locator("#phone-panel-trip .timeline-stop__detail").allInnerTexts()),
      );
    }
    writeFileSync(resolve(OUT, `${language}.json`), JSON.stringify({ bodies, stops }, null, 2));
    check(bodies.length >= 6, `${language}: Travel tips bodies are shown`, bodies.length);
    check(stops.length >= 1, `${language}: stop descriptions are shown`, stops.length);
    if (language === "zh") {
      const english = bodies.filter((text) => ENGLISH.test(text));
      check(!english.length, "zh: Travel tips bodies are Chinese", english);
      const englishStops = stops.filter((text) => ENGLISH.test(text));
      check(!englishStops.length, "zh: stop descriptions are Chinese", englishStops);
      check(
        bodies.some((text) => text.includes("舒适的步行鞋")),
        "zh: packing list is Chinese",
      );
    } else {
      check(
        bodies.some((text) =>
          text.includes(
            "Follow posted venue rules and check official local visitor guidance before travel.",
          ),
        ) && bodies.some((text) => text.includes("Comfortable walking shoes")),
        "en: English Travel tips are unchanged",
      );
      check(
        stops.some((text) => text.includes("is a suggested stop; confirm timing")),
        "en: English stop descriptions are unchanged",
      );
    }
    await tips.scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(OUT, `${language}.png`), fullPage: true });
    check(errors.length === 0, `${language}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(resolve(OUT, "summary.json"), JSON.stringify({ results }, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
