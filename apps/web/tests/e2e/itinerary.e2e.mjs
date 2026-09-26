// End-to-end walk through the Itinerary tab's item menu with mock data: booked, note, details,
// next day, ideas and back, remove and undo, adjust schedule, and keyboard handling. Screenshots at
// desktop and phone widths land under output/playwright/itinerary/ as a repeatable artifact.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/itinerary.e2e.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/itinerary");
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

async function openItinerary(browser, { width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  return { context, page, errors };
}

async function run(browser, { width, height, tag }) {
  const { context, page, errors } = await openItinerary(browser, { width, height });
  const drawer = page.locator(".workspace-drawer--trip");
  check((await drawer.getByRole("tab", { name: "Itinerary" }).getAttribute("aria-selected")) === "true", `${tag}: Itinerary is the first tab`);
  const menus = drawer.getByRole("button", { name: /^Actions for / });
  check((await menus.count()) >= 2, `${tag}: every stop has an action menu (${await menus.count()})`);
  // Follow one stop: the first until it has a note, then the row carrying that note.
  const NOTE = "Buy tickets online";
  const row = async () => {
    const noted = drawer.locator(".trip-places__item").filter({ hasText: NOTE });
    return (await noted.count()) ? noted.first() : drawer.locator(".trip-places__item").first();
  };
  const openMenu = async () => {
    await (await row()).getByRole("button", { name: /^Actions for / }).click();
    await drawer.getByRole("menu").waitFor();
  };
  const choose = async (label) => {
    await openMenu();
    await drawer.getByRole("menuitem", { name: label }).click();
    await settle(page, 400);
  };

  // The menu opens, lists Mindtrip's actions, and Escape returns focus to its trigger.
  await openMenu();
  const labels = await drawer.getByRole("menuitem").allInnerTexts();
  check(
    ["Adjust schedule", "Edit details", "Add a note", "Move to ideas", "Move to previous day", "Move to next day", "Mark as booked", "Remove"].every((l) => labels.some((x) => x.trim() === l)),
    `${tag}: menu lists every action (${labels.map((l) => l.trim()).join(", ")})`,
  );
  check(await drawer.getByRole("menuitem", { name: "Move to previous day" }).isDisabled(), `${tag}: day 1 cannot move earlier`);
  await page.screenshot({ path: `${OUT}/${tag}-01-menu.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await settle(page, 300);
  check(!(await drawer.getByRole("menu").count()), `${tag}: Escape closes the menu`);
  check(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.startsWith("Actions for")), `${tag}: focus returns to the trigger`);
  check(await drawer.isVisible(), `${tag}: Escape does not close the drawer`);

  // Booked and a note show on the row.
  await choose("Mark as booked");
  check((await drawer.locator(".trip-places__tag", { hasText: "Booked" }).count()) === 1, `${tag}: booked shows a tag`);
  await choose("Add a note");
  await drawer.getByLabel("Note").fill("Buy tickets online");
  await drawer.getByRole("button", { name: "Save" }).click();
  await settle(page, 400);
  check(await drawer.getByText("Buy tickets online").isVisible(), `${tag}: the note shows under the stop`);

  // Edit details renames the stop.
  await choose("Edit details");
  await drawer.getByLabel("What you will do").fill("Morning walk and coffee");
  await drawer.getByRole("button", { name: "Save" }).click();
  await settle(page, 400);
  check(await drawer.getByText("Morning walk and coffee").first().isVisible(), `${tag}: details change`);
  await page.screenshot({ path: `${OUT}/${tag}-02-booked-note.png` });

  // Next day, then Ideas, then back onto a day.
  await choose("Move to next day");
  check(
    (await drawer.getByRole("list", { name: /Stops, Day 2/ }).getByText("Buy tickets online").count()) === 1,
    `${tag}: next day moves the stop to Day 2`,
  );
  await choose("Move to ideas");
  const ideas = drawer.getByRole("list", { name: "Stops, Ideas" });
  check((await ideas.getByText("Buy tickets online").count()) === 1, `${tag}: the stop is in Ideas`);
  await page.screenshot({ path: `${OUT}/${tag}-03-ideas.png` });
  await choose("Schedule on a day");
  await drawer.getByLabel("Day", { exact: true }).selectOption("3");
  await drawer.getByRole("button", { name: "Schedule", exact: true }).click();
  await settle(page, 400);
  check(
    (await drawer.getByRole("list", { name: /Stops, Day 3/ }).getByText("Buy tickets online").count()) === 1,
    `${tag}: an idea is scheduled back onto a day`,
  );

  // Remove, then Undo.
  const before = await menus.count();
  await choose("Remove");
  check((await menus.count()) === before - 1, `${tag}: remove drops the stop`);
  await drawer.getByRole("button", { name: "Undo" }).click();
  await settle(page, 400);
  check((await menus.count()) === before, `${tag}: undo restores it`);

  // Adjust schedule opens the Timeline on that stop.
  await choose("Adjust schedule");
  check(
    (await drawer.getByRole("tab", { name: /Timeline/ }).getAttribute("aria-selected")) === "true" &&
      (await drawer.getByRole("button", { name: /Preview time change/ }).count()) === 1,
    `${tag}: adjust schedule opens the stop's time editor in the Timeline`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-04-adjust.png` });

  check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `${tag}: no sideways scroll`);
  check(!errors.length, `${tag}: no console errors${errors.length ? `: ${errors.join(" | ").slice(0, 300)}` : ""}`);
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await run(browser, { width: 1440, height: 1000, tag: "desktop" });
  await run(browser, { width: 390, height: 844, tag: "phone" });
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
