// End-to-end check of the one check entry point for plan edits, and of undo that ignores Ideas (ticket #262,
// spec #259). Every edit that changes a stop's day, time, place, order or leg is checked by the server
// (`POST /api/trip/preview-edit`) and applied or refused by the plan revision owner. These scenarios read
// what the traveller sees:
//
// 1. A time change on a trip with an Idea, then Undo: the time comes back, with no error and the Idea kept.
// 2. A travel-buffer notice from an accepted edit sits under its own stop only, not under the day or its other stops.
// 3. A refused edit names the stop it is about, so the traveller knows what to fix.
// 4. An edit whose answer arrives after the plan changed elsewhere says to try the change again, and does not apply.
// 5. Moving a stop with the arrows goes through the check, and the stop after it has no travel time from the old
//    neighbour (its leg is routed again from the new one, or shown with no time).
// 6. Removing a stop and moving a stop to Ideas go through the check too.
// 7. A chat replan after a timeline change says that it replaced it; a replan with no change says nothing.
//
// Places and route checks run in mock data mode: the server answers the legs with simulated routes and no provider
// is called. Map place lookups are stubbed at the browser boundary, as in plan-revision.e2e.mjs. The artifact is
// output/playwright/check-entry-point/<LABEL>/summary.json, with screenshots beside it; the runner writes its own
// summary to output/e2e/runner/<time>.json.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e check-entry-point     # starts its own server
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/check-entry-point", LABEL);
mkdirSync(OUT, { recursive: true });

const PLANNER_WALK_MIN = 37;
const REPLACED = "The new plan replaced your last change to the timeline.";
const TRY_AGAIN = "The plan changed while this change was being checked. Try the change again.";

