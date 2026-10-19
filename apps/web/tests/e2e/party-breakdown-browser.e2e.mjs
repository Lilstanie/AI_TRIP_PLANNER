import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/party-breakdown-browser");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
      locale: "en-AU",
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    await page
      .getByRole("textbox", { name: "Message AI Trip Planner" })
      .fill(
        "Plan a 3-day trip to Sydney from 2026-12-01 to 2026-12-03 for 1 adult and 1 child aged 3, total budget AUD 3000. We are staying with friends and need no accommodation.",
      );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
    for (const reopened of [false, true]) {
      if (reopened) {
        await page.reload();
        await page.waitForLoadState("networkidle");
        if (width === 390) await page.getByRole("tab", { name: "Mine", exact: true }).click();
        else
          await page
            .locator(".sidebar-nav")
            .getByRole("button", { name: /^Trips/ })
            .click();
        await page.locator(".trip-card").first().click();
      }
      if (width === 390) {
        await page.locator(".phone-topbar__title-button").click();
        await page.locator('.facts-sheet__row[data-fact="who"]').click();
      } else {
        await page
          .locator(".fact-chips")
          .getByRole("button", { name: /1 adult, 1 child/ })
          .click();
      }
      const sheet = page.getByRole("dialog", { name: "Who", exact: true });
      for (const [label, count] of [
        ["Adults", 1],
        ["Children", 1],
        ["Infants", 0],
        ["Seniors", 0],
        ["Pets", 0],
      ]) {
        await sheet.getByLabel(`${label}: ${count}`, { exact: true }).waitFor();
      }
      await page.screenshot({
        path: `${out}/${width}-${reopened ? "reopened" : "planned"}.png`,
        fullPage: true,
      });
      results.push({ width, reopened, adults: 1, children: 1, infants: 0, seniors: 0, pets: 0 });
      await page.keyboard.press("Escape");
    }
    assert.deepEqual(errors, []);
    await context.close();
    page = undefined;
  }
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.html`, await page.content());
  }
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
