import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, settle } from "./trip-setup.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/chat-rows-same-trip");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name, detail) => {
  results.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  const mine = page.locator(".phone-mine");
  const selectMine = async () => {
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
    await mine.waitFor();
  };
  await planSuggestedTrip(page);
  await selectMine();
  await mine
    .locator(".chats-panel__actions")
    .getByRole("button", { name: "New trip", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await settle(page, 700);
  await planSuggestedTrip(page);
  await selectMine();

  const rows = (selector) =>
    mine.locator(selector).evaluateAll((items) =>
      items.map((item) => ({
        title: item.querySelector(".history-item__title")?.textContent.trim(),
        meta: item.querySelector(".history-item__meta")?.textContent.trim() ?? "",
      })),
    );
  const chats = (await rows(".history-item:not(.history-item--trip)")).filter(({ meta }) =>
    meta.startsWith("Trip to Sydney"),
  );
  await page.screenshot({ path: `${out}/mine-chats.png`, fullPage: true });
  const menuNames = await mine
    .locator(".history-item:not(.history-item--trip) .history-item__more")
    .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
  check(
    new Set(menuNames).size === 2 &&
      chats.every(({ title, meta }) => menuNames.includes(`Actions for ${title}, ${meta}`)),
    "each chat's ⋮ button names the chat and its trip, so the two menus differ",
    { menuNames, chats },
  );
  await mine.getByRole("tab", { name: "Trips", exact: true }).click();
  await settle(page, 400);
  const trips = await mine
    .locator(".trip-card__title")
    .evaluateAll((items) => items.map((item) => ({ title: item.textContent.trim() })));
  check(
    trips.length === 2 && new Set(trips.map(({ title }) => title)).size === 2,
    "the Trips list tells the two Sydney trips apart",
    trips,
  );
  check(
    chats.length === 2 && new Set(chats.map(({ title, meta }) => `${title} | ${meta}`)).size === 2,
    "the Chats list tells the two Sydney chats apart",
    chats,
  );
  check(
    chats.every(({ meta }) => trips.some(({ title }) => title === meta)),
    "each chat row names its trip exactly as the Trips list does",
    { chats, trips },
  );
  await page.screenshot({ path: `${out}/mine-trips.png`, fullPage: true });
  check(errors.length === 0, "no page errors", errors);
  await context.close();
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
