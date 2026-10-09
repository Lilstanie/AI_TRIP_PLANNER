// End-to-end check of the one settle path for plan changes (ticket #263, spec #259). Every change to a
// stop's day, order or existence is settled by the server (`POST /api/trip/preview-edit`), and the budget
// total the traveller reads is the total that settle produced. These scenarios read what the traveller sees:
//
// 1. Removing a priced stop takes its price off the Trip drawer's total at once, from a day that has one
//    stop left and from a day that is then empty.
// 2. Moving a stop to Ideas takes its price off the total at once: an Idea is not in the plan's estimate, and
//    scheduling it again puts the price back.
// 3. A move that keeps every stop's price (the arrow moves) leaves the total as it was, and the total the
//    drawer shows is the total the server answered.
// 4. The Your trips page shows, for the open trip, the same total as the Trip drawer after those changes.
//
// Places and route checks run in mock data mode: the server answers the legs with simulated routes and no provider
// is called. Map place lookups are stubbed at the browser boundary, as in check-entry-point.e2e.mjs. Each stop's
// price is given by the stubbed chat answer, which is how a priced stop reaches the plan. The artifact is
// output/playwright/settle-path/<LABEL>/summary.json, with screenshots beside it; the runner writes its own
// summary to output/e2e/runner/<time>.json.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e settle-path     # starts its own server
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/settle-path", LABEL);
mkdirSync(OUT, { recursive: true });

const PLANNER_WALK_MIN = 37;

// The trip: Day 1 has two priced stops, Day 2 has two priced stops. Prices are AUD planning amounts.
const PRICES = {
  "Sydney Opera House": 60,
  "Royal Botanic Garden Sydney": 40,
  "Bondi Beach": 25,
  "Manly Beach": 15,
};
const DAYS = {
  1: [
    { name: "Sydney Opera House", start: "09:00", end: "10:00" },
    { name: "Royal Botanic Garden Sydney", start: "12:00", end: "13:00" },
  ],
  2: [
    { name: "Bondi Beach", start: "14:00", end: "15:00" },
    { name: "Manly Beach", start: "16:30", end: "17:30" },
  ],
};

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const round2 = (value) => Math.round(value * 100) / 100;

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
  // Every edit the page sent, in order, with the total the server settled into its answer.
  return { operations: [], answers: [] };
}

/** Stubs the map's place lookups; the timeline's edits reach the real server, whose answers are recorded. */
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
    stub.operations.push(body.operation.kind);
    let response;
    try {
      response = await route.fetch();
    } catch {
      return undefined;
    }
    const json = await response.json().catch(() => ({}));
    if (json.plan) stub.answers.push({ kind: body.operation.kind, estTotal: json.plan.estTotal });
    return route.fulfill({ response, json });
  });
}

/**
 * Gives the chat's plan the stops of each seeded day, each with its price and the planner's walk into each
 * stop after the first. The section and plan totals are rolled up from the items, as the server rolls them up.
 */
async function installSeed(page, days, prices) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const plan = frame.response?.plan;
        const section = plan?.sections.find((s) => s.id === "itinerary");
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
              estCost: prices[stop.name],
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
        section.proposal.items = [...kept, ...seeded];
        section.estCost = round2(
          section.proposal.items.reduce((sum, item) => sum + (item.estCost ?? 0), 0),
        );
        plan.estTotal = round2(plan.sections.reduce((sum, s) => sum + (s.estCost ?? 0), 0));
        plan.overrunPct = ((plan.estTotal - plan.brief.budgetTotal) / plan.brief.budgetTotal) * 100;
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

