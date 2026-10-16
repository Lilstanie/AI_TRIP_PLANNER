import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { BUDGET_FACT_CHIP, normalizeText } from "./support/e2e-helpers.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/budget-amount-limit");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const TOO_LARGE_NOTICE = "Enter a total budget of AUD 1,000,000 or less.";
const NOT_POSITIVE_NOTICE = "Enter a total budget above zero.";

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
  const chip = () => page.locator(".fact-chip").filter(BUDGET_FACT_CHIP).first();
  await chip().waitFor();
  await chip().click();

  const sheet = () => page.getByRole("dialog", { name: "Budget", exact: true });
  const amount = () => sheet().getByLabel(/Or enter an amount/);
  const notice = (text) => sheet().getByText(text, { exact: true });
  await sheet().waitFor();

  await amount().fill("99999999999999999999");
  await amount().press("Enter");
  await page.waitForTimeout(400);
  check(await sheet().isVisible(), "a 20-digit amount keeps the Budget sheet open");
  check(
    await notice(TOO_LARGE_NOTICE).isVisible(),
    "a 20-digit amount shows the AUD 1,000,000 limit",
  );
  check(
    !(await page.locator(".fact-chips").innerText()).includes("100,000,000"),
    "a 20-digit amount is not saved as the budget",
  );

  await amount().fill("-50");
  await amount().press("Enter");
  await page.waitForTimeout(400);
  check(
    await notice(NOT_POSITIVE_NOTICE).isVisible(),
    "a negative amount still shows the zero notice",
  );

  await amount().fill("2000");
  await amount().press("Enter");
  await sheet().waitFor({ state: "hidden" });
  const chips = normalizeText(await page.locator(".fact-chips").innerText());
  check(
    chips.includes("Budget: AUD 2,000.00"),
    "a normal amount saves and the Budget chip reads AUD 2,000.00",
  );

  await page.screenshot({ path: `${OUT}/budget-after-save.png`, fullPage: true });
  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ results }, null, 2));
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
