import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-map", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-05T00:00:00Z";
const makeTrip = ({ id, destination, stops }) => {
  const conversationId = `conversation:${id}`;
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates: ["2030-11-14", "2030-11-16"],
    groupSize: 2,
    budgetTotal: 4500,
  };
  const items = stops.map((stop, index) => ({
    id: `${id}-stop-${index + 1}`,
    kind: "activity",
    day: stop.day,
    detail: stop.detail,
    ...(stop.location ? { location: stop.location } : {}),
    estCost: 50,
    startTime: stop.start,
    endTime: stop.end,
  }));
  const snapshot = {
    version: 3,
    id,
    savedAt,
    draft: {
      destination,
      origin: "",
      start: "2030-11-14",
      end: "2030-11-16",
      groupSize: "2",
      budgetTotal: "4500",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [{ role: "user", text: `Plan ${destination} marker` }],
    input: "",
    plan: {
      tripId: id,
      brief,
      round: 1,
      budgetTotal: 4500,
      estTotal: 150,
      overrunPct: -90,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: `${destination} stops`,
          estCost: 150,
          proposal: {
            agent: "itinerary",
            summary: `${destination} stops`,
            items,
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    },
  };
  return {
    trip: {
      id: `trip:${id}`,
      title: `Trip to ${destination}`,
      updatedAt: savedAt,
      conversationIds: [conversationId],
      snapshot,
    },
    conversation: {
      id: conversationId,
      title: `${destination} chat`,
      renamed: true,
      updatedAt: savedAt,
      tripId: `trip:${id}`,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
  };
};
const sydney = makeTrip({
  id: "sydney",
  destination: "Sydney",
  stops: [
    { day: 1, detail: "Opera House", location: "Sydney Opera House", start: "09:00", end: "10:30" },
    { day: 1, detail: "Bondi", location: "Bondi Beach", start: "11:30", end: "13:00" },
    { day: 2, detail: "Free time", start: "09:00", end: "10:00" },
  ],
});
const nowhere = makeTrip({
  id: "zzzland",
  destination: "Zzzland",
  stops: [{ day: 1, detail: "Wander", location: "Zzz Square", start: "09:00", end: "10:00" }],
});
const entries = [sydney, nowhere];
const catalog = {
  version: 4,
  activeConversationId: sydney.conversation.id,
  activeTripId: sydney.trip.id,
  trips: entries.map(({ trip }) => trip),
  conversations: entries.map(({ conversation }) => conversation),
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settingsFor = (language) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "light",
  language,
  displayCurrency: "AUD",
  updatedAt: savedAt,
});
const placeFor = (text) => {
  const hash = [...text].reduce((n, c) => n + c.charCodeAt(0), 0);
  return {
    id: `fixture-${hash}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW, Australia`,
    location: { latitude: -33.85 - (hash % 100) / 1000, longitude: 151.2 + (hash % 70) / 1000 },
  };
};

let current;
let currentErrors = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));

async function open({ language = "en", width = 1440, height = 1000, phone = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  });
  await context.addInitScript(
    ({ catalog, settings }) => {
      if (localStorage.getItem("seeded")) return;
      localStorage.setItem("seeded", "1");
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
    },
    { catalog, settings: settingsFor(language) },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    await route.fulfill({ json: { places: /zzz/i.test(text) ? [] : [placeFor(text)] } });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    await route.fulfill({
      json: {
        place: {
          id: placeId,
          displayName: { text: placeId },
          location: { latitude: -33.86, longitude: 151.21 },
        },
      },
    });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  current = page;
  currentErrors = errors;
  return { context, page, errors };
}

const home = (page) => page.locator(".trip-home");
const mapRegion = (page, name = "Trip map") =>
  home(page).getByRole("region", { name, exact: true }).first();
const card = (page, name) =>
  page.locator(".trip-cards, .phone-mine").getByRole("button", { name }).first();
const markerLabels = (scope) =>
  scope
    .locator(".trip-map-marker")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim()).sort(),
    );
const controlNames = (scope) =>
  scope
    .locator("button")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent.trim()).sort(),
    );
const settled = async (scope, count) => {
  for (let waited = 0; waited < 15000; waited += 250) {
    if ((await scope.locator(".trip-map-marker").count()) >= count) return true;
    await scope.page().waitForTimeout(250);
  }
  return false;
};
const box = (locator) => locator.evaluate((node) => node.getBoundingClientRect().toJSON());

