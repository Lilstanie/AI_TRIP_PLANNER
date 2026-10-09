// End-to-end check of saving the map's place on each stop without a traveller action (ticket #236).
//
// Google Places and the immediate place edit are stubbed at the browser boundary, because the
// repository's E2E environment has no map key: the real Places routes answer 503 for every lookup,
// so no stop could be located. The stubs answer the same shapes the real routes do and record every
// request. The checks are about the workspace: which stops are saved, how many saves run at once,
// each stop sent once, a not-found stop offering a search, a retryable lookup failure staying unsaved
// until Retry places, and the traveller replacing a saved place. With no map places at all, no save
// is sent.
//
// The artifact is output/playwright/auto-save-places/<LABEL>/summary.json, with screenshots beside it.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e auto-save-places     # starts its own server
//   BASE_URL=http://localhost:3000 LABEL=after node apps/web/tests/e2e/auto-save-places.e2e.mjs
//
// Not covered: a newer plan from chat cancelling a save in flight. That needs a second chat turn
// while a save is pending; the workspace hook aborts the save on every plan change.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/auto-save-places", LABEL);
mkdirSync(OUT, { recursive: true });

// The mock plan's stops have placeholder names, which are never looked up. The chat stream is
// rewritten so the stops carry these real names, in plan order (one stop a day in the mock plan).
const STOP_NAMES = [
  "Sydney Opera House",
  "Royal Botanic Garden Sydney",
  "Circular Quay",
  "Art Gallery of New South Wales",
];
// Stop names the stubbed Places finds nothing for, and names whose lookup fails with 503 until the
// run releases them.
const NOT_FOUND = new Set(["Circular Quay"]);
const FLAKY = new Set(["Art Gallery of New South Wales"]);
// Places the traveller picks by hand: one for the stop the map could not find, one to replace a saved
// place. Neither is a stop name, so each save is recognisable in the summary.
const PICK = "Taronga Zoo";
const REPLACE = "Manly Beach";

const UNCONFIRMED = "Not found on the map";
const RETRYABLE = "Place lookup failed — retry from the map";

// Scenario 4: a Day 1 of five stops, each with the planner's arrival time (`arriveBy`) from the stop before it.
// The planner's walk is 37 minutes, longer than any simulated walk (6 to 30 minutes), so a verified leg is
// never mistaken for the planner's estimate. Each gap between stops is 90 minutes, enough for a leg and its
// 15-minute buffer, so the first routing raises no timing notice.
const SEEDED_STOPS = [
  { name: "Sydney Opera House", start: "09:00", end: "10:00" },
  { name: "Royal Botanic Garden Sydney", start: "11:30", end: "12:30" },
  { name: "Bondi Beach", start: "14:00", end: "15:00" },
  { name: "The Rocks", start: "16:30", end: "17:30" },
  { name: "Darling Harbour", start: "19:00", end: "20:00" },
];
const PLANNER_WALK_MIN = 37;
// The stop price the scenario gives one stop, as the server would answer a priced stop.
const PRICE = 40;

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
    searches: [],
    saves: [],
    rejected: [],
    inFlight: 0,
    maxInFlight: 0,
    releaseFlaky: false,
    // Scenario 4 holds an answer until the test releases it: a verify or a move (a swap, checked by the
    // server since the check entry point), or the next time edit's answer is priced (`priceNextTime`).
    // `holdSeen` is set once the held request has arrived.
    holdVerify: undefined,
    holdSeen: false,
    priceNextTime: false,
  };
}

