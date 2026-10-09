// End-to-end check of the free map fallback when Google is simulated unavailable (ticket #273).
//
// Run with the server's Google outage switched on, in mock data mode:
//
//   DATA_MODE=mock MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e map-fallback
//
// What is real here: the server. Saved stops are looked up, routed and timed by the web map provider,
// which tries Google first, sees the simulated outage and answers from OpenStreetMap's fixtures (OSRM
// for walking and driving, an offline time zone). Nothing leaves the machine: every request to another
// origin is aborted and listed in the artifact, and the OSRM client answers from fixtures in mock mode.
//
// What is stubbed: the browser's place search only, because OpenStreetMap search is ticket #272 and
// returns nothing until it lands. The stub answers with the same fixture places the server knows.
//
// Checks: stops are saved to OpenStreetMap places, legs show a walk or drive time labelled OSRM and no
// Google label, a fallback route from the traveller's position comes back labelled OSRM, a fixture
// place's details come from its OSM id, and a transit leg no provider can route is unavailable and
// keeps no time. The artifact is output/playwright/map-fallback/<LABEL>/summary.json with screenshots.
//
//   DATA_MODE=mock MOCK_GOOGLE_MAPS=unavailable LABEL=after node apps/web/tests/e2e/map-fallback.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/map-fallback", LABEL);
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// The fixture places the server knows (lib/map-provider/mock-osm.ts), by the name a stop carries.
const FIXTURE_PLACES = {
  "Kyoto Station": { id: "osm:node/2001", latitude: 34.9858, longitude: 135.7588 },
  "To-ji Temple": { id: "osm:way/2002", latitude: 34.9805, longitude: 135.7478 },
  "Kiyomizu-dera": { id: "osm:relation/2003", latitude: 34.9949, longitude: 135.785 },
  "Nishiki Market": { id: "osm:node/2004", latitude: 35.005, longitude: 135.7649 },
};
const STOP_NAMES = Object.keys(FIXTURE_PLACES);

const LOCAL = new URL(BASE).origin;

function fixturePlace(name) {
  const place = FIXTURE_PLACES[name];
  return {
    id: place.id,
    displayName: { text: name },
    formattedAddress: `${name}, Kyoto, Japan`,
    location: { latitude: place.latitude, longitude: place.longitude },
    source: "osm",
  };
}

/** Gives the plan's activities Kyoto names, in plan order, without places, as a plan from chat would. */
async function installStopNames(page) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        // The mock plan has one stop on each of several days; the scenario needs its stops on one day, so
        // the first four activities move to Day 1 at times with room for each leg and its buffer.
        const activities = section.proposal.items.filter(
          (item) => item.kind === "activity" && item.day !== undefined,
        );
        const kept = activities.slice(0, STOP_NAMES.length);
        const slots = [
          ["09:00", "10:00"],
          ["12:00", "13:00"],
          ["15:00", "16:00"],
          ["18:00", "19:00"],
        ];
        section.proposal.items = section.proposal.items.filter(
          (item) => item.kind !== "activity" || item.day === undefined || kept.includes(item),
        );
        kept.forEach((item, index) => {
          const name = STOP_NAMES[index];
          item.day = 1;
          item.startTime = slots[index][0];
          item.endTime = slots[index][1];
          item.location = name;
          item.detail = name;
          delete item.placeId;
          delete item.arriveBy;
        });
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

async function openTrip(browser, { width, height, edits, searches, external }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith(LOCAL) || url.startsWith("data:") || url.startsWith("blob:")) return;
    external.push(url);
  });
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/trip/preview-edit")) return;
    edits.push({ body: request.postDataJSON() });
  });
  page.on("response", async (response) => {
    if (!response.url().endsWith("/api/trip/preview-edit")) return;
    const pending = edits.find((edit) => !edit.response && edit.body);
    if (pending) pending.response = await response.json().catch(() => undefined);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Lookups answered 502/503 are the expected state without a map key, and requests to the outside
    // world are aborted on purpose; nothing else may be logged as an error.
    if (/status of 50[23]/.test(message.text())) return;
    if (/net::ERR_FAILED|ERR_BLOCKED/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  // Every request to another origin is aborted here and listed in `external`, so no real service answers.
  await page.route(/^https?:\/\//, (route) => {
    if (route.request().url().startsWith(LOCAL)) return route.continue();
    return route.abort();
  });
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    searches.push(text);
    const place = FIXTURE_PLACES[text];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ places: place ? [fixturePlace(text)] : [] }),
    });
  });
  await installStopNames(page);
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
  await page.getByRole("region", { name: "Trip timeline" }).waitFor({ timeout: 30_000 });
  return { context, page, errors };
}

/** Every leg label the timeline shows, across the days. */
async function legLabels(page) {
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  const days = timeline.getByRole("tab");
  const labels = [];
  for (let day = 0; day < (await days.count()); day += 1) {
    await days.nth(day).click();
    await settle(page, 300);
    labels.push(...(await timeline.locator(".timeline-connection__label").allInnerTexts()));
  }
  return labels.map((label) => label.replace(/\s+/g, " ").trim());
}

