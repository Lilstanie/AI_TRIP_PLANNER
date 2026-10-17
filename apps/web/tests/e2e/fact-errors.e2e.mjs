import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/fact-errors");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

try {
  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 1024, height: 768 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");

  await page.getByRole("button", { name: "When", exact: true }).click();
  await page.locator('.trip-calendar [role="gridcell"] button:not(:disabled)').first().click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dateError = page.locator("#fact-dates-error");
  await dateError.waitFor({ state: "visible" });
  check((await dateError.getAttribute("role")) === "alert", "date validation is an alert");
  check(
    await page.locator('.trip-calendar button[aria-describedby="fact-dates-error"][aria-invalid="true"]').count() > 0,
    "calendar day controls reference the invalid-range error",
  );
  check(
    await page.getByText("Choose an end date", { exact: true }).isVisible(),
    "an incomplete date range does not claim a valid trip duration",
  );
  await page.screenshot({ path: `${OUT}/date-error.png` });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open trip preferences" }).click();
  const preference = page.locator("#fact-preference");
  await preference.fill("vegetarian");
  await preference.press("Enter");
  await preference.fill("Vegetarian ");
  await preference.press("Enter");
  const preferenceError = page.locator("#fact-preference-error");
  await preferenceError.waitFor({ state: "visible" });
  check(
    (await preferenceError.getAttribute("role")) === "alert",
    "duplicate-preference validation is an alert",
  );
  check(
    (await preference.getAttribute("aria-describedby")) === "fact-preference-error" &&
      (await preference.getAttribute("aria-invalid")) === "true",
    "the duplicate-preference field references its error",
  );
  await page.screenshot({ path: `${OUT}/preference-error.png` });
  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results }, null, 2));
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
