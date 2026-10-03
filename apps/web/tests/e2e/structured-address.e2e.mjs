// Failure inventory: missing city/country or origin accepted; paid autocomplete called;
// coordinates requested on load; location lookup fails/denied; stale location overwrites typing;
// addresses lost on reopen; phone fields/action clipped. Artifacts: output/playwright/structured-address.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/structured-address");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok, message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["geolocation"],
    geolocation: { latitude: -33.8688, longitude: 151.2093 },
  });
  const page = await context.newPage();
  let lookups = 0,
    autocomplete = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("request", (request) => {
    if (request.url().includes("/api/places/search")) autocomplete++;
  });
  let delay = false,
    release;
  await page.route("**/api/location/reverse", async (route) => {
    lookups++;
    if (delay)
      await new Promise((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json: {
        address: {
          suburb: "Glebe",
          city: "Sydney",
          state: "New South Wales",
          country: "Australia",
        },
      },
    });
  });
  await page.goto(BASE);
  await page.getByRole("button", { name: "Where", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Where", exact: true });
  const destination = dialog.getByRole("group", { name: "Destination 1", exact: true });
  const origin = dialog.getByRole("group", { name: "Departing from", exact: true });
  check(lookups === 0, "opening the editor does not request an address lookup");
  await destination.getByLabel("City *", { exact: true }).fill("Tokyo");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  check(await dialog.getByRole("alert").isVisible(), "missing country and origin prevent saving");
  await destination.getByLabel("Country *", { exact: true }).fill("Japan");
  await origin.getByRole("button", { name: "Get current location", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#origin-city")?.value === "Sydney");
  check(
    (await origin.getByLabel("Country *", { exact: true }).inputValue()) === "Australia",
    "explicit location lookup fills city and country",
  );
  check(lookups === 1, "one click makes one address lookup");
  await dialog.getByRole("button", { name: "Add destination", exact: true }).click();
  const second = dialog.getByRole("group", { name: "Destination 2", exact: true });
  await second.getByLabel("City *", { exact: true }).fill("Kyoto");
  await second.getByLabel("Country *", { exact: true }).fill("Japan");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: /^Destination:/ }).click();
  check(
    (await origin.getByLabel("Suburb (optional)").inputValue()) === "Glebe",
    "reopening retains structured location fields",
  );
  check(
    (await dialog
      .getByRole("group", { name: "Destination 2", exact: true })
      .getByLabel("City *", { exact: true })
      .inputValue()) === "Kyoto",
    "multiple destinations survive save",
  );
  await dialog.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => {})),
    );
  });
  await page.screenshot({ path: `${OUT}/desktop-en.png`, fullPage: true });
  delay = true;
  await origin.getByRole("button", { name: "Get current location", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".address-locate")?.disabled);
  const deadline = Date.now() + 10000;
  while (!release && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  if (!release) throw new Error("Location request did not arrive within 10 seconds");
  await origin.getByLabel("City *", { exact: true }).fill("Melbourne");
  const responseReady = page.waitForResponse((response) =>
    response.url().includes("/api/location/reverse"),
  );
  release();
  await responseReady;
  check(
    (await origin.getByLabel("City *", { exact: true }).inputValue()) === "Melbourne",
    "a late location result does not overwrite manual input",
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^目的地：/ }).click();
  const phone = page.getByRole("dialog", { name: "去哪里", exact: true });
  await phone.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => {})),
    );
  });
  check(
    await phone.getByRole("button", { name: "保存", exact: true }).isVisible(),
    "phone keeps Save available",
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "phone has no horizontal overflow",
  );
  await page.screenshot({ path: `${OUT}/phone-zh.png`, fullPage: true });
  check(autocomplete === 0, "manual entry never calls paid place autocomplete");
  check(errors.length === 0, `no page errors: ${errors.join(" | ")}`);
  const invalid = await page.request.post(`${BASE}/api/location/reverse`, {
    data: { latitude: 91, longitude: 151 },
  });
  check(invalid.status() === 400, "API rejects invalid coordinates before contacting provider");
  await context.close();

  const denied = await browser.newContext();
  await denied.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: (_success, failure) => failure({ code: 1 }) },
    }),
  );
  const deniedPage = await denied.newPage();
  await deniedPage.goto(BASE);
  await deniedPage.getByRole("button", { name: "Where", exact: true }).click();
  await deniedPage.getByRole("button", { name: "Get current location", exact: true }).click();
  check(
    await deniedPage
      .getByRole("status")
      .filter({ hasText: "Location permission denied" })
      .isVisible(),
    "permission denial directs the user to manual entry",
  );
  await denied.close();
} finally {
  await browser.close();
  writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