async function main() {
  if (process.env.MOCK_GOOGLE_MAPS !== "unavailable") {
    console.error(
      "map-fallback needs MOCK_GOOGLE_MAPS=unavailable on the server (see the header).",
    );
    process.exit(2);
  }
  const browser = await chromium.launch({ channel: process.env.CHANNEL });
  const edits = [];
  const searches = [];
  const external = [];
  const summary = { label: LABEL, checks: [], labels: [], saves: [], external, searches };
  const { context, page, errors } = await openTrip(browser, {
    width: 1440,
    height: 1000,
    edits,
    searches,
    external,
  });
  try {
    // The stops save and the day's legs are routed; poll until the labels appear.
    let labels = [];
    for (let round = 0; round < 60; round += 1) {
      labels = await legLabels(page);
      if (labels.some((label) => /OSRM/.test(label))) break;
      await sleep(500);
    }
    await settle(page, 500);
    summary.labels = labels;
    const osrmLegs = labels.filter((label) => /OSRM/.test(label));
    check(osrmLegs.length > 0, "legs show a walk or drive time labelled OSRM");
    check(
      osrmLegs.every((label) => /·\s*\d+\s*min/.test(label)),
      "every OSRM leg shows its duration in minutes",
    );
    check(
      !labels.some((label) => /Google/.test(label)),
      "no leg is labelled Google while Google is simulated unavailable",
    );

    const saves = edits
      .filter((edit) => edit.body.operation.kind === "place" && edit.response?.plan)
      .map((edit) => edit.body.operation.placeId);
    summary.saves = saves;
    check(saves.length > 0, "stops are saved to OpenStreetMap places");
    check(
      saves.every((id) => id?.startsWith("osm:")),
      "every saved stop carries an OSM id, none a Google id",
    );

    const lastEdit = [...edits].reverse().find((edit) => edit.response?.plan);
    const routed = edits
      .flatMap((edit) => edit.response?.routes ?? [])
      .filter((route) => route.status === "ok");
    check(
      routed.length > 0 && routed.every((route) => route.source === "osrm"),
      "routes in the plan's answer come from OSRM",
    );

    // A fallback route from the traveller's position: the same server path the map's button uses.
    const from = await page.request.post(`${BASE}/api/routes/from-location`, {
      headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
      data: { latitude: 34.9858, longitude: 135.7588, placeId: "osm:way/2002", mode: "WALK" },
    });
    const fromBody = await from.json();
    summary.fromLocation = fromBody;
    check(
      from.status() === 200 && fromBody.status === "ok" && fromBody.source === "osrm",
      "route from my location returns an OSRM walk",
    );
    check(
      typeof fromBody.durationMin === "number" && fromBody.durationMin >= 1,
      "the walk from my location has a whole-minute duration",
    );

    // A place's details come from its OSM id, with no rating invented for it.
    const details = await page.request.post(`${BASE}/api/places/details`, {
      headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
      data: { placeId: "osm:node/2001" },
    });
    const detailBody = await details.json();
    summary.details = detailBody;
    check(
      details.status() === 200 &&
        detailBody.place?.displayName?.text === "Kyoto Station" &&
        detailBody.place?.rating === undefined,
      "details of an OSM place come from OpenStreetMap, without a rating",
    );

    // A transit leg no provider can route: the leg is unavailable, with a notice, and keeps no time.
    const plan = lastEdit?.body.plan;
    const items = plan?.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? [];
    const dayItems = items.filter((i) => i.kind === "activity" && i.day === 1 && i.placeId);
    if (dayItems.length >= 2) {
      const stop = dayItems[1];
      const transit = await page.request.post(`${BASE}/api/trip/preview-edit`, {
        headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
        data: {
          plan,
          baseVersion: plan.editVersion ?? 0,
          operation: { kind: "leg", id: stop.id, mode: "transit" },
        },
      });
      const body = await transit.json();
      summary.transitLeg = body.routes;
      const route = (body.routes ?? []).find((r) => r.mode === "TRANSIT");
      check(
        transit.status() === 200 && route?.status === "unavailable" && !!route.notice,
        "a transit leg no provider can route is unavailable, with a notice",
      );
      const after = body.plan?.sections
        .find((s) => s.id === "itinerary")
        ?.proposal?.items.find((i) => i.id === stop.id);
      check(
        after?.arriveBy?.mode !== "transit",
        "the unroutable transit leg is not given a transit time",
      );
    } else {
      check(false, "the plan has two saved stops on day 1 to check a transit leg");
    }

    // Fonts and other static assets may be requested from outside; no map, route or place service may be.
    const mapService =
      /googleapis|gstatic\.com\/maps|openfreemap|openstreetmap|photon\.komoot|nominatim|osrm|transitous|wikimedia|wikidata|routing\./;
    const mapCalls = external.filter((url) => mapService.test(url));
    check(mapCalls.length === 0, `no map, route or place service was called (${mapCalls.length})`);
    summary.externalBlocked = external;
    check(errors.length === 0, `no unexpected console or page errors (${errors.length})`);
    summary.errors = errors;
    await page
      .getByRole("region", { name: "Trip timeline" })
      .screenshot({ path: resolve(OUT, "timeline-desktop.png") });
  } finally {
    summary.failures = failures;
    writeFileSync(resolve(OUT, "summary.json"), JSON.stringify(summary, null, 2));
    await context.close();
    await browser.close();
  }
  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed. Artifact: ${OUT}`);
    process.exit(1);
  }
  console.log(`\nAll checks passed. Artifact: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
