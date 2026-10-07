// End-to-end contract for the Agent Lab Trace view (#218). This first slice (#219) covers the bounded,
// independently scrolling trace box; #220 adds the time bar and jump-to-record; later tickets add the
// folds and Compare's shared axis. A visitor runs scenarios from the public /agent-lab page in fixture mode. Raw NDJSON,
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
// Time bar (#220), failure inventory written before implementation:
// - the bar shows a lane for an actor with no records, lanes out of the fixed order (Run, Coordinator,
//   transport, destination guide, accommodation, itinerary, dining, Baseline), or five specialist
//   lanes (or a Coordinator lane) for the single-agent baseline;
// - the bar has more or fewer blocks than records (events minus the completions merged into their
//   starts), or its tool blocks differ from the distinct tool calls the received artifact records;
// - a tool call's start and result draw two blocks, or an in-flight call is drawn as a finished span;
// - in tokyo-couple-tight-budget under targeted revision, accommodation's first round 1 block does not
//   come after transport's last, itinerary's or dining's first does not come after accommodation's
//   last, or a round 2 specialist block lands outside the transport lane;
// - the round 2 boundary is not marked;
// - a failed tool call, failed specialist or rejected output (Failure Lab) is not in the error colour,
//   or a healthy block is;
// - the bar does not grow while events stream, or a replay of the downloaded artifact draws a
//   different bar from the live run;
// - a block is not a focusable button with an accessible name carrying lane, title and step;
// - clicking a block, or pressing Enter on it, does not bring its row into view in the trace box, or
//   does not highlight the row;
// - the bar is wider than the screen at 390 px, or lane labels do not abbreviate there.
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
// - the toolbar makes the page scroll horizontally at 390 px;
// - a fold changes the time bar (a block count or any block differs from before the fold).
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

// ---- Time bar helpers (#220) ----------------------------------------------------------------
const LANE_ORDER = [
  "Run",
  "Coordinator",
  "transport",
  "destination guide",
  "accommodation",
  "itinerary",
  "dining",
  "Baseline",
];
const BAR = "[data-trace-overview]";

// What the received artifact says the bar must hold, worked out from its events alone.
function expectedBar(artifact) {
  const types = artifact.events.map((e) => e.event.type);
  const done = types.filter((t) =>
    ["tool_completed", "tool_failed", "lab_tool_completed"].includes(t),
  ).length;
  // One call per start event: a call id can repeat within a run, so ids alone undercount.
  const calls = artifact.events.filter((e) =>
    ["tool_started", "lab_tool_started"].includes(e.event.type),
  );
  const failed = types.filter((t) =>
    ["tool_failed", "agent_failed", "lab_agent_output_rejected"].includes(t),
  ).length;
  return { records: artifact.events.length - done, tools: calls.length, failed };
}

// Everything a visitor can read from the bar, in a form two runs can be compared by.
const readBar = (page, scope = "") =>
  page
    .locator(`${scope} ${BAR}`.trim())
    .first()
    .evaluate((bar) => ({
      lanes: [...bar.querySelectorAll("[data-trace-lane]")].map((lane) => ({
        lane: lane.dataset.traceLane,
        label: lane.querySelector("[data-trace-lane-label]")?.innerText.trim(),
        blocks: [...lane.querySelectorAll("[data-trace-block]")].map((b) => ({
          step: Number(b.dataset.step),
          sequence: Number(b.dataset.sequence),
          kind: b.dataset.kind,
          round: b.dataset.round ? Number(b.dataset.round) : null,
          error: b.dataset.error === "true",
          inFlight: b.dataset.inFlight === "true",
          name: b.getAttribute("aria-label"),
          tag: b.tagName,
        })),
      })),
      boundaries: [...bar.querySelectorAll("[data-trace-round-boundary]")].map((m) =>
        Number(m.dataset.traceRoundBoundary),
      ),
      width: bar.getBoundingClientRect().width,
    }));

const blockCount = (page) => page.locator(`${BAR} [data-trace-block]`).count();

