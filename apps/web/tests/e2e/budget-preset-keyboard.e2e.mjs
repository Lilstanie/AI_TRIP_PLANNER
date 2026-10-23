import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { BUDGET_CHIP_FILTER } from "./support/e2e-helpers.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/budget-preset-keyboard");
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
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

  await page.goto(BASE);
  const chip = () => page.locator(".fact-chip").filter(BUDGET_CHIP_FILTER).first();
  await chip().waitFor();
  await chip().click();

  const sheet = () => page.getByRole("dialog", { name: "Budget", exact: true });
  const presets = () =>
    sheet().getByRole("radiogroup", { name: "Budget range" }).getByRole("radio");
  const presetNamed = (name) => presets().filter({ hasText: name });
  await sheet().waitFor();

  const tabStops = () =>
    presets().evaluateAll((nodes) => nodes.map((node) => node.getAttribute("tabindex")));
  const focusedText = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  const checkedNames = () =>
    presets().evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getAttribute("aria-checked") === "true")
        .map((node) => node.textContent.trim()),
    );

  check(
    JSON.stringify(await tabStops()) === JSON.stringify(["0", "-1", "-1", "-1"]),
    "with no budget set, only the first preset is a Tab stop",
  );

  await presets().first().focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  check((await focusedText()).includes("Moderate"), "ArrowRight moves focus to Moderate");
  check(
    (await checkedNames()).length === 1 && (await checkedNames())[0].includes("Moderate"),
    "ArrowRight also checks Moderate",
  );
  check(
    JSON.stringify(await tabStops()) === JSON.stringify(["-1", "0", "-1", "-1"]),
    "after checking Moderate, only Moderate is a Tab stop",
  );

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  check((await focusedText()).includes("Budget"), "ArrowLeft moves focus back to the first preset");

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(150);
  check(
    (await focusedText()).includes("Luxury"),
    "ArrowLeft from the first preset wraps to Luxury",
  );

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  check(
    (await focusedText()).includes("Budget"),
    "ArrowDown from the last preset wraps to the first",
  );

  await presetNamed("Comfort").click();
  await page.waitForTimeout(150);
  check((await checkedNames())[0]?.includes("Comfort"), "clicking Comfort checks it");

  await page.screenshot({ path: `${OUT}/presets-keyboard.png`, fullPage: true });
  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results }, null, 2));
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
