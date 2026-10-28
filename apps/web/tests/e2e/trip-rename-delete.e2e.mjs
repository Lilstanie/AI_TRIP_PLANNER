import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, settle, touchSized } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trip-rename-delete", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message, detail) => {
  results.push({ ok: Boolean(ok), message, detail });
  console.log(
    `${ok ? "ok" : "FAIL"} ${message}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`,
  );
};
const NAME = "Sydney with Mum";

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openMockWorkspace(page, base);
  await planSuggestedTrip(page);
  const dismiss = page.getByRole("button", { name: "Not now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  const close = page.getByRole("button", { name: "Close your trip", exact: true });
  if (await close.isVisible()) await close.click();

  const sidebar = page.locator(".chats-panel");
  const openChats = async () => {
    if (!(await sidebar.evaluate((node) => node.classList.contains("is-open")).catch(() => false)))
      await page
        .locator(".workspace-sidebar")
        .getByRole("button", { name: /^Chats/ })
        .click();
    await page.locator(".chats-panel.is-open").waitFor();
  };
  await openChats();
  const tripRow = page.locator(".chats-panel.is-open .history-item--trip").first();
  const original = (await tripRow.locator(".history-item__title").textContent()).trim();
  check(original.startsWith("Trip to "), "trip row starts with its generated name", original);
  const tripMenu = (name) =>
    page.locator(".chats-panel.is-open").getByRole("button", { name: `Actions for ${name}` });
  check(await tripMenu(original).count(), "trip row has an Actions menu");

  page.once("dialog", (dialog) => dialog.dismiss());
  await tripMenu(original).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  page.once("dialog", (dialog) => dialog.accept("   "));
  await tripMenu(original).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  check(
    (await tripRow.locator(".history-item__title").textContent()).trim() === original,
    "cancelling or a blank name keeps the name",
  );

  page.once("dialog", (dialog) => dialog.accept(NAME));
  await tripMenu(original).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await settle(page, 300);
  check(
    (await tripRow.locator(".history-item__title").textContent()).trim() === NAME,
    "Trips list shows the new name",
  );
  check(
    (await page.locator(".topbar-title").first().textContent()).trim() === NAME,
    "top title shows the new name",
    await page.locator(".topbar-title").first().textContent(),
  );

  const budgetBefore = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("trip-workspace-catalog"));
    return JSON.parse(localStorage.getItem(key)).trips[0].snapshot.plan.brief.budgetTotal;
  });
  const composer = page.getByRole("textbox", { name: "Message AI Trip Planner" });
  await composer.fill("Change the budget to AUD 6000");
  await composer.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".composer__input")?.disabled, null, {
    timeout: 120_000,
  });
  await settle(page, 1500);
  const budgetAfter = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("trip-workspace-catalog"));
    return JSON.parse(localStorage.getItem(key)).trips[0].snapshot.plan.brief.budgetTotal;
  });
  await openChats();
  check(
    budgetAfter === 6000 &&
      budgetBefore !== 6000 &&
      (await tripRow.locator(".history-item__title").textContent()).trim() === NAME,
    "the name survives a replan from chat",
    { budgetBefore, budgetAfter },
  );

  await page.reload();
  await page.waitForSelector(".workspace-app");
  await settle(page, 800);
  await openChats();
  check(
    (await tripRow.locator(".history-item__title").textContent()).trim() === NAME,
    "the name survives a reload",
  );

  await page
    .locator(".workspace-sidebar")
    .getByRole("button", { name: /^Trips/ })
    .click();
  const card = page.locator(".trip-card").first();
  await card.waitFor();
  check(
    (await card.locator(".trip-card__title").textContent()).trim() === NAME,
    "Trips page card shows the new name",
  );
  const cardMenu = page.locator(".trips-page").getByRole("button", { name: `Actions for ${NAME}` });
  await cardMenu.click();
  check(
    (await page.locator(".trips-page").count()) === 1 &&
      (await page.getByRole("menuitem", { name: "Delete" }).isVisible()),
    "card menu opens without opening the trip",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  const bar = page.locator(".trip-calendar__trip").first();
  await bar.waitFor();
  check(
    (await bar.getAttribute("aria-label")).startsWith(`${NAME}:`) &&
      (await bar.textContent()).trim() === NAME,
    "calendar bar shows the new name",
    await bar.getAttribute("aria-label"),
  );
  await page.screenshot({ path: `${out}/calendar.png`, fullPage: true });
  await page.getByRole("tab", { name: "Trips", exact: true }).click();

  const chatsBefore = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("trip-workspace-catalog"))
      .map((key) => JSON.parse(localStorage.getItem(key)).conversations.length)
      .at(0),
  );
  await cardMenu.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await settle(page, 1500);
  const undo = page.locator(".trips-page .trip-undo");
  check(
    (await undo.isVisible()) && (await page.locator(".trip-card").count()) === 0,
    "delete removes the trip and offers Undo",
    await undo.textContent().catch(() => null),
  );
  const stored = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.startsWith("trip-workspace-catalog"));
    return JSON.parse(localStorage.getItem(key));
  });
  check(
    stored.trips.length === 0 &&
      stored.conversations.length >= chatsBefore &&
      stored.conversations.some((item) => item.messages.length > 0 && !item.tripId),
    "the trip's chat is kept and the trip stays deleted after saving",
    { trips: stored.trips.length, conversations: stored.conversations.length, chatsBefore },
  );
  await page.screenshot({ path: `${out}/deleted.png`, fullPage: true });

  await undo.getByRole("button", { name: "Undo", exact: true }).click();
  await settle(page, 800);
  check(
    (await card.locator(".trip-card__title").textContent()).trim() === NAME,
    "Undo brings back the trip with its name",
  );
  await page.reload();
  await page.waitForSelector(".workspace-app");
  await settle(page, 800);
  await openChats();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: NAME })
    .first()
    .click();
  await settle(page, 800);
  check(
    (await page.locator(".topbar-title").first().textContent()).trim() === NAME &&
      (await page.locator(".msg-item--agent").count()) > 0,
    "after a reload, the restored trip opens with its chat",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Mine", exact: true }).click();
  const mine = page.locator(".phone-mine");
  const phoneMenu = mine
    .locator(".trip-cards")
    .getByRole("button", { name: `Actions for ${NAME}` });
  await phoneMenu.scrollIntoViewIfNeeded();
  const phoneMenuBox = await phoneMenu.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { width: r.width, height: r.height, opacity: getComputedStyle(node).opacity };
  });
  check(
    touchSized(phoneMenuBox.width) &&
      touchSized(phoneMenuBox.height) &&
      phoneMenuBox.opacity === "1",
    "phone trip card has a visible 44 px Actions button",
  );
  await page.screenshot({ path: `${out}/phone-mine.png`, fullPage: true });
  check(errors.length === 0, "no page errors", errors);
} catch (error) {
  check(false, String(error));
  if (page) await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