const rowState = (page, sequence) =>
  page
    .locator(BOX)
    .first()
    .evaluate((box, seq) => {
      const row = box.querySelector(`[data-trace-row="${seq}"]`);
      if (!row) return { found: false };
      const r = row.getBoundingClientRect();
      const f = box.getBoundingClientRect();
      return {
        found: true,
        inView: r.top >= f.top - 1 && r.bottom <= f.bottom + 1,
        highlighted: row.hasAttribute("data-trace-highlight"),
      };
    }, sequence);

const blocksOf = (bar, lane, round) =>
  (bar.lanes.find((l) => l.lane === lane)?.blocks ?? []).filter(
    (b) => round === undefined || b.round === round,
  );
const firstStep = (blocks) => Math.min(...blocks.map((b) => b.step));
const lastStep = (blocks) => Math.max(...blocks.map((b) => b.step));

async function checkBar(page, tag, artifact, { baseline = false } = {}) {
  const bar = await readBar(page);
  const want = expectedBar(artifact);
  const lanes = bar.lanes.map((l) => l.lane);
  const all = bar.lanes.flatMap((l) => l.blocks);
  check(
    lanes.every((l) => LANE_ORDER.includes(l)) &&
      lanes.every((l, i) => i === 0 || LANE_ORDER.indexOf(l) > LANE_ORDER.indexOf(lanes[i - 1])),
    `${tag}: lanes are in the fixed order (${lanes.join(", ")})`,
  );
  check(
    bar.lanes.every((l) => l.blocks.length > 0),
    `${tag}: no lane is empty`,
  );
  if (baseline)
    check(
      JSON.stringify(lanes) === JSON.stringify(["Run", "Baseline"]),
      `${tag}: the baseline shows only Run and Baseline lanes (${lanes.join(", ")})`,
    );
  check(all.length === want.records, `${tag}: ${all.length} blocks for ${want.records} records`);
  const tools = all.filter((b) => b.kind === "tool").length;
  check(tools === want.tools, `${tag}: ${tools} tool blocks for ${want.tools} recorded tool calls`);
  const errors = all.filter((b) => b.error).length;
  check(errors === want.failed, `${tag}: ${errors} error blocks for ${want.failed} failed records`);
  check(
    all.every((b) => b.tag === "BUTTON" && b.name && b.name.includes(`step ${b.step}`)),
    `${tag}: every block is a button named with its step`,
  );
  check(
    all
      .map((b) => b.step)
      .sort((a, b) => a - b)
      .every((s, i) => s === i + 1),
    `${tag}: each record takes exactly one step slot`,
  );
  return bar;
}

