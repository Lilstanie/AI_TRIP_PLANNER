import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, touchSized } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-undo-hit-area");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await page.setViewportSize({ width: 375, height: 812 });
  await planSuggestedTrip(page);

  const stop = page
    .locator(".timeline-stop")
    .filter({ has: page.getByRole("button", { name: /^Actions for / }) })
    .first();
  await stop.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Mark as visited", exact: true }).click();

  const undo = page.locator(".item-undo button").first();
  await undo.waitFor();
  await undo.scrollIntoViewIfNeeded();
  const box = await undo.boundingBox();
  assert.ok(box, "the Undo button has a box");
  const rect = await undo.evaluate((element) => {
    const { x, y, right, bottom } = element.getBoundingClientRect();
    return { x, y, right, bottom };
  });
  const fullyVisible = rect.x >= 0 && rect.y >= 0 && rect.right <= 375 && rect.bottom <= 812;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  results.push({
    viewport: { width: 375, height: 812 },
    undoWidth: Math.round(box.width),
    undoHeight: Math.round(box.height),
    undoViewportBounds: rect,
    undoFullyVisible: fullyVisible,
    documentWidth: overflow,
    pageErrors: errors,
  });
  await page.screenshot({ path: `${out}/undo.png` });
  writeFileSync(`${out}/results.json`, `${JSON.stringify(results, null, 2)}\n`);

  assert.ok(touchSized(box.width), `Undo is at least 44 px wide (was ${box.width})`);
  assert.ok(touchSized(box.height), `Undo is at least 44 px high (was ${box.height})`);
  assert.equal(fullyVisible, true, "the complete Undo button is visible in the phone viewport");
  assert.equal(overflow, 375, "the phone layout has no horizontal scroll");
  assert.deepEqual(errors, [], "no page errors");
  console.log("ok   Undo button is at least 44 × 44 px on a 375 px phone", results[0]);
} finally {
  await browser.close();
}
