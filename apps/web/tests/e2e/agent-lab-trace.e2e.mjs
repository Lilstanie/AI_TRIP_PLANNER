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
// --- #221 folds: failure inventory, written before implementation -------------------------------
// - the trace panel has no Rounds or Calls fold, or a fold is not a button with a pressed state a
//   keyboard user can reach and toggle;
// - Rounds folded still shows rows that belong to a round, hides run-level rows, or leaves no heading per
//   round (the outline), or the headings' round numbers differ from the rounds the artifact records;
// - Calls folded still shows a tool row, or hides specialist and coordinator rows with the tools;
// - unfolding does not restore every row (rows after unfold differ from the events delivered);
// - folding changes the event count or the Fixture/Live label in the panel heading;
// - folding both at once hides a row neither fold names, or one fold's state leaks into the other;
// - after folding, the box stops following the newest event or strands the visitor past the list end;
// - a fold on one Compare side changes another side's list;
// - the toolbar makes the page scroll horizontally at 390 px.
// --- end #221 failure inventory ---------------------------------------------------------------
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

// ===== #221 folds: Rounds and Calls toolbar (start) ==================================================
const eventsOf = (body) => completeOf(body).artifact.events;
const TOOL_TYPES = new Set([
  "tool_started",
  "tool_completed",
  "tool_failed",
  "lab_tool_started",
  "lab_tool_completed",
]);
const roundOf = (runEvent) => runEvent.event.round;
const panelHeading = (page) => page.locator(".agent-lab__panel-heading [data-agent-lab-provenance]").first().innerText();

async function foldChecks(page, tag, artifactEvents, scope = "") {
  const total = artifactEvents.length;
  const roundNumbers = [...new Set(artifactEvents.map(roundOf).filter((n) => n !== undefined))];
  const runLevel = artifactEvents.filter((e) => roundOf(e) === undefined).length;
  const tools = artifactEvents.filter((e) => TOOL_TYPES.has(e.event.type)).length;
  const rounds = page.locator(`${scope} [data-agent-lab-fold="rounds"]`).first();
  const calls = page.locator(`${scope} [data-agent-lab-fold="calls"]`).first();
  const rows = () => page.locator(`${scope} [data-agent-lab-event]`).count();
  const headings = () =>
    page.locator(`${scope} [data-agent-lab-round]`).evaluateAll((n) => n.map((x) => x.textContent));
  const heading = await panelHeading(page);

  check(
    (await rounds.getAttribute("aria-pressed")) === "false" &&
      (await calls.getAttribute("aria-pressed")) === "false",
    `${tag}: both folds start unpressed`,
  );
  check((await rows()) === total, `${tag}: unfolded list shows all ${total} rows`);

  // Rounds folded: only run-level rows remain, one heading per recorded round.
  await rounds.click();
  check((await rounds.getAttribute("aria-pressed")) === "true", `${tag}: Rounds shows pressed`);
  check(
    (await rows()) === runLevel,
    `${tag}: Rounds folded leaves only the ${runLevel} run-level rows (got ${await rows()})`,
  );
  const folded = await headings();
  check(
    folded.length === roundNumbers.length &&
      roundNumbers.every((n, i) => folded[i]?.includes(`Round ${n}`)),
    `${tag}: Rounds folded keeps one heading per round (${roundNumbers.join(", ")}): ${folded.join(" | ")}`,
  );
  check((await panelHeading(page)) === heading, `${tag}: folding leaves the panel heading alone`);
  await rounds.click();
  check((await rows()) === total, `${tag}: unfolding Rounds restores every row`);

  // Calls folded: no tool rows, everything else stays.
  if (tools) {
    await calls.click();
    check((await calls.getAttribute("aria-pressed")) === "true", `${tag}: Calls shows pressed`);
    check(
      (await page.locator(`${scope} [data-agent-lab-event][data-event-kind="tool"]`).count()) === 0,
      `${tag}: Calls folded shows no tool rows`,
    );
    check(
      (await rows()) === total - tools,
      `${tag}: Calls folded keeps the ${total - tools} non-tool rows (got ${await rows()})`,
    );
    check((await headings()).length === roundNumbers.length, `${tag}: Calls leaves round headings`);
    // Both folds together: only rows that are run-level and not tools.
    await rounds.click();
    const both = artifactEvents.filter(
      (e) => roundOf(e) === undefined && !TOOL_TYPES.has(e.event.type),
    ).length;
    check((await rows()) === both, `${tag}: both folds leave ${both} rows (got ${await rows()})`);
    await rounds.click();
    await calls.click();
    check((await rows()) === total, `${tag}: unfolding both restores every row`);
  }
  check((await panelHeading(page)) === heading, `${tag}: panel heading unchanged after folds`);
  return { total, runLevel, tools, rounds: roundNumbers, folded };
}

