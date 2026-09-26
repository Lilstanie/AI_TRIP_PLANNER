// End-to-end walk through the Timeline & routes tab with mock data: day switching, the fixed
// transport and stay rows, selecting and editing a stop, confirming its map match, checking the
// day's routes, applying a previewed edit and undoing it. Screenshots at desktop and phone widths,
// light and dark, land under output/playwright/timeline/<label>/ as a repeatable artifact.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [PLAYWRIGHT=<path to playwright>] [LABEL=after] [SHOTS_ONLY=1] node apps/web/tests/e2e/timeline.e2e.mjs
//
// SHOTS_ONLY=1 skips the interaction checks, for capturing a baseline of an older build.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const SHOTS_ONLY = process.env.SHOTS_ONLY === "1";
const OUT = resolve(process.cwd(), "output/playwright/timeline", LABEL);
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

async function openTimeline(browser, { width, height, scheme }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  // Mock data: no provider requests. The toggle only works once the page has hydrated, so retry
  // until it reports mock rather than clicking once and planning with live providers.
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
  check(
    (await page.getByRole("button", { name: /^Mock data/ }).count()) === 1,
    `${width}px ${scheme}: planning with mock data`,
  );
  await page.locator(".chat-empty__suggestions button").first().click();
  await page
    .locator(".msg-item--agent .msg-item__body")
    .first()
    .waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await page.getByRole("tab", { name: /Timeline/ }).click();
  await settle(page, 700);
  return { context, page, errors };
}

async function shots(browser, width, height, tag) {
  for (const scheme of ["light", "dark"]) {
    const { context, page, errors } = await openTimeline(browser, { width, height, scheme });
    await page.screenshot({ path: `${OUT}/${tag}-${scheme}-01-timeline.png` });
    const drawer = page.locator(".workspace-drawer--trip .drawer__body, .workspace-drawer--trip");
    await drawer.first().screenshot({ path: `${OUT}/${tag}-${scheme}-02-drawer.png` });
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${tag} ${scheme}: no horizontal page scroll`,
    );
    check(!errors.length, `${tag} ${scheme}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
    await context.close();
  }
}

async function applyPreview(page, preview, label) {
  const apply = preview.getByRole("button", { name: "Apply changes" });
  if (!(await apply.isEnabled())) {
    await page.screenshot({ path: `${OUT}/blocked-${label}.png` });
    const text = (await preview.innerText()).replace(/\s+/g, " ").slice(0, 300);
    check(false, `${label}: preview blocked — ${text}`);
    await preview.getByRole("button", { name: /Cancel|Close/ }).click();
    return false;
  }
  await apply.click();
  await settle(page, 800);
  return true;
}