try {
  const { context, page, errors } = await open({});
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page.waitForTimeout(800);
  const before = await stored(page);
  await card(page, /^Trip to Sydney/).click();
  await home(page).waitFor();
  check(
    (await home(page).getByRole("region", { name: "Trip map", exact: true }).count()) > 0,
    "the Trip home shows a region named Trip map",
  );
  const located = await settled(mapRegion(page), 2);
  const homeMarkers = await markerLabels(mapRegion(page));
  check(
    located && homeMarkers.length === 2,
    "the map marks the two stops that have a place and skips the one without",
    homeMarkers,
  );
  const homeControls = await controlNames(mapRegion(page));
  const main = await box(page.locator(".trip-home__main"));
  const aside = await box(page.locator(".trip-home__aside"));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(
    aside.left >= main.right - 1 &&
      Math.abs(aside.top - main.top) < 2 &&
      aside.width > 400 &&
      aside.height > 600 &&
      overflow <= 0,
    "on desktop the map sits beside the page content in a second column without overflow",
    { main, aside, overflow },
  );
  const after = await stored(page);
  check(
    after.activeConversationId === before.activeConversationId &&
      after.activeTripId === before.activeTripId,
    "opening the Trip home leaves the active conversation and trip alone",
  );
  await page.screenshot({ path: `${OUT}/home-1440-en.png` });

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: "Trip to Sydney" })
    .first()
    .locator(".history-item__open")
    .click();
  const workspaceMap = page
    .locator(".workspace-panel--map")
    .getByRole("region", {
      name: "Trip map",
      exact: true,
    })
    .first();
  await workspaceMap.waitFor();
  await settled(workspaceMap, 2);
  const workspaceMarkers = await markerLabels(workspaceMap);
  check(
    JSON.stringify(workspaceMarkers) === JSON.stringify(homeMarkers),
    "the markers match the stops the workspace map shows",
    { home: homeMarkers, workspace: workspaceMarkers },
  );
  const workspaceControls = await controlNames(workspaceMap);
  check(
    JSON.stringify(workspaceControls) === JSON.stringify(homeControls),
    "the home map has the same controls as the workspace map and no others",
    { home: homeControls, workspace: workspaceControls },
  );

  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await card(page, /^Trip to Zzzland/).click();
  await home(page).waitFor();
  await page.waitForTimeout(1500);
  check(
    (await mapRegion(page).count()) > 0 &&
      (await page.locator(".trip-home .trip-map-marker").count()) === 0 &&
      (await home(page).getByRole("status").count()) === 1,
    "a trip whose places cannot be found keeps the named map region with the existing notice and no markers",
    await home(page).getByRole("status").allInnerTexts(),
  );
  await page.screenshot({ path: `${OUT}/home-unlocated-1440-en.png` });

  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  const narrowMain = await box(page.locator(".trip-home__main"));
  const narrowAside = await box(page.locator(".trip-home__aside"));
  check(
    narrowAside.left >= narrowMain.right - 1 &&
      (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "at 900 wide the two columns still fit without overflow",
    { narrowMain, narrowAside },
  );
  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForTimeout(400);
  const stackMain = await box(page.locator(".trip-home__main"));
  const stackAside = await box(page.locator(".trip-home__aside"));
  check(
    stackAside.top >= stackMain.bottom - 1 &&
      stackAside.width > 600 &&
      (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "at 760 wide the map stacks below the page content without overflow",
    { stackMain, stackAside },
  );
  await page.setViewportSize({ width: 1440, height: 1000 });

  await home(page)
    .getByRole("button", { name: /^Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  check(
    (await home(page).count()) === 0 &&
      (await page.getByRole("region", { name: "Trip map" }).count()) === 0,
    "a trip deleted while its home is open removes the map with the page",
  );
  check(errors.length === 0, "English desktop run has no page or console errors", errors);
  await context.close();

  const zh = await open({ language: "zh" });
  await zh.page.locator(".sidebar-nav").getByRole("button", { name: /^行程/ }).click();
  await card(zh.page, /Sydney/).click();
  await home(zh.page).waitFor();
  check(
    (await mapRegion(zh.page, "行程地图").count()) > 0,
    "the Chinese interface names the map region 行程地图",
  );
  await settled(mapRegion(zh.page, "行程地图"), 2);
  await zh.page.screenshot({ path: `${OUT}/home-1440-zh.png` });
  check(zh.errors.length === 0, "Chinese run has no page or console errors", zh.errors);
  await zh.context.close();

  for (const [width, height] of [
    [390, 844],
    [360, 740],
  ]) {
    const phone = await open({ phone: true, width, height });
    const p = phone.page;
    await p.getByRole("tab", { name: /^Mine/ }).click();
    await card(p, /^Trip to Sydney/).click();
    await home(p).waitFor();
    await settled(mapRegion(p), 2);
    const head = await box(p.locator(".trip-home__head"));
    const tags = await box(p.locator(".trip-home .fact-chips"));
    const map = await box(mapRegion(p));
    const wide = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      shell: document.querySelector(".workspace-shell--trips").scrollWidth - innerWidth,
    }));
    check(
      head.top < tags.top &&
        tags.bottom <= map.top + 1 &&
        map.width >= width - 40 &&
        wide.overflow <= 0 &&
        wide.shell <= 0,
      `${width}: the phone Trip home is one column in the order header, tags, map without overflow`,
      { head: head.top, tags: tags.top, map: map.top, mapWidth: map.width, wide },
    );
    check(
      (await markerLabels(mapRegion(p))).length === 2 &&
        (await p.locator(".workspace-topbar").count()) === 0,
      `${width}: the phone map marks the same two stops and no empty top bar is left over`,
    );
    await p.screenshot({ path: `${OUT}/home-${width}-en.png`, fullPage: true });
    await home(p).getByRole("button", { name: "Back to trips" }).click();
    await p.locator(".phone-mine").waitFor();
    check(
      (await p.getByRole("tab", { name: /^Mine/ }).getAttribute("aria-selected")) === "true" &&
        (await home(p).count()) === 0,
      `${width}: back returns to the Mine tab`,
    );
    check(
      phone.errors.length === 0,
      `${width}: phone run has no page or console errors`,
      phone.errors,
    );
    await phone.context.close();
  }
} catch (error) {
  check(false, "journey completes", { error: String(error), pageErrors: currentErrors });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ results, fixture: "local catalog; place lookups stubbed" }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