async function folds(browser) {
  const tag = "folds-desktop";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const artifactEvents = eventsOf(await bodies[0]);
  summary[tag] = await foldChecks(page, tag, artifactEvents);

  // Keyboard: the Rounds button takes focus and toggles with Enter and Space; Tab reaches Calls.
  const rounds = page.locator('[data-agent-lab-fold="rounds"]').first();
  await rounds.focus();
  await page.keyboard.press("Enter");
  check((await rounds.getAttribute("aria-pressed")) === "true", `${tag}: Enter toggles Rounds`);
  await page.keyboard.press("Space");
  check((await rounds.getAttribute("aria-pressed")) === "false", `${tag}: Space toggles Rounds`);
  await page.keyboard.press("Tab");
  check(
    (await page.evaluate(() => document.activeElement?.getAttribute("data-agent-lab-fold"))) ===
      "calls",
    `${tag}: Tab moves from Rounds to Calls`,
  );

  // A folded list still follows: fold Calls, run again, and the last row is in view.
  await page.locator('[data-agent-lab-fold="calls"]').first().click();
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const after = await boxState(page);
  check(after.lastInView, `${tag}: a folded list still follows the newest event`);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  await closeOut(session);
}

async function foldsCompare(browser) {
  const tag = "folds-compare";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;
  await page.getByRole("button", { name: "Compare all strategies" }).click();
  await complete(page);
  const sides = (await Promise.all(bodies)).map(eventsOf);
  const articles = page.locator("[data-agent-lab-compare-side]");
  const toggles = page.locator('.agent-lab__compare [data-agent-lab-fold="calls"]');
  check((await toggles.count()) === 3, `${tag}: each side has its own folds`);
  await toggles.nth(1).click();
  const counts = [];
  for (let i = 0; i < 3; i += 1)
    counts.push(await articles.nth(i).locator("[data-agent-lab-event]").count());
  const toolsOf = (events) => events.filter((e) => TOOL_TYPES.has(e.event.type)).length;
  check(
    counts[0] === sides[0].length &&
      counts[2] === sides[2].length &&
      counts[1] === sides[1].length - toolsOf(sides[1]),
    `${tag}: folding side 2 changes only side 2 (${counts.join(", ")})`,
  );
  summary[tag] = counts;
  await closeOut(session);
}

async function foldsPhone(browser) {
  const tag = "folds-phone";
  const session = await open(browser, { width: 390, height: 844, tag, touch: true });
  const { page } = session;
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const first = page.locator('[data-agent-lab-fold="rounds"]').first();
  const bar = await first.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { left: r.left, right: r.right, height: r.height };
  });
  check(bar.left >= 0 && bar.right <= 390, `${tag}: the toolbar fits the screen`);
  check(bar.height >= 44, `${tag}: fold buttons are touch-sized (${Math.round(bar.height)}px)`);
  await first.tap();
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  await closeOut(session);
}
// ===== #221 folds (end) ==============================================================================

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await desktop(browser);
  await reducedMotion(browser);
  await compare(browser);
  await phone(browser);
  await folds(browser); // #221
  await foldsCompare(browser); // #221
  await foldsPhone(browser); // #221
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
