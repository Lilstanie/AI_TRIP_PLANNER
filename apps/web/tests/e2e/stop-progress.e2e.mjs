import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, installSeededItinerary } from "./trip-setup.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const key = JSON.parse(
  readFileSync("apps/web/lib/workspace/catalog.ts", "utf8").match(
    /export const CATALOG_KEY = ("[^"]+")/,
  )[1],
);
const out = resolve("output/playwright/stop-progress", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await installSeededItinerary(page, [
    {
      id: "museum",
      kind: "activity",
      day: 1,
      detail: "Museum visit",
      note: "Meet Alex.",
      booked: true,
      estCost: 175,
      startTime: "13:00",
      endTime: "16:00",
    },
    {
      id: "gallery",
      kind: "activity",
      day: 1,
      detail: "Gallery visit",
      location: "Art gallery",
      startTime: "16:30",
      endTime: "18:00",
    },
  ]);
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await planSuggestedTrip(page);
  const saved = () =>
    page.evaluate((key) => {
      const catalog = JSON.parse(localStorage.getItem(key));
      const trip = catalog.trips.find((trip) => trip.id === catalog.activeTripId);
      return {
        item: trip.snapshot.plan.sections
          .find((s) => s.id === "itinerary")
          .proposal.items.find((i) => i.id === "museum"),
        total: trip.snapshot.plan.estTotal,
      };
    }, key);
  const original = await saved();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width === 390) await page.getByRole("tab", { name: /^Trip/ }).click();
    const row = page.locator(".timeline-stop").filter({ hasText: "Museum visit" }).first();
    assert.equal(await row.getByText("Planned", { exact: true }).count(), 0);
    assert.equal(await row.getByText(/^(Visited|Skipped)$/).count(), 0);
    results.push({ width, defaultState: "planned" });
    for (const [state, label] of [
      ["visited", "Visited"],
      ["skipped", "Skipped"],
      ["planned", "Planned"],
    ]) {
      await row.getByRole("button", { name: /Actions for/ }).click();
      await page.getByRole("menuitem", { name: `Mark as ${state}`, exact: true }).click();
      if (state === "planned")
        await row.getByText(/^(Visited|Skipped)$/).waitFor({ state: "hidden" });
      else await row.getByText(label, { exact: true }).waitFor();
      assert.equal(await row.getByText("Planned", { exact: true }).count(), 0);
      const nextRow = page.locator(".timeline-stop").filter({ hasText: "Gallery visit" }).first();
      assert.equal(
        await nextRow.locator(".timeline-stop__main").getAttribute("aria-expanded"),
        "false",
      );
      await page.waitForFunction(
        ({ key, state }) => {
          const c = JSON.parse(localStorage.getItem(key));
          return (
            c.trips
              .find((t) => t.id === c.activeTripId)
              ?.snapshot.plan.sections.find((s) => s.id === "itinerary")
              ?.proposal.items.find((i) => i.id === "museum")?.progress === state
          );
        },
        { key, state },
      );
      const value = await saved();
      const { progress, ...unchanged } = value.item;
      assert.deepEqual(unchanged, original.item);
      assert.equal(value.total, original.total);
      await page.screenshot({ path: `${out}/${width}-${state}.png`, fullPage: true });
      await page.reload();
      await page.locator(".workspace-app").waitFor();
      await page.waitForLoadState("networkidle");
      if (width === 390) await page.getByRole("tab", { name: "Mine", exact: true }).click();
      else
        await page
          .locator(".sidebar-nav")
          .getByRole("button", { name: /^Trips/ })
          .click();
      await openTripWorkspace(page, page.locator(".trip-card").first());
      if (width === 390) await page.getByRole("tab", { name: /^Trip/ }).click();
      else await page.getByRole("button", { name: "Open your trip", exact: true }).click();
      if (state === "planned")
        await row.getByText(/^(Visited|Skipped)$/).waitFor({ state: "hidden" });
      else await row.getByText(label, { exact: true }).waitFor();
      assert.equal(await row.getByText("Planned", { exact: true }).count(), 0);
      assert.equal(
        await row.locator(".timeline-stop__main").getAttribute("aria-expanded"),
        "false",
      );
      results.push({
        width,
        state,
        persisted: true,
        fieldsPreserved: true,
        nextStopSelected: false,
      });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const keyboardRow = page.locator(".timeline-stop").filter({ hasText: "Museum visit" }).first();
  const actions = keyboardRow.getByRole("button", { name: /Actions for/ });
  await actions.focus();
  await page.keyboard.press("Enter");
  const visitAction = page.getByRole("menuitem", { name: "Mark as visited", exact: true });
  await visitAction.focus();
  await page.keyboard.press("Enter");
  await keyboardRow.getByText("Visited", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await keyboardRow.getByText("Visited", { exact: true }).waitFor({ state: "hidden" });
  results.push({ keyboardActivation: true, undo: true });
  await page.getByRole("button", { name: "Close your trip", exact: true }).click();
  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  await page.getByRole("button", { name: "打开你的行程", exact: true }).click();
  const row = page.locator(".timeline-stop").filter({ hasText: "Museum visit" }).first();
  assert.equal(await row.getByText(/^(待游览|已游览|已跳过)$/).count(), 0);
  await row
    .getByRole("button", { name: /Museum visit/ })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "标记为已游览", exact: true }).click();
  await row.getByText("已游览", { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/zh-visited.png`, fullPage: true });
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await row.getByText("已游览", { exact: true }).waitFor({ state: "hidden" });
  results.push({ locale: "zh", undo: true });
  await page.evaluate((key) => {
    const catalog = JSON.parse(localStorage.getItem(key));
    for (const entry of [...catalog.trips, ...catalog.conversations]) {
      const item = entry.snapshot?.plan.sections
        .find((section) => section.id === "itinerary")
        ?.proposal?.items.find((item) => item.id === "museum");
      if (item) item.progress = "invalid";
    }
    localStorage.setItem(key, JSON.stringify(catalog));
  }, key);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.locator(".sidebar-nav").getByRole("button", { name: /^行程/ }).click();
  await openTripWorkspace(page, page.locator(".trip-card").first());
  await page.getByRole("button", { name: "打开你的行程", exact: true }).click();
  await row.getByText(/^(待游览|已游览|已跳过)$/).waitFor({ state: "hidden" });
  results.push({ invalidSavedProgress: "planned" });
  assert.deepEqual(errors, []);
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