async function interactions(browser) {
  const { context, page, errors } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
  });
  const timeline = page.getByRole("region", { name: "Trip timeline" });

  // Days are tabs, not a dropdown of ISO dates.
  const days = timeline.getByRole("tab");
  check((await days.count()) >= 2, `day strip lists every day (${await days.count()})`);
  await days.nth(1).click();
  await settle(page);
  check((await days.nth(1).getAttribute("aria-selected")) === "true", "a day tab selects its day");
  await days.nth(0).click();
  await settle(page);

  // Fixed transport and stays read as rows with no raw "undefined" or empty separators.
  const text = await timeline.innerText();
  check(!/undefined|· ·/.test(text), "no raw undefined or empty separators");

  // A stop is compact until selected; selecting it opens its editor.
  const stop = timeline.locator(".timeline-stop").first();
  check((await stop.count()) === 1, "day shows its stops");
  check(!(await timeline.getByRole("button", { name: /Preview time change/ }).count()), "editors stay closed until a stop is selected");
  await stop.locator(".timeline-stop__main").click();
  await settle(page);
  check(await timeline.getByRole("button", { name: /Preview time change/ }).isVisible(), "selecting a stop opens its editor");
  await page.screenshot({ path: `${OUT}/interact-01-stop-open.png` });

  // A time edit goes through a preview that can be applied, then undone.
  const start = timeline.getByLabel(/^Start/).first();
  const [hour, minute] = (await start.inputValue()).split(":").map(Number);
  await start.fill(`${String(Math.min(hour + 1, 20)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  const end = timeline.getByLabel(/^End/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(`${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`);
  await timeline.getByRole("button", { name: /Preview time change/ }).click();
  const preview = page.getByRole("region", { name: "Edit preview" });
  await preview.waitFor({ timeout: 30_000 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/interact-02-preview.png` });
  // A pending edit pauses sending but is not a chat request: no thinking row, no stop button.
  check(
    !(await page.getByText("Preparing your request.").count()) &&
      !(await page.getByRole("button", { name: /Stop/ }).count()),
    "an open preview does not pose as a chat request",
  );
  await preview.getByRole("button", { name: "Apply changes" }).click();
  await settle(page, 800);
  const undo = timeline.getByRole("button", { name: /Undo/ });
  check(await undo.isVisible(), "an applied edit can be undone");
  await page.screenshot({ path: `${OUT}/interact-03-applied.png` });
  await undo.click();
  await preview.waitFor({ timeout: 30_000 });
  await preview.getByRole("button", { name: "Apply changes" }).click();
  await settle(page, 800);

  // The whole route check: pick a day with two or more stops, confirm each stop's map match, then
  // check the day's routes and see checked journeys between the stops.
  const dayTabs = await days.count();
  let routeDay = -1;
  for (let index = 0; index < dayTabs; index += 1) {
    if (/([2-9]|\d{2}) stops/.test(await days.nth(index).innerText())) {
      routeDay = index;
      break;
    }
  }
  const LANDMARKS = ["Sydney Opera House", "Royal Botanic Garden Sydney", "Art Gallery of New South Wales"];
  let searches = 0;
  // Confirm every stop's map match on a day: a move or a route check needs real places.
  async function confirmDay(index) {
    await days.nth(index).click();
    await settle(page);
    const stops = timeline.locator(".timeline-stop");
    for (let stop = 0; stop < (await stops.count()); stop += 1) {
      const row = stops.nth(stop);
      if (await row.locator(".timeline-tag--ok").count()) continue;
      if (!(await row.locator(".stop-editor").count()))
        await row.locator(".timeline-stop__main").click();
      const use = row.getByRole("button", { name: "Use this place" });
      await use.waitFor({ timeout: 8_000 }).catch(() => undefined);
      if (await use.count()) await use.click();
      else {
        // No map match (mock names are not real places): find a real one with the stop's search.
        await row.getByRole("searchbox").fill(LANDMARKS[searches++ % LANDMARKS.length]);
        await row.getByRole("button", { name: "Search", exact: true }).click();
        const result = row.getByRole("button", { name: /^Use / }).first();
        await result.waitFor({ timeout: 20_000 });
        await result.click();
      }
      await preview.waitFor({ timeout: 30_000 });
      await applyPreview(page, preview, `confirm day ${index + 1} stop ${stop + 1}`);
    }
  }
  if (routeDay < 0) {
    // Mock data plans one stop a day: move day 2's stop onto day 1 so there is a journey.
    await confirmDay(0);
    await confirmDay(1);
    await days.nth(1).click();
    await settle(page);
    if (!(await timeline.locator(".stop-editor").count()))
      await timeline.locator(".timeline-stop__main").first().click();
    await timeline.getByLabel("Move to").selectOption("1");
    await preview.waitFor({ timeout: 30_000 });
    await applyPreview(page, preview, "move to day 1");
    check(/2 stops/.test(await days.nth(0).innerText()), "moving a stop to another day");
    routeDay = /2 stops/.test(await days.nth(0).innerText()) ? 0 : -1;
  }
  check(routeDay >= 0, "a day has at least two stops to route between");
  if (routeDay >= 0) {
    await confirmDay(routeDay);
    const stops = timeline.locator(".timeline-stop");
    const confirmed = await timeline.locator(".timeline-stop .timeline-tag--ok").count();
    check(confirmed === (await stops.count()), `every stop on the day is confirmed (${confirmed}/${await stops.count()})`);
    const checkRoutes = timeline.getByRole("button", { name: /Check routes for Day/ });
    check(await checkRoutes.isEnabled(), "route check is enabled once places are confirmed");
    await checkRoutes.click();
    await preview.waitFor({ timeout: 60_000 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/interact-04-route-preview.png` });
    check(
      (await preview.getByText(/Walk · |No route found|Public transport · /).count()) > 0,
      "the route check reports each journey",
    );
    if (await preview.getByRole("button", { name: "Apply changes" }).isEnabled()) {
      await preview.getByRole("button", { name: "Apply changes" }).click();
      await settle(page, 800);
      check(
        (await timeline.locator(".timeline-connection--checked").count()) > 0,
        "checked journeys appear between the stops",
      );
    }
    await page.screenshot({ path: `${OUT}/interact-05-routes-checked.png` });
  }

  check(!errors.length, `interactions: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await shots(browser, 1440, 1000, "desktop");
  await shots(browser, 390, 844, "phone");
  if (!SHOTS_ONLY) await interactions(browser);
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
