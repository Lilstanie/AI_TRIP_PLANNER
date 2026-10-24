import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-map-empty-hint", process.env.LABEL ?? "run");
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
    notNow: "Not now",
    map: /^Map/,
    phoneHint: "tap New trip at the top",
    newTrip: "New trip",
    deskHint: "bar at the top",
  },
  zh: {
    notNow: "暂不",
    map: /^地图/,
    phoneHint: "点击顶部的“新行程”",
    newTrip: "新行程",
    deskHint: "顶部栏",
  },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [375, 812],
    [520, 900],
    [1440, 900],
  ]) {
    const phone = width <= 520;
    for (const language of ["en", "zh"]) {
      const copy = COPY[language];
      const label = `${language}-${width}`;
      const context = await browser.newContext({
        viewport: { width, height },
        ...(phone ? { isMobile: true, hasTouch: true } : {}),
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
      if (phone) await page.locator(".phone-tabbar").getByRole("tab", { name: copy.map }).click();
      const empty = page.locator(".trip-map-canvas--empty:visible");
      await empty.waitFor();
      const hint = await empty.locator(".map-placeholder p").first().innerText();
      if (phone) {
        check(
          hint.includes(copy.phoneHint) && !hint.includes(copy.deskHint),
          `${label}: the map hint names the visible New trip control on phones`,
          hint,
        );
        check(
          await page.getByRole("button", { name: copy.newTrip }).first().isVisible(),
          `${label}: the New trip control named by the hint is visible`,
        );
      } else {
        check(
          hint.includes(copy.deskHint),
          `${label}: the desktop map hint still points at the bar at the top`,
          hint,
        );
      }
      await empty.screenshot({ path: `${OUT}/${label}.png` });
      check(errors.length === 0, `${label}: browser has no page errors`, errors);
      await context.close();
    }
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