// Day 1: three stops, each with a saved place. The second and third carry the planner's walk from the stop before.
const DAY_ONE = [
  { name: "Sydney Opera House", start: "09:00", end: "10:00" },
  { name: "Royal Botanic Garden Sydney", start: "11:30", end: "12:30" },
  { name: "Bondi Beach", start: "14:00", end: "15:00" },
];
// Day 1 with a stop late in the evening, so a later time change pushes it past midnight.
const DAY_LATE = [
  { name: "Sydney Opera House", start: "09:00", end: "10:00" },
  { name: "Royal Botanic Garden Sydney", start: "11:00", end: "12:00" },
  { name: "Bondi Beach", start: "21:00", end: "23:50" },
];
const IDEA = { name: "Art Gallery of New South Wales", idea: true };

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function placeFor(text) {
  return {
    id: `stub:${text}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW, Australia`,
    location: { latitude: -33.8568, longitude: 151.2153 },
    googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(text)}`,
  };
}

function newStub() {
  return {
    // The kind of every edit request the page sent, in order, and the operations it carried.
    operations: [],
    // Set to a promise to hold the next answer to a time edit until it resolves.
    holdTime: undefined,
  };
}

/** Stubs the map's place lookups; the timeline's edits and checks reach the real server. */
async function installStubs(page, stub) {
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ places: [placeFor(text)] }),
    });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ place: { ...placeFor(placeId), id: placeId } }),
    });
  });
  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    stub.operations.push(body.operation);
    const kind = body.operation.kind;
    if (kind === "time" && stub.holdTime) {
      try {
        await stub.holdTime;
      } catch {
        return undefined;
      }
    }
    try {
      return await route.continue();
    } catch {
      return undefined;
    }
  });
}

/**
 * Gives the plan's activities the stops of each seeded day, as a real plan from chat would have: the stops
 * are scheduled on their days, with saved places and the planner's walk into each stop after the first. Ideas
 * are stops with no day and no times.
 */
async function installSeed(page, days, ideas = []) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        const kept = section.proposal.items.filter((item) => item.kind !== "activity");
        const seeded = [];
        for (const [dayNumber, stops] of Object.entries(days)) {
          stops.forEach((stop, index) => {
            seeded.push({
              id: `seed-d${dayNumber}-${index + 1}`,
              kind: "activity",
              day: Number(dayNumber),
              startTime: stop.start,
              endTime: stop.end,
              location: stop.name,
              detail: stop.name,
              placeId: `stub:${stop.name}`,
              ...(index > 0
                ? {
                    arriveBy: {
                      mode: "walk",
                      durationMin: PLANNER_WALK_MIN,
                      from: stops[index - 1].name,
                    },
                  }
                : {}),
            });
          });
        }
        ideas.forEach((idea, index) => {
          seeded.push({
            id: `seed-idea-${index + 1}`,
            kind: "activity",
            location: idea.name,
            detail: idea.name,
          });
        });
        section.proposal.items = [...kept, ...seeded];
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

async function openTrip(browser, { days, ideas, stub }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/status of 50[23]/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await installStubs(page, stub);
  await installSeed(page, days, ideas);
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /^(Live|Mock) data/ })
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
  const chatTab = page.getByRole("tab", { name: /^Chat/ });
  if (await chatTab.count()) {
    await chatTab.click();
    await settle(page, 500);
  }
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
  await settle(page, 700);
  return { context, page, errors };
}

/** Polls `test` for up to `ms`; resolves to whether it passed. */
async function waitUntil(test, ms = 8000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await sleep(200);
  }
  return test();
}

const trip = (page) => page.getByRole("region", { name: "Trip timeline" });

/** Day N's stop at a position (1-based), as the timeline lists it on that day. */
async function stopRow(page, day, position) {
  await trip(page)
    .getByRole("tab")
    .nth(day - 1)
    .click();
  await settle(page, 400);
  return trip(page)
    .locator(".timeline-day .timeline-stop")
    .nth(position - 1);
}

/** Opens a stop's time editor, sets its start and end, and applies it with Change time. */
async function changeTime(page, day, position, start, end) {
  const row = await stopRow(page, day, position);
  await row.locator(".timeline-stop__time").click();
  await trip(page)
    .getByLabel(/^Start/)
    .first()
    .fill(start);
  await trip(page).getByLabel(/^End/).first().fill(end);
  await trip(page).getByRole("button", { name: "Change time", exact: true }).click();
}

/** The stop row whose name is `name` on the chosen day. */
async function rowNamed(page, day, name) {
  await trip(page)
    .getByRole("tab")
    .nth(day - 1)
    .click();
  await settle(page, 400);
  return trip(page).locator(".timeline-day .timeline-stop").filter({ hasText: name }).first();
}

async function startOf(page, day, position) {
  const row = await stopRow(page, day, position);
  return (await row.locator(".timeline-stop__time").innerText()).replace(/\s+/g, " ");
}

/** Waits until no route check is running and the plan has settled. */
async function settleChecks(page) {
  await settle(page, 600);
  for (let round = 0; round < 60; round += 1) {
    const busy =
      (await page.getByText("Checking travel times…").count()) > 0 ||
      (await page.getByText("Checking the change…").count()) > 0;
    if (!busy) return;
    await settle(page, 250);
  }
}

/** Makes the trip timeline visible: the Trip tab on phones, the Trip drawer on wider screens. */
async function showTimeline(page) {
  if (await trip(page).count()) return;
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await trip(page).waitFor({ timeout: 30_000 });
  await settle(page, 500);
}

/** Starts a new chat from its first suggestion; its first reply is a plan, so the chat is a second trip. */
async function startNewTrip(page) {
  await page.keyboard.press("Escape");
  await settle(page, 300);
  await page
    .getByRole("button", { name: /^Chats/ })
    .first()
    .click();
  await settle(page, 400);
  await page.getByRole("button", { name: "New chat", exact: true }).click();
  await settle(page, 400);
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").last().waitFor({ timeout: 180_000 });
  await settle(page, 1200);
}

/** Opens the first trip in the Chats panel's Trips list that is not the open one. */
async function openOtherTrip(page) {
  await page
    .getByRole("button", { name: /^Chats/ })
    .first()
    .click();
  await settle(page, 400);
  const items = page.locator(".history-item--trip");
  const count = await items.count();
  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    if ((await item.locator("[aria-current='true']").count()) === 0) {
      await item.locator(".history-item__open").click();
      await settle(page, 800);
      return;
    }
  }
  throw new Error("no other trip to open");
}

async function main() {
  const summary = {};
  const browser = await chromium.launch();
  try {
    // 1. A time change on a trip with an Idea, then Undo. The time comes back with no error and the Idea stays.
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, ideas: [IDEA], stub });
      const { page } = run;
      const before = await startOf(page, 1, 1);
      await changeTime(page, 1, 1, "09:15", "10:15");
      await settleChecks(page);
      check(
        (await startOf(page, 1, 1)).includes("09:15"),
        "1: the time change with an Idea in the plan is applied",
      );
      await trip(page).getByRole("button", { name: "Undo last change" }).click();
      await settleChecks(page);
      const restored = await startOf(page, 1, 1);
      check(restored === before, `1: Undo restores the time (${restored}, was ${before})`);
      check(
        !(await trip(page).locator(".timeline-status--error").count()),
        "1: Undo with an Idea in the plan shows no error",
      );
      check(
        (await trip(page).locator(".timeline-ideas .timeline-stop").count()) >= 1,
        "1: the Idea is still in Ideas after Undo",
      );
      summary.undoWithIdea = { before, restored };
      await page.screenshot({ path: `${OUT}/01-undo-with-idea.png` });
      check(
        !run.errors.length,
        `1: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 2. A travel-buffer notice from an accepted edit is shown under its own stop only.
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      // The second stop starts a minute after the first one ends: the leg to it needs travel and a buffer.
      await changeTime(page, 1, 2, "10:01", "11:01");
      await settleChecks(page);
      const notice = trip(page).locator(".timeline-stop__conflicts li", {
        hasText: "needs at least",
      });
      check(
        (await notice.count()) === 1,
        `2: one travel-buffer notice is shown (${await notice.count()})`,
      );
      const owner = await rowNamed(page, 1, "Royal Botanic Garden Sydney");
      check(
        (await owner
          .locator(".timeline-stop__conflicts li", { hasText: "needs at least" })
          .count()) === 1,
        "2: the notice is under the stop it is about",
      );
      for (const other of ["Sydney Opera House", "Bondi Beach"]) {
        const row = await rowNamed(page, 1, other);
        check(
          (await row
            .locator(".timeline-stop__conflicts li", { hasText: "needs at least" })
            .count()) === 0,
          `2: the notice is not under ${other}`,
        );
      }
      check(
        (await trip(page)
          .locator(".timeline-day__conflicts li", { hasText: "needs at least" })
          .count()) === 0,
        "2: the notice is not under the day title",
      );
      summary.noticeUnderStop = {
        notices: await notice.allInnerTexts(),
      };
      await page.screenshot({ path: `${OUT}/02-notice-under-stop.png` });
      check(
        !run.errors.length,
        `2: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 3. A refused edit names the stop it is about: the time change pushes the last stop past midnight.
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_LATE }, stub });
      const { page } = run;
      const lateBefore = await startOf(page, 1, 3);
      await changeTime(page, 1, 2, "20:30", "21:50");
      await settleChecks(page);
      const alert = trip(page).locator(".timeline-status--error li");
      const alerts = await alert.allInnerTexts();
      check(alerts.length >= 1, `3: the refused edit shows an alert (${JSON.stringify(alerts)})`);
      check(
        alerts.some((text) => text.includes("Bondi Beach")),
        `3: the refused edit names the stop it is about (${JSON.stringify(alerts)})`,
      );
      check(
        (await startOf(page, 1, 2)).includes("11:00"),
        "3: the refused edit leaves the plan unchanged",
      );
      check((await startOf(page, 1, 3)) === lateBefore, "3: the stop past midnight keeps its time");
      summary.refusedNames = { alerts };
      await page.screenshot({ path: `${OUT}/03-refused-names-stop.png` });
      check(
        !run.errors.length,
        `3: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 4. The plan changes while a time change is being checked: the answer is refused as stale and says to try again.
    //    The traveller's second trip replaces the first one's plan on the timeline while the change is held.
    {
      const stub = newStub();
      let release = () => {};
      stub.holdTime = new Promise((done) => (release = done));
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      await startNewTrip(page);
      await openOtherTrip(page);
      await showTimeline(page);
      const first = await startOf(page, 1, 1);
      await changeTime(page, 1, 1, "09:15", "10:15");
      check(
        await waitUntil(async () => stub.operations.some((op) => op.kind === "time"), 15_000),
        "4: the time change is sent and held",
      );
      // The other trip becomes the plan while the change is held.
      await openOtherTrip(page);
      await showTimeline(page);
      release();
      await settle(page, 1500);
      await settleChecks(page);
      check(
        (await trip(page).locator(".timeline-status--error li", { hasText: TRY_AGAIN }).count()) ===
          1,
        "4: a change whose plan moved on says to try the change again",
      );
      const other = await startOf(page, 1, 1);
      check(
        other === first,
        `4: the stale change is not applied to the other trip (${other}, was ${first})`,
      );
      summary.planChanged = { first, other };
      await page.screenshot({ path: `${OUT}/04-plan-changed-during-check.png` });
      check(
        !run.errors.length,
        `4: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 5. Moving a stop earlier with its arrow goes through the check. The stop after it no longer has its leg from the
    //    old neighbour: the leg into it is from the stop it now follows (or shows no time until that route is checked).
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      const oldLeg = (from, to) =>
        trip(page).locator(`select[aria-label="Travel from ${from} to ${to} by"]`);
      check(
        (await oldLeg("Royal Botanic Garden Sydney", "Bondi Beach").count()) === 1,
        "5: the leg from the second stop into the third is shown before the move",
      );
      const row = await rowNamed(page, 1, "Royal Botanic Garden Sydney");
      await row.getByRole("button", { name: /^Actions for / }).click();
      await trip(page).getByRole("menuitem", { name: "Move earlier", exact: true }).click();
      await settleChecks(page);
      await settle(page, 800);
      await settleChecks(page);
      const kinds = stub.operations.map((op) => op.kind);
      check(kinds.includes("swap"), `5: an arrow move is sent to the check (${kinds.join(", ")})`);
      check(
        (await oldLeg("Royal Botanic Garden Sydney", "Bondi Beach").count()) === 0,
        "5: no leg from the moved stop's old neighbour into the next stop remains",
      );
      check(
        (await oldLeg("Sydney Opera House", "Bondi Beach").count()) === 1,
        "5: the next stop's leg is from the stop it now follows",
      );
      summary.moveEarlier = { operations: kinds };
      await page.screenshot({ path: `${OUT}/05-move-clears-travel-time.png` });
      check(
        !run.errors.length,
        `5: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 6. Removing a stop and moving a stop to Ideas go through the check.
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      const row = await rowNamed(page, 1, "Royal Botanic Garden Sydney");
      await row.getByRole("button", { name: /^Actions for / }).click();
      await trip(page).getByRole("menuitem", { name: "Move to ideas", exact: true }).click();
      await settleChecks(page);
      const toIdeas = stub.operations.map((op) => op.kind);
      check(
        toIdeas.includes("idea"),
        `6: moving a stop to Ideas is sent to the check (${toIdeas.join(", ")})`,
      );
      const second = await rowNamed(page, 1, "Bondi Beach");
      await second.getByRole("button", { name: /^Actions for / }).click();
      await trip(page).getByRole("menuitem", { name: "Remove", exact: true }).click();
      await settleChecks(page);
      const removed = stub.operations.map((op) => op.kind);
      check(
        removed.includes("remove"),
        `6: removing a stop is sent to the check (${removed.join(", ")})`,
      );
      summary.removeAndIdeas = { operations: removed };
      await page.screenshot({ path: `${OUT}/06-remove-and-ideas.png` });
      check(
        !run.errors.length,
        `6: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    // 7. A chat replan after a timeline change says that it replaced the change; a replan with no change says nothing.
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      await changeTime(page, 1, 1, "09:15", "10:15");
      await settleChecks(page);
      if (await page.getByRole("tab", { name: /^Chat/ }).count())
        await page.getByRole("tab", { name: /^Chat/ }).click();
      await settle(page, 400);
      await page
        .getByRole("textbox", { name: "Message AI Trip Planner" })
        .fill("Make day 1 a little slower");
      await page.getByRole("textbox", { name: "Message AI Trip Planner" }).press("Enter");
      await page.locator(".msg-item--agent .msg-item__body").nth(1).waitFor({ timeout: 180_000 });
      await settle(page, 1000);
      check(
        (await page.getByText(REPLACED).count()) === 1,
        "7: a replan after a timeline change says it replaced the change",
      );
      summary.replanAfterEdit = { notice: await page.getByText(REPLACED).count() };
      await page.screenshot({ path: `${OUT}/07-replan-after-edit.png` });
      check(
        !run.errors.length,
        `7: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }
    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      if (await page.getByRole("tab", { name: /^Chat/ }).count())
        await page.getByRole("tab", { name: /^Chat/ }).click();
      await settle(page, 400);
      await page
        .getByRole("textbox", { name: "Message AI Trip Planner" })
        .fill("Make day 1 a little slower");
      await page.getByRole("textbox", { name: "Message AI Trip Planner" }).press("Enter");
      await page.locator(".msg-item--agent .msg-item__body").nth(1).waitFor({ timeout: 180_000 });
      await settle(page, 1000);
      check(
        (await page.getByText(REPLACED).count()) === 0,
        "7: a replan with no timeline change says nothing about one",
      );
      await run.context.close();
    }
  } finally {
    await browser.close();
  }
  summary.failures = failures;
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${failures.length ? `${failures.length} check(s) failed` : "all checks passed"}`);
  console.log(`artifact: ${OUT}/summary.json`);
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
