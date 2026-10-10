import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  openMockWorkspace,
  planSuggestedTrip,
  placeFor,
  settle,
  sleep,
  waitUntil,
  waitForQuiet,
} from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/auto-save-places", LABEL);
mkdirSync(OUT, { recursive: true });

const STOP_NAMES = [
  "Sydney Opera House",
  "Royal Botanic Garden Sydney",
  "Circular Quay",
  "Art Gallery of New South Wales",
];

const NOT_FOUND = new Set(["Circular Quay"]);
const FLAKY = new Set(["Art Gallery of New South Wales"]);

const PICK = "Taronga Zoo";
const REPLACE = "Manly Beach";

const UNCONFIRMED = "Not found on the map";
const RETRYABLE = "Place lookup failed — retry from the map";

const SEEDED_STOPS = [
  { name: "Sydney Opera House", start: "09:00", end: "10:00" },
  { name: "Royal Botanic Garden Sydney", start: "11:30", end: "12:30" },
  { name: "Bondi Beach", start: "14:00", end: "15:00" },
  { name: "The Rocks", start: "16:30", end: "17:30" },
  { name: "Darling Harbour", start: "19:00", end: "20:00" },
];
const PLANNER_WALK_MIN = 37;

const PRICE = 40;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

function newStub() {
  return {
    searches: [],
    saves: [],
    rejected: [],
    inFlight: 0,
    maxInFlight: 0,
    releaseFlaky: false,

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

  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    if (["verify", "swap"].includes(body.operation.kind) && stub.holdVerify) {
      stub.holdSeen = true;
      await stub.holdVerify;
    }
    if (body.operation.kind === "time" && stub.priceNextTime) {
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

  const operations = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/trip/preview-edit")) return;
    previewRequests.push(request.url());
    operations.push(request.postDataJSON().operation.kind);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;

    if (/status of 50[23]/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  if (stub) {
    await installStubs(page, stub);
    await installStopNames(page, { seeded });
  }
  await openMockWorkspace(page, BASE);
  check(
    (await page.getByRole("button", { name: /^Mock data/ }).count()) === 1,
    `${width}px: planning with mock data`,
  );
  await planSuggestedTrip(page);
  return { context, page, errors, previewRequests, operations };
}

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

    const flaky = retryable[0];
    summary.retryable = flaky ?? null;
    if (flaky) {
      check(
        !savedNames.includes(flaky.name) && !stub.saves.some((save) => save.stop === flaky.name),
        "a stop whose lookup failed for a retryable reason is not saved",
      );
      stub.releaseFlaky = true;

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

    await stopRow(3).locator(".timeline-stop__time").click();
    await trip(seededPage)
      .getByLabel(/^Start/)
      .first()
      .fill("12:35");
    await trip(seededPage).getByLabel(/^End/).first().fill("13:35");
    await trip(seededPage).getByRole("button", { name: "Change time", exact: true }).click();
    await settle(seededPage, 1000);

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
