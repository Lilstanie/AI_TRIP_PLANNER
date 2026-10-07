// End-to-end contract for the Agent Lab Trace view (#218). This first slice (#219) covers the bounded,
// independently scrolling trace box; later tickets extend this script with the time bar, folds and
// jump-to-record. A visitor runs scenarios from the public /agent-lab page in fixture mode. Raw NDJSON,
// desktop and phone screenshots and a JSON summary land under output/playwright/agent-lab-trace/.
//
// Failure inventory, written before implementation:
// - the trace list grows the page instead of scrolling in its own box (document taller than about one
//   viewport plus the header on the 46-event tight-budget run), or the box has no visible scrollbar
//   (an overlay scrollbar that hides itself, so the list looks unscrollable on macOS);
// - the page scrolls horizontally at 390 px, or the box cannot be scrolled by touch;
// - auto-follow does not reach the last event when the run completes, or only does so after the visitor
//   scrolls;
// - auto-follow still pulls the box down after the visitor scrolled up, so new events change the scroll
//   position they are reading from;
// - scrolling back to the bottom does not resume following;
// - with reduced motion the follow scroll animates, so the last event is not in view at completion;
// - in Compare a side's list is not in its own bounded box, so one long trace stretches the table;
// - the box hides events (fewer rows than the events the stream delivered) or loses its accessible name;
// - a page error or console error appears, or the run touches workspace storage.
//
//   pnpm --filter @trip/web e2e agent-lab-trace   (fixture mode needs no keys)
//   [CHANNEL=chrome] [PLAYWRIGHT=<path to playwright>] node apps/web/tests/e2e/agent-lab-trace.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/agent-lab-trace");
mkdirSync(OUT, { recursive: true });

const SCENARIO = "tokyo-couple-tight-budget";
const REVISION = "multi-agent-targeted-revision";
// "About one viewport plus the header": the document may exceed that by this much for panel padding.
const HEIGHT_SLACK = 160;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const summary = {};

const completeOf = (body) =>
  body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .at(-1);
const eventCountOf = (body) => completeOf(body).artifact.events.length;

const BOX = "[data-agent-lab-trace-box]";
const rowCount = (page) => page.locator("[data-agent-lab-event]").count();

// Geometry a visitor can see: the box's scroll position and whether the newest row is inside it.
const boxState = (page, selector = BOX, index = 0) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((box) => {
      const rows = box.querySelectorAll("[data-agent-lab-event]");
      const last = rows[rows.length - 1]?.getBoundingClientRect();
      const frame = box.getBoundingClientRect();
      return {
        scrollTop: box.scrollTop,
        scrollHeight: box.scrollHeight,
        clientHeight: box.clientHeight,
        frameHeight: frame.height,
        scrollbarWidth: box.offsetWidth - box.clientWidth,
        overflowY: getComputedStyle(box).overflowY,
        scrollBehavior: getComputedStyle(box).scrollBehavior,
        rows: rows.length,
        lastInView: last ? last.bottom <= frame.bottom + 1 && last.top >= frame.top - 1 : false,
      };
    });

async function open(
  browser,
  { width, height, tag, reducedMotion = "no-preference", touch = false },
) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: "light",
    reducedMotion,
    hasTouch: touch,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  const bodies = [];
  page.on("response", (response) => {
    if (response.url() === `${BASE}/api/agent-lab/runs` && response.request().method() === "POST")
      bodies.push(response.text());
  });
  await page.goto(`${BASE}/agent-lab`);
  await page.getByRole("heading", { name: "Agent Lab", level: 1 }).waitFor();
  await page.getByLabel("Scenario").selectOption(SCENARIO);
  await page.getByLabel("Strategy").selectOption(REVISION);
  const storage = () =>
    page.evaluate(() =>
      JSON.stringify({
        catalog: localStorage.getItem("trip-workspace-catalog-v3"),
        current: localStorage.getItem("trip-workspace-v1"),
      }),
    );
  return { context, page, errors, bodies, storage, storageBefore: await storage(), tag };
}

