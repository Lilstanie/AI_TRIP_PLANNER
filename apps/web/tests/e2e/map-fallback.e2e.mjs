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
          if (index === 0) {
            item.placeId = "google-saved-kyoto-station";
            item.savedPlace = {
              name,
              address: `${name}, Kyoto, Japan`,
              location: fixturePlace(name).location,
            };
          } else delete item.placeId;
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

    if (/status of 50[23]/.test(message.text())) return;
    if (/net::ERR_FAILED|ERR_BLOCKED/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.route(/^https?:\/\//, (route) => {
    if (route.request().url().startsWith(LOCAL)) return route.continue();
    return route.abort();
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
    const mixed = [...edits].reverse().find((edit) => edit.response?.plan)?.response.plan;
    const mixedItems = mixed?.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? [];
    check(
      mixedItems.some(
        (s) => s.placeId === "google-saved-kyoto-station" && s.savedPlace?.name === "Kyoto Station",
      ),
      "Google-saved stop keeps its name and coordinates during outage",
    );
    check(
      mixedItems.some((s) => s.placeId?.startsWith("osm:")),
      "new OSM stops coexist with the Google-saved stop",
    );
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
      routed.length > 0 && routed.every((route) => ["osrm", "transitous"].includes(route.source)),
      "routes in the plan's answer come from OSRM or Transitous",
    );

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

    const plan = lastEdit?.response?.plan;
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

      const cycling = await page.request.post(`${BASE}/api/trip/preview-edit`, {
        headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
        data: {
          plan,
          baseVersion: plan.editVersion ?? 0,
          operation: { kind: "leg", id: stop.id, mode: "cycle" },
        },
      });
      const cyclingBody = await cycling.json();
      const cycleRoute = cyclingBody.routes?.find((r) => r.mode === "BICYCLE");
      check(
        cycling.status() === 200 && cycleRoute?.status === "ok" && cycleRoute.source === "osrm",
        "cycling leg uses the bicycle-capable OSRM path",
      );
      const cycleStop = cyclingBody.plan?.sections
        .find((s) => s.id === "itinerary")
        ?.proposal?.items.find((i) => i.id === stop.id);
      check(
        cycleStop?.arriveBy?.mode === "cycle",
        "cycling choice survives shared plan validation",
      );
      summary.cyclingLeg = cyclingBody;
      summary.transitLeg = body.routes;
      const route = (body.routes ?? []).find((r) => r.mode === "TRANSIT");
      check(
        transit.status() === 200 && route?.status === "ok" && route.source === "transitous",
        "a transit leg is answered by Transitous fixtures",
      );
      const after = body.plan?.sections
        .find((s) => s.id === "itinerary")
        ?.proposal?.items.find((i) => i.id === stop.id);
      check(after?.arriveBy?.mode === "transit", "the chosen transit time is kept on the stop");
    } else {
      check(false, "the plan has two saved stops on day 1 to check a transit leg");
    }

    await page.getByRole("region", { name: "Trip timeline" }).getByRole("tab").first().click();
    const stopButton = page.locator(".timeline-stop__head > button").nth(1);
    if (await stopButton.count()) await stopButton.click();
    await page.locator(".place-preview").first().waitFor();
    check(
      (await page.locator(".place-preview").first().innerText()).includes("OpenStreetMap"),
      "OSM place card shows its source",
    );
    check(
      (await page.locator(".place-preview__rating").count()) === 0,
      "OSM cards never invent ratings",
    );
    check(
      (await page.locator(".place-preview__credit").count()) > 0,
      "Commons photo credits are visible",
    );
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "place-card-desktop.png") });

    const detailLanguages = [];
    await page.route("**/api/places/details", async (route) => {
      const { language } = route.request().postDataJSON();
      detailLanguages.push(language);
      const response = await route.fetch();
      const json = await response.json();
      if (json.place?.id === "osm:way/2002")
        json.place.displayName.text = language === "zh" ? "东寺" : "To-ji Temple";
      await route.fulfill({ response, json });
    });
    await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
    await page
      .locator(".place-preview__body h3")
      .filter({ hasText: "东寺" })
      .first()
      .waitFor({ timeout: 15000 });
    check(detailLanguages.includes("zh"), "language switch refetches saved OSM details in Chinese");
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "place-card-chinese.png") });
    await page.getByRole("button", { name: "切换至 English" }).click();
    await page
      .locator(".place-preview__body h3")
      .filter({ hasText: "To-ji Temple" })
      .first()
      .waitFor({ timeout: 15000 });
    check(
      detailLanguages.includes("en"),
      "switching back restores English details rather than cached Chinese",
    );
    summary.detailLanguages = detailLanguages;

    await page
      .locator(".stop-place-card")
      .getByRole("button", { name: "Close place details" })
      .click();
    const cycleChoice = page.locator(".timeline-connection__mode").first();
    await cycleChoice.selectOption("cycle");
    await page
      .locator(".timeline-connection__label")
      .filter({ hasText: /Cycle.*OSRM/ })
      .first()
      .waitFor();
    check(
      (await cycleChoice.inputValue()) === "cycle",
      "desktop cycling choice is applied in the timeline",
    );
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "cycling-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    const phoneTrip = page.getByRole("tab", { name: /^Trip/ });
    if (await phoneTrip.count()) await phoneTrip.click();
    check(
      (await page.locator(".timeline-connection__mode").first().inputValue()) === "cycle",
      "phone keeps the cycling choice",
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
      "phone cycling controls do not overflow",
    );
    await page.locator(".timeline-connection__mode").first().scrollIntoViewIfNeeded();
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "cycling-phone.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Close your trip" }).click();
    await page.locator(".google-map[data-provider=osm] canvas").waitFor({ timeout: 30_000 });
    check(
      (await page.locator("trip-libre-marker").count()) >= 4,
      "MapLibre renders numbered stop markers",
    );
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "map-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    const mapTab = page.getByRole("tab", { name: /^Map/ });
    await mapTab.waitFor();
    await mapTab.click();
    await page.waitForFunction(
      () => document.getElementById("phone-tab-map")?.getAttribute("aria-selected") === "true",
    );
    await page.waitForTimeout(500);
    await page.locator(".google-map[data-provider=osm] canvas").waitFor();
    check(
      await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
      "phone has no horizontal overflow",
    );
    await page.screenshot({ animations: "disabled", path: resolve(OUT, "map-phone.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });

    const mapService =
      /googleapis|gstatic\.com\/maps|openfreemap|openstreetmap|photon\.komoot|nominatim|osrm|transitous|wikimedia|wikidata|routing\./;
    const mapCalls = external.filter((url) => mapService.test(url));
    check(mapCalls.length === 0, `no map, route or place service was called (${mapCalls.length})`);
    summary.externalBlocked = external;
    check(errors.length === 0, `no unexpected console or page errors (${errors.length})`);
    summary.errors = errors;
    if (!(await page.getByRole("region", { name: "Trip timeline" }).isVisible()))
      await page.getByRole("button", { name: "Open your trip" }).click();
    await page
      .getByRole("region", { name: "Trip timeline" })
      .screenshot({ path: resolve(OUT, "timeline-desktop.png") });

    await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
    let manualSearch;
    await page.route("**/api/places/search", async (route) => {
      const data = route.request().postDataJSON();
      if (data.text !== "manual-localized-place") return route.fallback();
      manualSearch = { ...data, dataMode: route.request().headers()["x-trip-data-mode"] };
      await route.fulfill({
        json: {
          places: [
            {
              ...fixturePlace("To-ji Temple"),
              displayName: { text: data.language === "zh" ? "东寺候选" : "To-ji candidate" },
            },
          ],
        },
      });
    });
    await page.locator(".timeline-stop__head").nth(1).getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "更换地点", exact: true }).click();
    await page.getByPlaceholder("搜索 Google 地图").fill("manual-localized-place");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.locator(".stop-editor__results").waitFor();
    check(
      manualSearch?.language === "zh" &&
        (await page.getByText("东寺候选", { exact: true }).count()) > 0,
      "manual replacement search keeps Chinese locale",
    );
    check(manualSearch?.dataMode === "mock", "manual replacement search preserves mock data mode");
    summary.manualSearch = manualSearch;
    await page.screenshot({ path: resolve(OUT, "manual-search-chinese.png") });
    check(errors.length === 0, `no console errors after manual search (${errors.length})`);
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
