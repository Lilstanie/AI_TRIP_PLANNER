import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/composer-input-touch-target", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const TOUCH_PX = 44;
const TAP_OFFSET_PX = 40;
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
    [390, 844],
    [1440, 900],
  ]) {
    const phone = width <= 520;
    const label = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "reduce",
      locale: "en-AU",
    });
    await context.addInitScript(() => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language: "en",
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-22T00:00:00Z",
        }),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const input = page.locator("textarea.composer__input");
    await input.waitFor();
    const prompt = page.locator(".location-prompt");
    await prompt.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await prompt.count()) {
      await page.getByRole("button", { name: "Not now" }).click();
      await prompt.waitFor({ state: "detached" });
    }

    const box = await input.boundingBox();
    check(
      phone ? box.height >= TOUCH_PX : box.height < TOUCH_PX,
      `${label} the message field is ${phone ? "at least" : "below"} ${TOUCH_PX} px high`,
      { height: Math.round(box.height) },
    );

    if (phone) {
      const tapY = box.y + TAP_OFFSET_PX;
      await page.mouse.click(box.x + box.width / 2, tapY);
      const focused = await page.evaluate(() => document.activeElement?.className ?? "");
      check(
        focused.includes("composer__input"),
        `${label} a tap ${TAP_OFFSET_PX} px below the top of the field focuses it`,
        { tapY: Math.round(tapY), focused },
      );
    }

    const overflow = await page.evaluate(
      () => document.scrollingElement.scrollWidth - window.innerWidth,
    );
    check(overflow <= 0, `${label} page has no horizontal overflow`, overflow);
    await page.screenshot({ path: `${OUT}/${label}.png` });
    check(errors.length === 0, `${label} browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