const complete = (page) =>
  page.getByRole("status").getByText("Run complete", { exact: true }).waitFor({ timeout: 30000 });

async function closeOut(session) {
  const { page, errors, storage, storageBefore, tag, context } = session;
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `${tag}: no horizontal page overflow`,
  );
  check((await storage()) === storageBefore, `${tag}: the run does not mutate workspace storage`);
  check(
    !errors.length,
    `${tag}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await context.close();
}

async function desktop(browser) {
  const tag = "desktop";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;

  // 1. An uninterrupted 46-event run: bounded page, own scroll box, visible scrollbar, newest event in view.
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const events = eventCountOf(await bodies[0]);
  writeFileSync(`${OUT}/${tag}.revision.ndjson`, await bodies[0]);
  check(events === 46, `${tag}: targeted revision streams 46 events (got ${events})`);
  const state = await boxState(page);
  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const headerHeight = await page.locator(".agent-lab__header").evaluate((n) => n.offsetHeight);
  check(
    docHeight <= 1000 + headerHeight + HEIGHT_SLACK,
    `${tag}: document is ${docHeight}px, within one viewport plus the header (${headerHeight}px)`,
  );
  check(
    state.rows === events,
    `${tag}: the box holds every event (${state.rows} rows of ${events})`,
  );
  check(
    state.scrollHeight > state.clientHeight && state.frameHeight < 1000,
    `${tag}: the trace scrolls inside its own box (${state.clientHeight}px of ${state.scrollHeight}px)`,
  );
  check(
    state.overflowY === "scroll" && state.scrollbarWidth >= 8,
    `${tag}: the box shows a visible scrollbar (${state.scrollbarWidth}px wide, overflow ${state.overflowY})`,
  );
  check(state.lastInView, `${tag}: the last event is in view at completion without scrolling`);
  check(
    (await page.getByRole("region", { name: "Run events" }).count()) === 1,
    `${tag}: the box is a named region`,
  );
  await page.screenshot({ path: `${OUT}/${tag}.run.png`, fullPage: true });
  summary[tag] = { events, docHeight, headerHeight, box: state };

  // 2. Scroll up mid-run: later events must not move the box. Scrolling to the bottom resumes following.
  await page.getByRole("button", { name: "Run experiment" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-agent-lab-event]").length >= 14,
  );
  const before = await boxState(page);
  check(
    before.scrollTop > 0,
    `${tag}: the box was already following mid-run (scrollTop ${before.scrollTop})`,
  );
  await page.locator(BOX).hover();
  await page.mouse.wheel(0, -6000);
  // Wheel scrolling animates and a new event can end it early, so wait for the box to come to rest.
  let rest = await boxState(page);
  for (let settled = 0; settled < 3;) {
    await page.waitForTimeout(150);
    const now = await boxState(page);
    settled = now.scrollTop === rest.scrollTop ? settled + 1 : 0;
    rest = now;
  }
  check(
    rest.scrollTop < before.scrollTop - 300,
    `${tag}: the visitor scrolled up (scrollTop ${before.scrollTop} to ${rest.scrollTop})`,
  );
  const rowsAtScroll = await rowCount(page);
  await page.waitForFunction(
    (target) => document.querySelectorAll("[data-agent-lab-event]").length >= target,
    Math.min(rowsAtScroll + 12, events),
  );
  const midRun = await page.getByRole("button", { name: "Cancel run" }).count();
  const held = await boxState(page);
  check(midRun === 1, `${tag}: the run was still streaming when the later events arrived`);
  check(
    held.scrollTop === rest.scrollTop && held.rows > rowsAtScroll,
    `${tag}: ${held.rows - rowsAtScroll} later events did not move the box (scrollTop ${held.scrollTop})`,
  );
  // Jump to the bottom (a wheel animation can be cut short by arriving events, which proves nothing).
  await page.locator(BOX).evaluate((box) => {
    box.scrollTop = box.scrollHeight;
  });
  await complete(page);
  const resumed = await boxState(page);
  check(
    resumed.lastInView && resumed.rows === events,
    `${tag}: scrolling to the bottom resumes following; the last event is in view at completion`,
  );
  summary[tag].scrolledUp = { rowsAtScroll, held, resumed };
  await closeOut(session);
}

async function reducedMotion(browser) {
  const tag = "reduced-motion";
  const session = await open(browser, { width: 1440, height: 1000, tag, reducedMotion: "reduce" });
  const { page } = session;
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const state = await boxState(page);
  check(
    state.lastInView,
    `${tag}: the follow scroll is instant, so the last event is in view at completion`,
  );
  check(
    state.scrollBehavior === "auto",
    `${tag}: the box does not smooth-scroll (${state.scrollBehavior})`,
  );
  summary[tag] = state;
  await closeOut(session);
}

async function compare(browser) {
  const tag = "compare";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;
  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await complete(page);
  const counts = (await Promise.all(bodies)).map(eventCountOf);
  const boxes = page.locator(`.agent-lab__compare ${BOX}`);
  check((await boxes.count()) === 3, `${tag}: each of the three strategies has its own trace box`);
  const sides = [];
  for (let index = 0; index < 3; index += 1) {
    const state = await boxState(page, `.agent-lab__compare ${BOX}`, index);
    sides.push({ events: counts[index], ...state });
    check(
      state.rows === counts[index],
      `${tag}: side ${index + 1} lists all ${counts[index]} events`,
    );
    check(
      state.frameHeight < 1000 && state.scrollbarWidth >= 8,
      `${tag}: side ${index + 1} is bounded (${Math.round(state.frameHeight)}px) with a visible scrollbar`,
    );
    if (counts[index] > 20)
      check(
        state.scrollHeight > state.clientHeight && state.lastInView,
        `${tag}: side ${index + 1} scrolls in its own box and shows its last event`,
      );
  }
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  summary[tag] = sides;
  await closeOut(session);
}

async function phone(browser) {
  const tag = "phone";
  const session = await open(browser, { width: 390, height: 844, tag, touch: true });
  const { page, bodies } = session;
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const events = eventCountOf(await bodies[0]);
  await page.locator(BOX).scrollIntoViewIfNeeded();
  const state = await boxState(page);
  check(state.rows === events, `${tag}: the box holds every event`);
  check(
    state.frameHeight <= 844,
    `${tag}: the box fits the screen (${Math.round(state.frameHeight)}px)`,
  );
  check(state.lastInView, `${tag}: the last event is in view at completion`);

  // A real touch drag down the list moves the box towards the first event.
  const rect = await page.locator(BOX).evaluate((box) => {
    const { x, y, width, height } = box.getBoundingClientRect();
    return { x, y, width, height };
  });
  const cdp = await session.context.newCDPSession(page);
  const startY = Math.round(rect.y + Math.min(rect.height - 20, 200));
  const touchX = Math.round(rect.x + rect.width / 2);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchX, y: startY }],
  });
  for (let step = 1; step <= 10; step += 1)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: touchX, y: startY + step * 30 }],
    });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  const after = await boxState(page);
  check(
    after.scrollTop < state.scrollTop,
    `${tag}: the box scrolls by touch (${Math.round(state.scrollTop)}px to ${Math.round(after.scrollTop)}px)`,
  );
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  summary[tag] = { events, before: state, after };
  await closeOut(session);
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await desktop(browser);
  await reducedMotion(browser);
  await compare(browser);
  await phone(browser);
} finally {
  await browser.close();
}

writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ passed: failures.length === 0, failures, summary }, null, 2),
);
console.log(`\nArtifacts: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
