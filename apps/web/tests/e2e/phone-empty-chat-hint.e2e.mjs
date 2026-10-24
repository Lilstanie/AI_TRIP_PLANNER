import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-empty-chat-hint", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const COPY = {
  en: { notNow: "Not now", chat: /^Chat/, bar: "bar at the top", button: "Add trip details" },
  zh: { notNow: "暂不", chat: /^聊天/, bar: "顶部栏", button: "添加行程信息" },
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
      if (phone) await page.locator(".phone-tabbar").getByRole("tab", { name: copy.chat }).click();
      const empty = page.locator(".chat-empty:visible");
      await empty.waitFor();
      const hint = await empty.locator("p").first().innerText();
      const chipsShown = await page
        .locator(".fact-chips__scroller")
        .evaluate((node) => node.getBoundingClientRect().width > 0)
        .catch(() => false);
      const button = empty.getByRole("button", { name: copy.button, exact: true });
      if (phone) {
        check(
          !hint.includes(copy.bar),
          `${label}: the hint does not point at a bar of facts that is hidden`,
          { hint, chipsShown },
        );
        check(
          hint.includes(copy.button) && (await button.isVisible()),
          `${label}: the hint names the visible "${copy.button}" button`,
          hint,
        );
      } else {
        check(
          hint.includes(copy.bar) && chipsShown,
          `${label}: the desktop hint still points at the visible bar at the top`,
          { hint, chipsShown },
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