async function installStubs(page, stub) {
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    stub.searches.push(text);
    if (FLAKY.has(text) && !stub.releaseFlaky)
      return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
    const places = NOT_FOUND.has(text) ? [] : [placeFor(text)];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ places }),
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
  // The place edit, answered the way the server answers a place operation: the stop takes the place
  // and the plan's version moves on. A base version the plan has already left is refused.
  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    if (["verify", "swap"].includes(body.operation.kind) && stub.holdVerify) {
      stub.holdSeen = true;
      await stub.holdVerify;
    }
    if (body.operation.kind === "time" && stub.priceNextTime) {
      // The server's answer for a stop that carries a price: the stop, its section and the total.
      stub.priceNextTime = false;
      const response = await route.fetch();
      const json = await response.json();
      const section = json.plan.sections.find((s) => s.id === "itinerary");
      const item = section.proposal.items.find((i) => i.id === body.operation.id);
      item.estCost = PRICE;
      section.estCost = (section.estCost ?? 0) + PRICE;
      json.plan.estTotal += PRICE;
      return route.fulfill({ response, json });
    }
    if (body.operation.kind !== "place") {
      // A verify or time edit the test has held may be abandoned by the page: its answer is then not
      // needed, and continuing an aborted request is refused.
      try {
        return await route.continue();
      } catch {
        return undefined;
      }
    }
    stub.inFlight += 1;
    stub.maxInFlight = Math.max(stub.maxInFlight, stub.inFlight);
    await sleep(250);
    stub.inFlight -= 1;
    const plan = body.plan;
    const current = plan.editVersion ?? 0;
    if (body.baseVersion !== current) {
      stub.rejected.push({ stop: body.operation.id, reason: "stale base version" });
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "The trip changed while this was being checked." }),
      });
    }
    const items = plan.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? [];
    const item = items.find((i) => i.id === body.operation.id);
    if (!item) return route.fulfill({ status: 400, contentType: "application/json", body: "{}" });
    stub.saves.push({
      stop: item.location ?? item.detail,
      placeId: body.operation.placeId,
      baseVersion: body.baseVersion,
    });
    item.placeId = body.operation.placeId;
    item.priceNeedsReview = true;
    plan.editVersion = current + 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan, routes: [], blockerNotices: [], blockers: [] }),
    });
  });
}

/** Gives the plan's activities the STOP_NAMES, without a place, as a real plan from chat would have. */
async function installStopNames(page, { seeded = false } = {}) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        if (seeded) {
          // Scenario 4: the five stops on Day 1, unsaved, each with the planner's arrival time from the stop
          // before it. Ids are set here so the stops can be told apart in the test.
          const kept = section.proposal.items.filter((item) => item.kind !== "activity");
          section.proposal.items = [
            ...kept,
            ...SEEDED_STOPS.map((stop, index) => ({
              id: `seed-stop-${index + 1}`,
              kind: "activity",
              day: 1,
              startTime: stop.start,
              endTime: stop.end,
              location: stop.name,
              detail: stop.name,
              ...(index
                ? {
                    arriveBy: {
                      mode: "walk",
                      durationMin: PLANNER_WALK_MIN,
                      from: SEEDED_STOPS[index - 1].name,
                    },
                  }
                : {}),
            })),
          ];
          return JSON.stringify(frame);
        }
        let index = 0;
        for (const item of section.proposal.items) {
          if (item.kind !== "activity" || item.day === undefined) continue;
          const name = STOP_NAMES[index % STOP_NAMES.length];
          index += 1;
          item.location = name;
          item.detail = name;
          delete item.placeId;
        }
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

