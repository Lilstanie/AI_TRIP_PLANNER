import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/who-sheet-needs-adult");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const ADULT_NOTICE = "Add at least one adult or senior. Children cannot travel alone.";
const WHOLE_NUMBER_NOTICE = "Enter a whole number of travellers, 1 or more.";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

  await page.goto(BASE);
  await page.getByRole("button", { name: "Who", exact: true }).waitFor();

  const sheet = () => page.getByRole("dialog", { name: "Who", exact: true });
  const save = () => sheet().getByRole("button", { name: "Save", exact: true });
  const stepper = (name) => sheet().getByRole("button", { name, exact: true });
  const notice = (text) => sheet().getByText(text, { exact: true });

  await page.getByRole("button", { name: "Who", exact: true }).click();
  await sheet().waitFor();

  const adults = sheet().locator(".fact-stepper__value").first();
  const announced = async () => ({
    role: await adults.getAttribute("role"),
    name: await adults.getAttribute("aria-label"),
    text: (await adults.textContent()).trim(),
    visible: (await adults.evaluate((node) => node.lastChild.textContent)).trim(),
  });
  const adultsBefore = await announced();
  await stepper("Add an adult").click();
  const adultsAfter = await announced();
  check(
    adultsAfter.role === "status" &&
      adultsAfter.text === adultsAfter.name &&
      adultsAfter.text === `Adults: ${Number(adultsBefore.visible) + 1}` &&
      adultsAfter.visible === String(Number(adultsBefore.visible) + 1),
    `adult stepper: the count is a status region that reads "${adultsAfter.text}" and shows ${adultsAfter.visible}`,
  );
  await sheet().screenshot({ path: `${OUT}/adult-count.png` });
  await stepper("Remove an adult").click();

  await stepper("Add a child").click();
  await save().click();
  await page.waitForTimeout(400);
  check(await sheet().isVisible(), "children only: Save keeps the Who sheet open");
  check(
    await notice(ADULT_NOTICE).isVisible(),
    "children only: the sheet says an adult or senior is needed",
  );
  check(
    await sheet().locator("#fact-groupSize-error").isVisible(),
    "children only: the travellers error is shown under the steppers",
  );
  await sheet().screenshot({ path: `${OUT}/children-only.png` });

  await stepper("Remove a child").click();
  await stepper("Add a pet").click();
  await save().click();
  await page.waitForTimeout(400);
  check(
    (await notice(WHOLE_NUMBER_NOTICE).isVisible()) && (await sheet().isVisible()),
    "pets only: the whole-number notice still keeps the sheet open",
  );

  await stepper("Remove a pet").click();
  await stepper("Add an adult").click();
  await stepper("Add a child").click();
  await save().click();
  await sheet().waitFor({ state: "hidden" });
  check(
    (await page.locator(".fact-chips").innerText()).includes("1 adult, 1 child"),
    "adult and child: Save closes the sheet and the Who chip reads 1 adult, 1 child",
  );

  check(errors.length === 0, "no page errors");
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