async function openTrip(browser, { stub }) {
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
  await installSeed(page, DAYS, PRICES);
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
const dayRows = (page) => trip(page).locator(".timeline-day .timeline-stop");
const ideaRows = (page) => trip(page).locator(".timeline-ideas li.timeline-stop--idea");

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

/** The budget total the Trip drawer shows, as a number of AUD. */
async function drawerTotal(page) {
  const text = await page.locator(".trip__budget strong").innerText();
  return Number(text.replace(/[^0-9.]/g, ""));
}

/** Day N's tab, then the stop named `name` on that day (or in Ideas when `idea` is set). */
async function openDay(page, day) {
  await trip(page)
    .getByRole("tab")
    .nth(day - 1)
    .click();
  await settle(page, 400);
}
const stopNamed = (page, name) => dayRows(page).filter({ hasText: name }).first();
const ideaNamed = (page, name) => ideaRows(page).filter({ hasText: name }).first();

/** Opens a stop's action menu and picks an item by its exact name. */
async function pick(row, page, item) {
  await row.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  await settle(page, 300);
}

/** Expects the drawer total to move by `delta` from `before`, and to match the total the server answered last. */
async function expectTotal(page, stub, label, before, delta) {
  await settleChecks(page);
  const expected = round2(before + delta);
  const reached = await waitUntil(
    async () => Math.abs((await drawerTotal(page)) - expected) < 0.005,
    4000,
  );
  const shown = await drawerTotal(page);
  check(
    reached,
    `${label}: the total moves at once to ${expected} (shows ${shown}, was ${before})`,
  );
  const answer = stub.answers.at(-1);
  check(
    answer && Math.abs(answer.estTotal - shown) < 0.005,
    `${label}: the drawer shows the total the server settled (${shown}, server ${answer?.estTotal})`,
  );
  return shown;
}

async function main() {
  const summary = {};
  const browser = await chromium.launch();
  try {
    const stub = newStub();
    const run = await openTrip(browser, { stub });
    const { page } = run;
    await settleChecks(page);
    const start = await drawerTotal(page);
    summary.startTotal = start;
    check(Number.isFinite(start) && start > 0, `the trip has an estimated total (${start})`);
    await openDay(page, 1);
    check(
      (await dayRows(page).count()) === 2,
      `Day 1 shows its two priced stops (${await dayRows(page).count()})`,
    );

    // A. The arrow move keeps every price: Manly Beach moves earlier, past Bondi Beach. The total does not change.
    await openDay(page, 2);
    await pick(stopNamed(page, "Manly Beach"), page, "Move earlier");
    let total = await expectTotal(page, stub, "A. Move earlier (arrow)", start, 0);

    // B. Removing a priced stop from a day with two stops, leaving one.
    await openDay(page, 1);
    await pick(stopNamed(page, "Sydney Opera House"), page, "Remove");
    total = await expectTotal(
      page,
      stub,
      "B. Remove a priced stop, Day 1 keeps one stop",
      total,
      -60,
    );
    check(
      (await dayRows(page).count()) === 1,
      `B. Day 1 has one stop left (${await dayRows(page).count()})`,
    );

    // C. Removing a priced stop from Day 2, which keeps one stop.
    await openDay(page, 2);
    await pick(stopNamed(page, "Manly Beach"), page, "Remove");
    total = await expectTotal(
      page,
      stub,
      "C. Remove a priced stop, Day 2 keeps one stop",
      total,
      -15,
    );

    // D. Moving the last-but-one stop to Ideas: its price leaves the total at once.
    await openDay(page, 1);
    const botanic = stopNamed(page, "Royal Botanic Garden Sydney");
    await pick(botanic, page, "Move to ideas");
    total = await expectTotal(page, stub, "D. Move a priced stop to Ideas", total, -40);
    check(
      (await ideaNamed(page, "Royal Botanic Garden Sydney").count()) === 1,
      "D. the stop is listed under Ideas",
    );

    // E. Scheduling the Idea on Day 2 puts its price back into the total.
    await ideaNamed(page, "Royal Botanic Garden Sydney")
      .getByRole("button", { name: /^Actions for / })
      .click();
    await page.getByRole("menuitem", { name: "Schedule on a day", exact: true }).click();
    await trip(page).locator(".stop-place-card select").selectOption("2");
    await trip(page).locator(".stop-place-card button[type=submit]").click();
    await settle(page, 700);
    total = await expectTotal(page, stub, "E. Schedule the Idea on Day 2", total, 40);

    // F. Removing the only stop left on Day 2 (Bondi Beach) empties the day.
    await openDay(page, 2);
    await pick(stopNamed(page, "Bondi Beach"), page, "Remove");
    total = await expectTotal(page, stub, "F. Remove the last stop of Day 2", total, -25);
    check(
      (await dayRows(page).count()) === 1,
      `F. Day 2 has one stop left, the scheduled Idea (${await dayRows(page).count()})`,
    );
    summary.endTotal = total;

    // G. The Your trips page shows the same total for the open trip as the drawer does.
    const sidebarTrips = page.locator(".sidebar-nav").getByRole("button", { name: /^Trips/ });
    await sidebarTrips.click();
    await page.locator(".trips-page .trip-card").first().waitFor({ timeout: 10_000 });
    await settle(page, 600);
    const cards = (await page.locator(".trips-page .trip-card").allTextContents()).map((text) =>
      text.replace(/\s+/g, " "),
    );
    const shownTotal = `AUD ${total.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    summary.tripCards = cards;
    check(
      cards.some((text) => text.includes(shownTotal)),
      `G. the open trip's card shows the drawer's total (${shownTotal}; cards: ${JSON.stringify(cards)})`,
    );
    await page.screenshot({ path: `${OUT}/trips.png`, fullPage: true });

    check(
      !run.errors.length,
      `no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
    );
    summary.operations = stub.operations;
    summary.answers = stub.answers;
    await run.context.close();
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