async function openTrip(browser, { width, height, stub, seeded = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const previewRequests = [];
  // The kind of each edit the page asks the server for, in order (place, verify, time, ...).
  const operations = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/trip/preview-edit")) return;
    previewRequests.push(request.url());
    operations.push(request.postDataJSON().operation.kind);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Lookups answered 502/503 are the expected state without a map key; nothing else is allowed.
    if (/status of 50[23]/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  if (stub) {
    await installStubs(page, stub);
    await installStopNames(page, { seeded });
  }
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
  check(
    (await page.getByRole("button", { name: /^Mock data/ }).count()) === 1,
    `${width}px: planning with mock data`,
  );
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
  // The day view is the Trip drawer's only view, so it is there once the drawer opens.
  await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
  await settle(page, 700);
  return { context, page, errors, previewRequests, operations };
}

/** Polls `test` for up to `ms`; resolves to whether it passed. */
async function waitUntil(test, ms = 8000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await sleep(200);
  }
  return test();
}

/** Waits until no save is running and the number of saves has stopped changing. */
async function waitForQuiet(page, stub) {
  let last = -1;
  for (let round = 0; round < 120; round += 1) {
    const busy = (await page.getByText("Saving place…").count()) > 0 || stub.inFlight > 0;
    if (!busy && stub.saves.length === last) return;
    last = busy ? -1 : stub.saves.length;
    await settle(page, 250);
  }
}

/** Every stop on every day: its displayed name and the status tags it shows. */
async function scanStops(page) {
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  const days = timeline.getByRole("tab");
  const stops = [];
  for (let day = 0; day < (await days.count()); day += 1) {
    await days.nth(day).click();
    await settle(page, 400);
    const rows = timeline.locator(".timeline-day .timeline-stop");
    for (let row = 0; row < (await rows.count()); row += 1) {
      const item = rows.nth(row);
      const name = await item
        .locator(".timeline-stop__name")
        .evaluate((element) => element.lastChild?.textContent?.trim() ?? "");
      const tags = (await item.locator(".timeline-tag").allInnerTexts()).map((text) => text.trim());
      stops.push({ day: day + 1, row, name, tags });
    }
  }
  return stops;
}

const isConfirmed = (stop) => stop.tags.includes("Place confirmed");
const sameStop = (a, b) => a.day === b.day && a.row === b.row;

async function openStop(page, stop) {
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  await timeline
    .getByRole("tab")
    .nth(stop.day - 1)
    .click();
  await settle(page, 400);
  const row = timeline.locator(".timeline-day .timeline-stop").nth(stop.row);
  if (!(await row.locator(".stop-editor").count()))
    await row.locator(".timeline-stop__main").click();
  await settle(page, 300);
  return row;
}

async function searchAndUse(page, row, text) {
  if (!(await row.getByRole("searchbox").count())) {
    await row.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
    await settle(page, 300);
  }
  await row.getByRole("searchbox").fill(text);
  await row.getByRole("button", { name: "Search", exact: true }).click();
  const result = row.getByRole("button", { name: `Use ${text}` });
  await result.waitFor({ timeout: 20_000 });
  await result.click();
}

async function main() {
  const summary = { labels: { unconfirmed: UNCONFIRMED, retryable: RETRYABLE } };
  const browser = await chromium.launch();
  try {
    // 1. A planned trip: every stop the map finds is saved on its own.
    const stub = newStub();
    const { context, page, errors } = await openTrip(browser, { width: 1440, height: 1000, stub });
    await waitForQuiet(page, stub);
    let stops = await scanStops(page);
    const unconfirmed = stops.filter((stop) => stop.tags.includes(UNCONFIRMED));
    const retryable = stops.filter((stop) => stop.tags.includes(RETRYABLE));
    const savedNames = stub.saves.map((save) => save.stop);
    summary.afterPlanning = { stops, saves: stub.saves, searches: [...new Set(stub.searches)] };
    check(stops.length > 0, `the trip has stops on its days (${stops.length})`);
    check(
      (await page.getByText("Map match").count()) === 0 &&
        (await page.getByText("Use this place").count()) === 0,
      "no 'Map match' badge or 'Use this place' box is shown",
    );
    check(
      stub.maxInFlight <= 1,
      `at most one place save in flight at a time (saw ${stub.maxInFlight})`,
    );
    check(
      new Set(savedNames).size === savedNames.length,
      `each stop is saved once (${savedNames.length} saves, ${new Set(savedNames).size} stops)`,
    );
    check(
      [...savedNames].sort().join("|") ===
        ["Royal Botanic Garden Sydney", "Sydney Opera House"].join("|"),
      `the located stops are saved on their own (${savedNames.join(", ") || "none"})`,
    );
    check(
      stub.rejected.length === 0,
      `no save was sent against a stale plan (${stub.rejected.length})`,
    );
    const stillPending = stops.filter(
      (stop) => !isConfirmed(stop) && !unconfirmed.includes(stop) && !retryable.includes(stop),
    );
    check(
      stillPending.length === 0,
      `every located stop is saved (${stillPending.length} located but unsaved)`,
    );
    check(
      stops.every((stop) => !stop.tags.includes("Place not saved yet")),
      "no stop is left in 'Place not saved yet'",
    );
    await page.screenshot({ path: `${OUT}/01-timeline-after-planning.png` });

    // 2. A stop the map cannot find says so; a search saves the picked result.
    const missing = unconfirmed[0];
    if (missing) {
      summary.notFound = missing;
      const row = await openStop(page, missing);
      check(
        (await row
          .getByText("The map could not find this place. Search for it to save it.")
          .count()) === 1,
        "a stop the map cannot find says so and offers a search",
      );
      check(
        !savedNames.includes(missing.name),
        "a stop the map cannot find is not saved automatically",
      );
      await searchAndUse(page, row, PICK);
      await waitForQuiet(page, stub);
      stops = await scanStops(page);
      const after = stops.find((stop) => sameStop(stop, missing));
      check(after && isConfirmed(after), "picking a search result saves the stop's place");
      check(
        stub.saves.filter((save) => save.placeId === `stub:${PICK}`).length === 1,
        "the picked result is saved once",
      );
    } else {
      check(false, "the mock plan has a stop the map cannot find (set NOT_FOUND)");
    }

    // 3. The traveller replaces an automatically saved place from the editor's search.
    const saved = stops.find((stop) => isConfirmed(stop) && !sameStop(stop, missing ?? {}));
    if (saved) {
      const row = await openStop(page, saved);
      await searchAndUse(page, row, REPLACE);
      await waitForQuiet(page, stub);
      check(
        stub.saves.filter((save) => save.placeId === `stub:${REPLACE}`).length === 1,
        "the traveller replaces a saved place from the editor's search",
      );
      stops = await scanStops(page);
      check(
        stops.some((stop) => sameStop(stop, saved) && isConfirmed(stop)),
        "the replaced stop stays confirmed",
      );
    }
    await page.screenshot({ path: `${OUT}/02-timeline-after-edits.png` });

    // 4. A lookup that fails for a retryable reason is not saved; Retry places saves it.
    const flaky = retryable[0];
    summary.retryable = flaky ?? null;
    if (flaky) {
      check(
        !savedNames.includes(flaky.name) && !stub.saves.some((save) => save.stop === flaky.name),
        "a stop whose lookup failed for a retryable reason is not saved",
      );
      stub.releaseFlaky = true;
      // The open Trip drawer covers the map's Retry places button on desktop; the click is made on
      // the element itself, as the map's own control would receive it.
      await page
        .getByRole("button", { name: "Retry places" })
        .first()
        .evaluate((element) => element.click());
      await waitForQuiet(page, stub);
      stops = await scanStops(page);
      const after = stops.find((stop) => sameStop(stop, flaky));
      check(after && isConfirmed(after), "Retry places saves the stop once its lookup succeeds");
    }
    check(!errors.length, `no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
    summary.finalStops = stops;
    summary.saves = stub.saves;
    summary.maxInFlight = stub.maxInFlight;
    await context.close();

    // 4. A day whose stops already carry the planner's arrival times (`arriveBy`). Its places are saved one by
    //    one; the day is then verified once, and its legs read as routed. An edit started while that verify is
    //    in flight is applied and not replaced by the verify's answer. A timing notice sits on its stop only,
    //    and removing a priced stop takes its price off the estimate at once.
    const seeded = newStub();
    const day = await openTrip(browser, { width: 1440, height: 1000, stub: seeded, seeded: true });
    const seededPage = day.page;
    const trip = (page) => page.getByRole("region", { name: "Trip timeline" });
    const dayOne = () => trip(seededPage).locator(".timeline-day .timeline-stop");
    const stopRow = (position) => dayOne().nth(position - 1);
    const legs = () => trip(seededPage).locator(".timeline-connection");
    await waitForQuiet(seededPage, seeded);
    const seededStops = (await scanStops(seededPage)).filter((stop) => stop.day === 1);
    const seededSaved = seededStops.filter(isConfirmed).length;
    check(
      seededStops.length === SEEDED_STOPS.length && seededSaved === SEEDED_STOPS.length,
      `Day 1 of five stops: every stop's place is saved (${seededSaved}/${seededStops.length})`,
    );
    await trip(seededPage).getByRole("tab").nth(0).click();
    await settle(seededPage, 600);
    check(
      day.operations.includes("verify"),
      `the day is verified once its places are saved (${day.operations.join(", ")})`,
    );
    const legLabels = await trip(seededPage).locator(".timeline-connection__label").allInnerTexts();
    check(
      legLabels.length === SEEDED_STOPS.length - 1 &&
        legLabels.every((text) => /(Walk|Public transport|Drive) · \d+\s*(min|h)/.test(text)),
      `the four legs show their mode and time (${legLabels.join(" | ")})`,
    );
    check(
      (await legs().filter({ hasText: "estimate" }).count()) === SEEDED_STOPS.length - 1,
      "the legs read as estimates, never as checked",
    );
    check(
      !legLabels.some((text) => text.includes(`· ${PLANNER_WALK_MIN} min`)),
      `no leg keeps the planner's ${PLANNER_WALK_MIN}-minute estimate`,
    );

    // The edit: stop 3 moves earlier, which the server checks as a swap (routes included). That request is
    // held; a time edit of stop 1 starts while it is in flight, and the held answer arrives before the edit.
    let releaseVerify = () => {};
    seeded.holdVerify = new Promise((done) => (releaseVerify = done));
    await stopRow(3)
      .getByRole("button", { name: /^Actions for / })
      .click();
    await seededPage.getByRole("menuitem", { name: "Move earlier", exact: true }).click();
    check(
      await waitUntil(async () => seeded.holdSeen),
      "a move is in flight when the time edit starts",
    );
    // While a checked edit is pending the timeline is locked, so a second edit waits for the answer.
    check(
      await waitUntil(async () => stopRow(1).locator(".timeline-stop__time").isDisabled()),
      "the timeline is locked while a checked move is in flight",
    );
    releaseVerify();
    await settle(seededPage, 1200);
    check(
      !(await trip(seededPage).locator(".timeline-status--error").count()),
      "the held move shows no error once its answer arrives",
    );
    check(
      (await legs().count()) === SEEDED_STOPS.length - 1,
      `the day's legs are still shown after the move (${await legs().count()})`,
    );

    // A timing notice: stop 3 starts 5 minutes after stop 2 ends, which is not enough for its leg. The notice
    // sits on stop 3 only; no other stop of the day shows it.
    await stopRow(3).locator(".timeline-stop__time").click();
    await trip(seededPage)
      .getByLabel(/^Start/)
      .first()
      .fill("12:35");
    await trip(seededPage).getByLabel(/^End/).first().fill("13:35");
    await trip(seededPage).getByRole("button", { name: "Change time", exact: true }).click();
    await settle(seededPage, 1000);
    // Each stop's notices. The mock's own Day 1 flight can overlap a stop, which shows that stop an
    // "Overlaps" notice of its own; only the timing notice is counted here.
    const noticeRows = await dayOne().evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll(".timeline-stop__conflicts li")].map((item) =>
          item.textContent.trim(),
        ),
      ),
    );
    const timingNotices = noticeRows.map(
      (notices) => notices.filter((text) => /needs at least/.test(text)).length,
    );
    summary.seededDay = { ...(summary.seededDay ?? {}), noticeRows };
    check(
      timingNotices.join(",") === "0,0,1,0,0",
      `the timing notice shows on its stop only (per stop: ${timingNotices.join(",")}; all notices: ${JSON.stringify(noticeRows)})`,
    );
    const noticeText = await stopRow(3).locator(".timeline-stop__conflicts").innerText();
    check(
      /needs at least \d+ minutes after the previous activity/.test(noticeText),
      `the notice says why (${noticeText.replace(/\s+/g, " ")})`,
    );

    // A priced stop: removing it takes its price off the estimate at once, with no server answer.
    const total = seededPage.locator(".trip__budget strong");
    const totalBefore = (await total.innerText()).trim();
    seeded.priceNextTime = true;
    await stopRow(5).locator(".timeline-stop__time").click();
    await trip(seededPage)
      .getByLabel(/^Start/)
      .first()
      .fill("19:05");
    await trip(seededPage).getByLabel(/^End/).first().fill("20:05");
    await trip(seededPage).getByRole("button", { name: "Change time", exact: true }).click();
    await settle(seededPage, 1000);
    const totalPriced = (await total.innerText()).trim();
    check(
      totalPriced !== totalBefore,
      `the priced stop raises the estimate (${totalBefore} → ${totalPriced})`,
    );
    await stopRow(5)
      .getByRole("button", { name: /^Actions for / })
      .click();
    await seededPage.getByRole("menuitem", { name: "Remove", exact: true }).click();
    await settle(seededPage, 400);
    const totalRemoved = (await total.innerText()).trim();
    check(
      totalRemoved === totalBefore,
      `removing the priced stop takes its price off the estimate at once (${totalRemoved}, was ${totalBefore})`,
    );
    check(
      !day.errors.length,
      `scenario 4: no console errors${day.errors.length ? `: ${day.errors.join(" | ")}` : ""}`,
    );
    summary.seededDay = {
      stops: seededStops,
      operations: day.operations,
      noticeRows,
      totals: { totalBefore, totalPriced, totalRemoved },
    };
    await seededPage.screenshot({ path: `${OUT}/04-seeded-day.png` });
    await day.context.close();

    // 5. With no map places (no stub, so every lookup answers 503), nothing is saved.
    const bare = await openTrip(browser, { width: 1440, height: 1000 });
    await settle(bare.page, 2500);
    const bareStops = await scanStops(bare.page);
    summary.noPlaces = {
      stops: bareStops,
      previewEditRequests: bare.previewRequests.length,
    };
    check(bare.previewRequests.length === 0, "no save is sent when the map finds no places");
    check(
      bareStops.every((stop) => !stop.tags.includes("Place not saved yet")),
      "no stop reads 'Place not saved yet' without places",
    );
    await bare.page.screenshot({ path: `${OUT}/03-timeline-no-places.png` });
    await bare.context.close();
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