// Click a block far from where the box is scrolled, then do the same with Enter from the keyboard.
async function checkJump(page, tag, bar) {
  const sorted = bar.lanes.flatMap((l) => l.blocks).sort((a, b) => a.step - b.step);
  const cases = [
    { mode: "click", block: sorted[0], scrollTo: "bottom" },
    { mode: "Enter", block: sorted.at(-1), scrollTo: "top" },
  ];
  for (const { mode, block, scrollTo } of cases) {
    await page
      .locator(BOX)
      .first()
      .evaluate((box, to) => {
        box.scrollTop = to === "top" ? 0 : box.scrollHeight;
      }, scrollTo);
    const before = await rowState(page, block.sequence);
    const button = page.locator(`${BAR} [data-trace-block][data-step="${block.step}"]`);
    if (mode === "click") await button.click();
    else {
      await button.focus();
      await page.keyboard.press("Enter");
    }
    await page
      .waitForFunction(
        (seq) => {
          const row = document.querySelector(
            `[data-agent-lab-trace-box] [data-trace-row="${seq}"]`,
          );
          if (!row) return false;
          const f = row.closest("[data-agent-lab-trace-box]").getBoundingClientRect();
          const r = row.getBoundingClientRect();
          return r.top >= f.top - 1 && r.bottom <= f.bottom + 1;
        },
        block.sequence,
        { timeout: 4000 },
      )
      .catch(() => {});
    const after = await rowState(page, block.sequence);
    check(
      before.found && !before.inView,
      `${tag}: before ${mode}, row ${block.sequence} was out of view`,
    );
    check(
      after.found && after.inView,
      `${tag}: ${mode} on step ${block.step} brings row ${block.sequence} into the box`,
    );
    check(after.highlighted, `${tag}: ${mode} highlights row ${block.sequence}`);
  }
}

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
  // The bar and the fold toolbar sit above the box, so they are allowed on top of the box's own height.
  const aboveBox = await page
    .locator(`${BAR}, .agent-lab__trace-toolbar`)
    .evaluateAll((nodes) => nodes.reduce((sum, n) => sum + n.offsetHeight, 0));
  check(
    docHeight <= 1000 + headerHeight + aboveBox + HEIGHT_SLACK,
    `${tag}: document is ${docHeight}px, within one viewport plus the header (${headerHeight}px) and the bar and toolbar (${aboveBox}px)`,
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

  // 1b. The time bar for the same run.
  const liveArtifact = completeOf(await bodies[0]).artifact;
  const bar = await checkBar(page, tag, liveArtifact);
  summary[tag].bar = bar;
  check(
    bar.lanes.some((l) => l.lane === "Run") && bar.lanes.some((l) => l.lane === "Coordinator"),
    `${tag}: the bar has Run and Coordinator lanes`,
  );
  check(
    bar.lanes.find((l) => l.lane === "Coordinator")?.label === "Coordinator",
    `${tag}: desktop lane labels are written in full`,
  );
  const transport1 = blocksOf(bar, "transport", 1);
  const accommodation1 = blocksOf(bar, "accommodation", 1);
  check(
    transport1.length > 0 &&
      accommodation1.length > 0 &&
      firstStep(accommodation1) > lastStep(transport1),
    `${tag}: accommodation starts after transport's last round 1 block`,
  );
  for (const lane of ["itinerary", "dining"])
    check(
      blocksOf(bar, lane, 1).length > 0 &&
        firstStep(blocksOf(bar, lane, 1)) > lastStep(accommodation1),
      `${tag}: ${lane} starts after accommodation's last block`,
    );
  const round2 = bar.lanes
    .filter((l) => !["Run", "Coordinator"].includes(l.lane))
    .map((l) => [l.lane, l.blocks.filter((b) => (b.round ?? 0) >= 2).length]);
  check(
    round2
      .filter(([, n]) => n > 0)
      .map(([lane]) => lane)
      .join() === "transport",
    `${tag}: round 2 specialist blocks are only in transport (${JSON.stringify(round2)})`,
  );
  check(bar.boundaries.includes(2), `${tag}: the round 2 boundary is marked`);
  await checkJump(page, tag, bar);

  // 2. Scroll up mid-run: later events must not move the box. Scrolling to the bottom resumes following.
  await page.getByRole("button", { name: "Run experiment" }).click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-agent-lab-event]").length >= 14,
  );
  const before = await boxState(page);
  const midBlocks = await blockCount(page);
  check(
    midBlocks > 0 && midBlocks < 46,
    `${tag}: the bar is partway through the run while events stream (${midBlocks} blocks)`,
  );
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
  check(
    (await blockCount(page)) > midBlocks,
    `${tag}: the bar grew while the run streamed (${midBlocks} to ${await blockCount(page)} blocks)`,
  );
  await page.screenshot({ path: `${OUT}/${tag}.bar.png`, fullPage: true });
  await closeOut(session);
}

async function baseline(browser) {
  const tag = "baseline";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;
  await page.getByLabel("Strategy").selectOption("single-agent-baseline");
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const artifact = completeOf(await bodies[0]).artifact;
  const bar = await checkBar(page, tag, artifact, { baseline: true });
  summary[tag] = { bar };
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  await closeOut(session);
}

