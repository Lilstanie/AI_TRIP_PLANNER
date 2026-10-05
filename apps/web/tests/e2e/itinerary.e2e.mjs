// End-to-end walk through the Itinerary tab's item menu with mock data: move earlier and later
// within a day (and undo), booked, note, details, next day, ideas and back, remove and undo, adjust
// schedule, a swap refused past 23:59, keyboard handling and 44 px phone targets. Screenshots at
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
  const dayList = (day) => drawer.getByRole("list", { name: new RegExp(`^Stops, Day ${day}\\b`) });
  // Mock stops share a name, so a day's order is read from which row carries the note.
  const notedAt = async (day) =>
    (await dayList(day).locator(".trip-places__item").allInnerTexts()).findIndex((text) => text.includes(NOTE));
  const dayText = async (day) => (await dayList(day).locator(".trip-places__item").allInnerTexts()).join("|");
  const menuLabels = async (item) => {
    await item.getByRole("button", { name: /^Actions for / }).click();
    await drawer.getByRole("menu").waitFor();
    const found = (await drawer.getByRole("menuitem").allInnerTexts()).map((l) => l.trim());
    await page.keyboard.press("Escape");
    await settle(page, 200);
    return found;
  };
  const chooseOn = async (item, label) => {
    await item.getByRole("button", { name: /^Actions for / }).click();
    await drawer.getByRole("menuitem", { name: label, exact: true }).click();
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

  // Day 2 now holds its own stop, then the noted one. Move earlier / Move later reorder them
  // without dragging, and Undo restores the order.
  const day2 = dayList(2).locator(".trip-places__item");
  check((await day2.count()) === 2 && (await notedAt(2)) === 1, `${tag}: Day 2 has two stops, the noted one last`);
  const firstLabels = await menuLabels(day2.first());
  check(!firstLabels.includes("Move earlier") && firstLabels.includes("Move later"), `${tag}: the first stop of a day offers Move later only`);
  const lastLabels = await menuLabels(day2.last());
  check(lastLabels.includes("Move earlier") && !lastLabels.includes("Move later"), `${tag}: the last stop of a day offers Move earlier only`);
  if (tag === "phone") {
    const trigger = day2.first().getByRole("button", { name: /^Actions for / });
    const box = await trigger.boundingBox();
    check(box && box.width >= 44 && box.height >= 44, `${tag}: menu trigger is at least 44 px (${box?.width}x${box?.height})`);
    await trigger.click();
    const sizes = await drawer.getByRole("menuitem").evaluateAll((items) => items.map((i) => i.getBoundingClientRect().height));
    check(sizes.length > 0 && sizes.every((h) => h >= 44), `${tag}: menu items are at least 44 px tall (min ${Math.min(...sizes)})`);
    await page.screenshot({ path: `${OUT}/${tag}-03a-touch-menu.png` });
    await page.keyboard.press("Escape");
    await settle(page, 200);
  }
  const before2 = await dayText(2);
  await chooseOn(day2.first(), "Move later");
  check((await notedAt(2)) === 0, `${tag}: Move later puts the other stop after the noted one`);
  await page.screenshot({ path: `${OUT}/${tag}-03b-moved-later.png` });
  await drawer.getByRole("button", { name: "Undo" }).click();
  await settle(page, 400);
  check((await dayText(2)) === before2, `${tag}: Undo restores Day 2's order and times`);
  await chooseOn(day2.last(), "Move earlier");
  check((await notedAt(2)) === 0, `${tag}: Move earlier puts the noted stop first`);
  await chooseOn(day2.first(), "Move later");
  check((await notedAt(2)) === 1, `${tag}: Move later puts it back`);
  await choose("Move to ideas");
  const ideas = drawer.getByRole("list", { name: "Stops, Ideas" });
  check((await ideas.getByText("Buy tickets online").count()) === 1, `${tag}: the stop is in Ideas`);
  const ideaLabels = await menuLabels(await row());
  check(!ideaLabels.includes("Move earlier") && !ideaLabels.includes("Move later"), `${tag}: an idea offers neither Move earlier nor Move later`);
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

  // A swap that would run past 23:59 is refused and leaves the plan unchanged. The noted stop is
  // last on Day 3; set it to 22:30-23:50 in the Timeline, then move it earlier.
  await drawer.getByLabel(/^Start/).first().fill("22:30");
  await drawer.getByLabel(/^End/).first().fill("23:50");
  await drawer.getByRole("button", { name: /Preview time change/ }).click();
  const preview = page.getByRole("region", { name: "Edit preview" });
  await preview.waitFor({ timeout: 30_000 });
  await preview.getByRole("button", { name: "Apply changes" }).click();
  await settle(page, 800);
  await drawer.getByRole("tab", { name: "Itinerary" }).click();
  await settle(page, 400);
  const day3 = await dayText(3);
  check((await notedAt(3)) === 1 && day3.includes("22:30–23:50"), `${tag}: the noted stop is last on Day 3 at 22:30–23:50`);
  await choose("Move earlier");
  const refusal = drawer.locator(".item-problem");
  check(
    (await refusal.count()) === 1 && /past 23:59/.test(await refusal.innerText()),
    `${tag}: a swap past 23:59 is refused with a message`,
  );
  check((await dayText(3)) === day3, `${tag}: the refused swap leaves Day 3 unchanged`);
  await page.screenshot({ path: `${OUT}/${tag}-05-refused.png` });

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
