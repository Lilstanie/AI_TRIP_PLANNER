import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const { chromium } = require("playwright");
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = resolve(web, "tests/e2e/fixtures/route-mode-locale");
const output = resolve(web, "output/playwright/route-mode-locale");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: web,
  server: { host: "127.0.0.1", port: 0, fs: { allow: [resolve(web, "../..")] } },
  resolve: {
    alias: [
      {
        find: /^(?:@\/components\/account\/AccountProvider|\.\/AccountProvider)$/,
        replacement: resolve(fixture, "account.ts"),
      },
      { find: "@", replacement: web },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  define: { "process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID": JSON.stringify("DEMO_MAP_ID") },
});
await server.listen();
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const failures = [];
const results = [];
try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "Sydney", preferences: [], interests: [], dietary: [] },
          memberships: [],
          assistant: { style: "neutral", memory: true },
          dataMode: "mock",
          appearance: "light",
          displayCurrency: "AUD",
          language: "en",
          updatedAt: "2026-10-27T00:00:00.000Z",
        }),
      );
    });
    const localeEvidence = { zh: [], en: [] };
    try {
      await page.goto(
        `${server.resolvedUrls.local[0]}tests/e2e/fixtures/route-mode-locale/index.html`,
      );
      await page.locator('.google-map[data-provider="osm"][data-map-ready="true"]').waitFor();
      const badges = page.locator("trip-libre-marker:has(.trip-map-leg-mode)");
      const titles = async () =>
        badges.evaluateAll((markers) => markers.map((marker) => marker.getAttribute("title")));
      await page.waitForFunction(
        () => document.querySelectorAll(".trip-map-leg-mode").length === 4,
      );
      assert.deepEqual((await titles()).sort(), ["Cycle", "Drive", "Public transport", "Walk"]);
      assert.equal(await page.locator(".trip-map-leg-mode .icon").count(), 4);
      assert.equal(await page.locator("trip-libre-marker:has(.trip-map-leg-mode)").count(), 4);
      assert.equal(
        await page.locator(".trip-map-leg-mode").count(),
        4,
        "the fifth f→g itinerary leg is unverified and must not create a mode badge",
      );

      await page.getByRole("button", { name: "Day one" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".trip-map-leg-mode").length === 2,
      );
      assert.deepEqual((await titles()).sort(), ["Public transport", "Walk"]);
      await page.getByRole("button", { name: "Day two" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".trip-map-leg-mode").length === 2,
      );
      assert.deepEqual((await titles()).sort(), ["Cycle", "Drive"]);
      await page.getByRole("button", { name: "All days" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".trip-map-leg-mode").length === 4,
      );

      await page.getByRole("button", { name: "中文" }).click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid=locale]")?.textContent === "zh",
      );
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("trip-libre-marker:has(.trip-map-leg-mode)")]
            .map((marker) => marker.getAttribute("title"))
            .sort()
            .join("|") === "公共交通|步行|驾车|骑行",
      );
      localeEvidence.zh = await titles();
      await page.getByRole("button", { name: "English" }).click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid=locale]")?.textContent === "en",
      );
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll("trip-libre-marker:has(.trip-map-leg-mode)")]
            .map((marker) => marker.getAttribute("title"))
            .sort()
            .join("|") === "Cycle|Drive|Public transport|Walk",
      );
      localeEvidence.en = await titles();
      assert.deepEqual(localeEvidence.zh.sort(), ["公共交通", "步行", "驾车", "骑行"]);
      assert.deepEqual(localeEvidence.en.sort(), ["Cycle", "Drive", "Public transport", "Walk"]);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
      await page.screenshot({ path: resolve(output, `${viewport.name}.png`), fullPage: true });
      results.push({
        viewport: viewport.name,
        status: "passed",
        verifiedModeBadges: 4,
        itineraryLegs: 5,
        unverifiedArc: "f→g has no mode badge",
        localeEvidence,
        browserMessages: errors,
      });
    } catch (error) {
      failures.push({ viewport: viewport.name, error: String(error), errors, localeEvidence });
      await page.screenshot({
        path: resolve(output, `${viewport.name}-failure.png`),
        fullPage: true,
      });
      console.error(`${viewport.name} failure`, error);
      results.push({
        viewport: viewport.name,
        status: "failed",
        error: String(error),
        errors,
        localeEvidence,
      });
    }
    await context.close();
  }
} finally {
  await writeFile(
    resolve(output, "results.json"),
    `${JSON.stringify({ results, failures }, null, 2)}\n`,
  );
  await browser.close();
  await server.close();
}
if (failures.length) process.exitCode = 1;
