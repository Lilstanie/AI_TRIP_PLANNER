import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/cjk-reveal-wrap", process.env.LABEL ?? "run");
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 800 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    locale: "zh-CN",
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language: "zh",
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-24T00:00:00Z",
      }),
    );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const notNow = page.getByRole("button", { name: "暂不" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
  await page.getByRole("button", { name: "墨尔本 → 悉尼 · 5 天" }).click();
  await page.locator(".msg-item--agent .msg-reveal__word").first().waitFor({ timeout: 240_000 });
  await page.waitForTimeout(500);

  const words = await page.locator(".msg-item--agent .msg-reveal__word").evaluateAll((els) =>
    els.map((el) => {
      const body = el.closest(".msg-item__body").getBoundingClientRect();
      const word = el.getBoundingClientRect();
      return {
        text: el.textContent.slice(0, 24),
        display: getComputedStyle(el).display,
        overflows: word.right > body.right + 1,
      };
    }),
  );

  check(words.length > 0, "the Chinese reply is revealed as word spans", words.length);
  check(
    words.every((word) => word.display === "inline"),
    "reveal word spans are inline so Chinese text can wrap at character boundaries",
    words.filter((word) => word.display !== "inline").map((word) => word.display),
  );
  check(
    words.every((word) => !word.overflows),
    "no reveal word spans overflow the message body at phone width",
    words.filter((word) => word.overflows).map((word) => word.text),
  );
  await page.screenshot({ path: `${OUT}/zh-reply.png` });
  check(errors.length === 0, "browser has no page errors", errors);
  await context.close();
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