async function replay(browser) {
  const tag = "replay";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page } = session;
  await page.getByRole("button", { name: "Run experiment" }).click();
  await complete(page);
  const live = await readBar(page);
  const label = await page
    .getByLabel("Strategy")
    .locator(`option[value="${REVISION}"]`)
    .innerText();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: `Download artifact for ${label}` }).click(),
  ]);
  const path = await file.path();
  await page.getByLabel("Strategy").selectOption("single-agent-baseline");
  await page.locator("input[data-agent-lab-replay-input]").setInputFiles(path);
  await page.getByRole("status").getByText("Replaying recorded run", { exact: true }).waitFor();
  await page
    .getByRole("status")
    .getByText("Replay complete", { exact: true })
    .waitFor({ timeout: 90000 });
  const replayed = await readBar(page);
  check(
    JSON.stringify(replayed) === JSON.stringify(live),
    `${tag}: replaying the downloaded artifact draws the same bar as the live run`,
  );
  summary[tag] = { blocks: replayed.lanes.reduce((n, l) => n + l.blocks.length, 0) };
  await closeOut(session);
}

async function failureLab(browser) {
  const tag = "failure-lab";
  const session = await open(browser, { width: 1440, height: 1000, tag });
  const { page, bodies } = session;
  await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Failures" }).click();
  await page.getByRole("button", { name: "Run fault profile: Empty stay search" }).click();
  await page.locator("[data-agent-lab-outcome]").first().waitFor({ timeout: 90000 });
  await page.getByText(/^Trace \(\d+ events\)$/).click();
  const artifact = completeOf(await bodies[0]).artifact;
  const bar = await checkBar(page, tag, artifact);
  const failed = bar.lanes.flatMap((l) => l.blocks).filter((b) => b.error).length;
  check(failed > 0, `${tag}: the injected fault left failed records in the bar (${failed})`);
  // The error colour is the one a visitor sees: a failed block must not look like a healthy one.
  const colours = await page.evaluate((selector) => {
    const colour = (node) => (node ? getComputedStyle(node).backgroundColor : null);
    return {
      error: colour(document.querySelector(`${selector} [data-trace-block][data-error="true"]`)),
      healthy: colour(
        document.querySelector(
          `${selector} [data-trace-block][data-error="false"][data-kind="specialist"]`,
        ),
      ),
    };
  }, BAR);
  check(
    colours.error && colours.healthy && colours.error !== colours.healthy,
    `${tag}: failed blocks use their own colour (${colours.error} against ${colours.healthy})`,
  );
  summary[tag] = { failed, colours };
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
  const bar = await checkBar(page, tag, completeOf(await bodies[0]).artifact);
  check(bar.width <= 390, `${tag}: the bar fits the screen (${Math.round(bar.width)}px)`);
  const longest = Math.max(...bar.lanes.map((l) => (l.label ?? "").length));
  check(longest <= 5, `${tag}: lane labels abbreviate (longest is ${longest} characters)`);
  summary[tag] = { bar };
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
  summary[tag] = { ...summary[tag], events, before: state, after };
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
const panelHeading = (page) =>
  page.locator(".agent-lab__panel-heading [data-agent-lab-provenance]").first().innerText();

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
  // The time bar always shows the whole run: no fold may change a block (#221 acceptance).
  const barBefore = JSON.stringify(await readBar(page, scope));
  const barUnchanged = async (when) => {
    const now = await readBar(page, scope);
    check(
      JSON.stringify(now) === barBefore,
      `${tag}: the time bar is identical ${when} (${now.lanes.reduce((n, l) => n + l.blocks.length, 0)} blocks)`,
    );
  };

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
  await barUnchanged("with Rounds folded");
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
    await barUnchanged("with Calls folded");
    // Both folds together: only rows that are run-level and not tools.
    await rounds.click();
    const both = artifactEvents.filter(
      (e) => roundOf(e) === undefined && !TOOL_TYPES.has(e.event.type),
    ).length;
    check((await rows()) === both, `${tag}: both folds leave ${both} rows (got ${await rows()})`);
    await barUnchanged("with both folds on");
    await rounds.click();
    await calls.click();
    check((await rows()) === total, `${tag}: unfolding both restores every row`);
  }
  await barUnchanged("after unfolding");
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
  await baseline(browser);
  await replay(browser);
  await failureLab(browser);
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
