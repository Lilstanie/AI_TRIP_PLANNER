import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/short-phone-empty-chat", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    for (const language of ["en", "zh"]) {
      const label = `${width}x${height}-${language}`;
      const phone = width <= 520;
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: phone,
        hasTouch: phone,
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
            updatedAt: "2026-10-22T00:00:00Z",
          }),
        );
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.locator(".chat-empty__suggestions button").first().waitFor();
      const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
      await notNow.waitFor({ timeout: 5000 }).then(
        () => notNow.click(),
        () => {},
      );
      await page.locator(".location-prompt").waitFor({ state: "detached" });
      const layout = await page.evaluate(() => {
        const targets = [...document.querySelectorAll(".chat-empty__suggestions button")].map(
          (node) => {
            const box = node.getBoundingClientRect();
            return {
              text: node.textContent,
              top: Math.round(box.top),
              bottom: Math.round(box.bottom),
              height: Math.round(box.height),
              cut: node.scrollWidth > node.clientWidth + 1,
            };
          },
        );
        return {
          targets,
          card: Boolean(document.querySelector(".chat-empty h3")),
          overflow: document.scrollingElement.scrollWidth - window.innerWidth,
        };
      });
      check(!layout.card, `${label} has no centre empty card`);
      check(layout.targets.length >= 1, `${label} shows suggestion chips`, layout.targets.length);
      await page.screenshot({ path: `${OUT}/${label}-start.png` });
      if (phone)
        check(
          layout.targets.every((target) => target.height >= 32),
          `${label} every chip is at least 32 px high`,
          layout.targets.map((target) => [target.text, target.height]),
        );
      check(
        layout.targets.every((target) => !target.cut),
        `${label} no example label is cut`,
        layout.targets.filter((target) => target.cut),
      );
      check(layout.overflow <= 1, `${label} page does not scroll sideways`, layout.overflow);
      check(errors.length === 0, `${label} browser has no page errors`, errors);
      await context.close();
    }
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results }, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
