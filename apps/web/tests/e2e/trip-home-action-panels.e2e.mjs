import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { installGoogleRendererFixture } from "./google-renderer-fixture.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-action-panels", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-29T00:00:00Z";
const tripId = "sydney-action-panels";
const dates = ["2030-11-14", "2030-11-16"];
const brief = {
  tripId,
  userId: "local",
  destination: "Sydney",
  origin: "Melbourne",
  dates,
  groupSize: 2,
  budgetTotal: 4500,
};
const items = [
  {
    id: "opera",
    kind: "activity",
    day: 1,
    startTime: "09:00",
    endTime: "10:30",
    location: "Sydney Opera House",
    detail: "Guided tour",
    booked: true,
    placeId: "fixture-opera",
    savedPlace: {
      name: "Sydney Opera House",
      location: { latitude: -33.8568, longitude: 151.2153 },
    },
  },
  {
    id: "harbour",
    kind: "activity",
    day: 2,
    startTime: "10:00",
    endTime: "11:00",
    location: "Circular Quay",
    detail: "Harbour walk",
    placeId: "fixture-harbour",
    savedPlace: {
      name: "Circular Quay",
      location: { latitude: -33.861, longitude: 151.2108 },
    },
  },
  {
    id: "bakery",
    kind: "activity",
    location: "Surry Hills bakery",
    detail: "Breakfast idea",
  },
];
const plan = {
  tripId,
  brief,
  round: 1,
  budgetTotal: 4500,
  estTotal: 1200,
  overrunPct: -73,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Sydney visit",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Sydney visit",
        items,
        assumptions: [],
        conflictsWith: [],
      },
    },
    {
      id: "transport",
      label: "Transport",
      status: "draft",
      summary: "Return flight",
      estCost: 500,
      proposal: {
        agent: "transport",
        summary: "Return flight",
        items: [
          {
            id: "flight-item",
            selectionId: "flight-selection",
            kind: "flight",
            day: 1,
            location: "MEL to SYD",
            detail: "Selected flight proposal",
          },
        ],
        flights: [
          {
            id: "flight-selection",
            from: "MEL",
            to: "SYD",
            depart: dates[0],
            day: 1,
            passengers: 2,
            selectedId: "qantas",
            candidates: [{ id: "qantas", carrier: "Qantas", price: 500, stops: 0 }],
          },
        ],
        assumptions: [],
        conflictsWith: [],
      },
    },
    {
      id: "accommodation",
      label: "Accommodation",
      status: "draft",
      summary: "Two nights",
      estCost: 400,
      proposal: {
        agent: "accommodation",
        summary: "Two nights",
        items: [],
        stays: [
          {
            id: "stay-selection",
            city: "Sydney",
            checkIn: dates[0],
            checkOut: dates[1],
            day: 1,
            nights: 2,
            rooms: 1,
            selectedId: "harbour-hotel",
            candidates: [
              {
                id: "harbour-hotel",
                name: "Harbour Hotel",
                area: "Circular Quay",
                pricePerNight: 200,
                rating: 9,
              },
            ],
          },
        ],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};
const snapshot = {
  version: 3,
  id: "trip",
  savedAt,
  draft: {
    destination: "Sydney",
    origin: "Melbourne",
    start: dates[0],
    end: dates[1],
    groupSize: "2",
    budgetTotal: "4500",
    preferences: ["Quiet mornings"],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [{ role: "user", text: "Family plan marker" }],
  input: "",
  plan,
};
const conversation = {
  id: "conversation:sydney-action-panels",
  title: "Family plan",
  renamed: true,
  updatedAt: savedAt,
  tripId: `trip:${tripId}`,
  messages: snapshot.messages,
  input: "",
  snapshot,
};
const catalog = {
  version: 4,
  activeConversationId: conversation.id,
  activeTripId: `trip:${tripId}`,
  trips: [
    {
      id: `trip:${tripId}`,
      title: "Sydney long weekend",
      renamed: true,
      updatedAt: savedAt,
      conversationIds: [conversation.id],
      snapshot,
    },
  ],
  conversations: [conversation],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};

let browser;
let current;
let currentErrors = [];
let currentRequests = [];

async function open(language, viewport, phone = false, displayCurrency = "AUD", createContext) {
  const options = {
    viewport,
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  };
  const context = await (createContext ? createContext(options) : browser.newContext(options));
  await context.addInitScript(
    ({ catalog, language, displayCurrency }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
          memberships: [],
          assistant: { style: "neutral", memory: true },
          dataMode: "mock",
          appearance: "light",
          language,
          displayCurrency,
          updatedAt: "2026-10-29T00:00:00Z",
        }),
      );
    },
    { catalog, language, displayCurrency },
  );
  await context.addInitScript(installGoogleRendererFixture, { failure: "none" });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("response", (response) => {
    const url = response.url();
    if (/\/api\/(?:data-mode|places\/)/.test(url))
      requests.push({ status: response.status(), url });
  });
  const origin = new URL(BASE).origin;
  await page.route(/^https?:\/\//, (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    return route.abort();
  });
  await page.route("**/maps/api/js?*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.tripGoogleMapsReady();",
    }),
  );
  await page.route("**/api/data-mode", (route) =>
    route.fulfill({
      json: {
        configured: "mock",
        providers: { maps: true, hotelsAndFlights: false, webMapsProvider: "google" },
      },
    }),
  );
  await page.route("**/api/places/search", (route) =>
    route.fulfill({
      json: {
        places: items.map((item) => ({
          id: item.placeId,
          displayName: { text: item.savedPlace?.name },
          location: item.savedPlace?.location,
          source: "google",
        })),
      },
    }),
  );
  await page.route("**/api/places/details", (route) => {
    const id = route.request().postDataJSON().placeId;
    const item = items.find((entry) => entry.placeId === id);
    return route.fulfill({
      json: {
        place: item
          ? {
              id,
              displayName: { text: item.savedPlace?.name },
              location: item.savedPlace?.location,
              source: "google",
            }
          : null,
      },
    });
  });
  await page.route("**/api/trip/preview-edit", (route) =>
    route.fulfill({ status: 503, json: { error: "Action-panel fixture skips route durations" } }),
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  current = page;
  currentErrors = errors;
  currentRequests = requests;
  return { context, page, errors };
}

const home = (page) => page.locator(".trip-home");
const actions = (page) => home(page).getByRole("list", { name: /^(Trip actions|行程操作)$/ });
const action = (page, name) => actions(page).getByRole("button", { name });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const panelSwitcher = (page) => page.getByRole("tablist", { name: /^(Trip actions|行程操作)$/ });
const panelTab = (page, name) => panelSwitcher(page).getByRole("tab", { name });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const MAP_IDENTITY = "tp155-stable-map";

async function markMap(page) {
  const host = page.locator(
    ".trip-home__map .trip-map-canvas:not(.trip-map-canvas--empty) .google-map[data-provider=google]",
  );
  const renderer = host.locator(".google-map__renderer");
  await host.waitFor({ state: "attached" });
  await renderer.waitFor({ state: "attached" });
  return page.evaluate((identity) => {
    const map = document.querySelector(".trip-home__map");
    const canvas = map?.querySelector(".trip-map-canvas");
    const host = canvas?.querySelector(".google-map[data-provider=google]");
    const renderer = host?.querySelector(".google-map__renderer");
    const fixture = window.__googleRendererFixture;
    const instance = fixture?.maps.find((item) => item.element === renderer && !item.destroyed);
    if (
      !(map instanceof HTMLElement) ||
      !(canvas instanceof HTMLElement) ||
      !(host instanceof HTMLElement) ||
      !(renderer instanceof HTMLElement) ||
      !instance
    )
      return null;
    map.dataset.rendererIdentity = identity;
    canvas.dataset.rendererIdentity = identity;
    host.dataset.rendererIdentity = identity;
    renderer.dataset.rendererIdentity = identity;
    instance.rendererIdentity = identity;
    return {
      map: map.dataset.rendererIdentity,
      canvas: canvas.dataset.rendererIdentity,
      host: host.dataset.rendererIdentity,
      renderer: renderer.dataset.rendererIdentity,
      instance: instance.rendererIdentity,
      index: fixture.maps.indexOf(instance),
      fixtureMaps: fixture.maps.length,
      liveMaps: fixture.maps.filter((item) => !item.destroyed).length,
      connected: fixture.maps.filter((item) => item.element.isConnected).length,
    };
  }, MAP_IDENTITY);
}

async function readMapIdentity(page) {
  return page.evaluate(() => {
    const map = document.querySelector(".trip-home__map");
    const canvas = map?.querySelector(".trip-map-canvas");
    const host = canvas?.querySelector(".google-map[data-provider=google]");
    const renderer = host?.querySelector(".google-map__renderer");
    const fixture = window.__googleRendererFixture;
    const instance = fixture?.maps.find((item) => item.element === renderer && !item.destroyed);
    return {
      markers: document.querySelectorAll('[data-renderer-identity="tp155-stable-map"]').length,
      map: map?.getAttribute("data-renderer-identity"),
      canvas: canvas?.getAttribute("data-renderer-identity"),
      host: host?.getAttribute("data-renderer-identity"),
      renderer: renderer?.getAttribute("data-renderer-identity"),
      instance: instance?.rendererIdentity,
      index: instance ? fixture.maps.indexOf(instance) : -1,
      fixtureMaps: fixture?.maps.length ?? 0,
      liveMaps: fixture?.maps.filter((item) => !item.destroyed).length ?? 0,
      connected: fixture?.maps.filter((item) => item.element.isConnected).length ?? 0,
      maps: document.querySelectorAll(".trip-home__map").length,
      day: map?.getAttribute("data-day"),
    };
  });
}

async function openHome(page, language = "en", width = 1440) {
  if (width <= 520) {
    await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
    await page.locator(".phone-mine .trip-card").first().click();
  } else if (width <= 1000) {
    await page.getByRole("button", { name: /^(Open navigation|打开导航)$/ }).click();
    await page.getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ }).click();
    await page.locator(".trip-cards .trip-card").first().click();
  } else {
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
      .click();
    await page.locator(".trip-cards .trip-card").first().click();
  }
  await home(page).waitFor();
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
  });

  const desktop = await open("en", { width: 1440, height: 1000 });
  const { page } = desktop;
  await openHome(page);

  await page.evaluate(() => {
    const main = document.querySelector(".trip-home__scroll");
    if (!(main instanceof HTMLElement)) return;
    let pad = document.getElementById("tp155-scroll-pad");
    if (!pad) {
      pad = document.createElement("div");
      pad.id = "tp155-scroll-pad";
      pad.style.height = "900px";
      pad.setAttribute("aria-hidden", "true");
      main.appendChild(pad);
    }
    main.scrollTop = 180;
  });
  const scrolled = await page.evaluate(
    () => document.querySelector(".trip-home__scroll")?.scrollTop ?? 0,
  );
  check(scrolled >= 160, "Trip home can scroll before opening a panel", scrolled);

  await action(page, /^Itinerary/).click();
  await dialog(page, "Itinerary").waitFor();
  await page.keyboard.press("Escape");
  await dialog(page, "Itinerary").waitFor({ state: "hidden" });
  const restoredScroll = await page.evaluate(
    () => document.querySelector(".trip-home__scroll")?.scrollTop ?? 0,
  );
  check(restoredScroll >= 160, "closing restores Trip home scroll", restoredScroll);
  await page.evaluate(() => document.getElementById("tp155-scroll-pad")?.remove());

  await home(page)
    .getByRole("list", { name: /^(Chats|聊天)$/ })
    .getByRole("button", { name: /Family plan/ })
    .click();
  await page.getByText("Family plan marker", { exact: true }).waitFor();
  check((await home(page).count()) === 0, "a linked Chat opens the normal conversation workspace");
  await openHome(page);

  await action(page, /^Itinerary/).click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  const opened = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface");
    return {
      expanded: surface?.classList.contains("is-expanded"),
      maps: document.querySelectorAll(".trip-home__map").length,
    };
  });
  check(
    opened?.expanded === true && opened.maps === 1,
    "an action opens beside the map with one map",
    opened,
  );
  const dayTwo = itinerary.getByRole("tab", { name: /^Day 2/ });
  await dayTwo.click();
  check(
    (await dayTwo.getAttribute("aria-selected")) === "true" &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2",
    "selecting an Itinerary day keeps the shared selected day",
  );
  const mapIdentity = await markMap(page);
  check(
    mapIdentity?.map === MAP_IDENTITY &&
      mapIdentity.canvas === MAP_IDENTITY &&
      mapIdentity.host === MAP_IDENTITY &&
      mapIdentity.renderer === MAP_IDENTITY &&
      mapIdentity.instance === MAP_IDENTITY &&
      mapIdentity.index >= 0 &&
      mapIdentity.liveMaps === 1 &&
      mapIdentity.connected === 1,
    "the active Google renderer receives a lifecycle identity before expansion",
    mapIdentity,
  );

  const switcher = panelSwitcher(page);
  await switcher.waitFor();
  check(
    (await switcher.getByRole("tab").count()) === 5,
    "the open panel exposes five Tab-reachable action entries",
    await switcher.getByRole("tab").allInnerTexts(),
  );
  await itinerary.getByRole("button", { name: "Change time, 10:00–11:00", exact: true }).click();
  const start = itinerary.locator("#stop-time-harbour").getByLabel("Start", { exact: true });
  await start.fill("10:30");
  await panelTab(page, /^Bookings/).click();
  const bookings = dialog(page, "Bookings");
  await bookings.waitFor();
  await panelTab(page, /^Bookings/).focus();
  await page.keyboard.press("ArrowRight");
  const keyboardPreferences = dialog(page, "Trip preferences");
  await keyboardPreferences.waitFor();
  check(
    (await panelTab(page, /^Trip preferences/).getAttribute("aria-selected")) === "true" &&
      (await keyboardPreferences.evaluate(
        (element) =>
          document.activeElement === element.querySelector('[role="tab"][aria-selected="true"]'),
      )),
    "Tab and arrow keys switch actions and retain focus in the action switcher",
  );
  await page.keyboard.press("ArrowLeft");
  await dialog(page, "Bookings").waitFor();
  check(
    (await dialog(page, "Itinerary").count()) === 0 &&
      (await bookings.getByRole("region", { name: "Flights", exact: true }).count()) === 1 &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2" &&
      (await home(page).getByRole("list", { name: "Chats", exact: true }).isVisible()),
    "an in-panel control switches actions without closing and keeps Chat and selected day",
  );
  await panelTab(page, /^Itinerary/).click();
  const restoredItinerary = dialog(page, "Itinerary");
  await restoredItinerary.waitFor();
  await restoredItinerary
    .getByRole("button", { name: "Change time, 10:00–11:00", exact: true })
    .click();
  const restoredStart = await restoredItinerary
    .locator("#stop-time-harbour")
    .getByLabel("Start", { exact: true })
    .inputValue();
  check(
    restoredStart === "10:30" &&
      (await restoredItinerary
        .getByRole("tab", { name: /^Day 2/ })
        .getAttribute("aria-selected")) === "true",
    "switching actions keeps an unsubmitted edit and selected day",
    restoredStart,
  );
  await panelTab(page, /^Bookings/).click();

  const expandedLayout = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface");
    const content = surface?.querySelector(".trip-home-action-content");
    const map = document.querySelector(".trip-home__map");
    if (!surface || !content || !map) return null;
    const surfaceBox = surface.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const mapBox = map.getBoundingClientRect();
    return {
      expanded: surface.classList.contains("is-expanded"),
      sideBySide:
        mapBox.left > contentBox.right - 8 &&
        Math.min(contentBox.bottom, mapBox.bottom) - Math.max(contentBox.top, mapBox.top) > 200,
      width: surfaceBox.width,
      mapWidth: mapBox.width,
    };
  });
  const expanded = { ...expandedLayout, ...(await readMapIdentity(page)) };
  check(
    expanded?.expanded &&
      expanded.sideBySide &&
      expanded.mapWidth > 200 &&
      expanded.maps === 1 &&
      expanded.map === MAP_IDENTITY &&
      expanded.canvas === MAP_IDENTITY &&
      expanded.host === MAP_IDENTITY &&
      expanded.renderer === MAP_IDENTITY &&
      expanded.instance === MAP_IDENTITY &&
      expanded.index === mapIdentity.index &&
      expanded.liveMaps === 1 &&
      expanded.connected === 1,
    "the panel sits beside the existing map renderer",
    expanded,
  );
  await page.screenshot({ path: `${OUT}/desktop-1440-expanded-en.png` });

  await panelTab(page, /^Ideas/).click();
  const ideas = dialog(page, "Ideas");
  await ideas.waitFor();
  check(
    (await ideas.getByText("Surry Hills bakery", { exact: true }).count()) === 1 &&
      (await page
        .locator(".trip-home-action-surface")
        .evaluate((element) => element.classList.contains("is-expanded"))) &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2",
    "switching keeps the layout, Ideas content and selected day",
  );

  await panelTab(page, /^Itinerary/).click();
  const itineraryAgain = dialog(page, "Itinerary");
  await itineraryAgain.waitFor();
  await itineraryAgain
    .getByRole("button", { name: "Change time, 10:00–11:00", exact: true })
    .click();
  const afterSwitch = await itineraryAgain
    .locator("#stop-time-harbour")
    .getByLabel("Start", { exact: true })
    .inputValue();
  check(
    afterSwitch === "10:30" &&
      (await itineraryAgain.getByRole("tab", { name: /^Day 2/ }).getAttribute("aria-selected")) ===
        "true",
    "switching back keeps the unsubmitted edit and selected day",
    afterSwitch,
  );
  await page.keyboard.press("Escape");
  check(
    (await itineraryAgain.isVisible()) &&
      (await itineraryAgain.locator("#stop-time-harbour").count()) === 0,
    "Escape closes the nested time editor before the action panel",
  );
  await page.keyboard.press("Escape");
  await itineraryAgain.waitFor({ state: "hidden" });
  const restored = await page.evaluate(() => ({
    focus: document.activeElement?.textContent ?? "",
    day: document.querySelector(".trip-home__map")?.getAttribute("data-day"),
    chats: !!document.querySelector(".trip-home-chats"),
  }));
  check(
    restored.focus.includes("Itinerary") && restored.day === "2" && restored.chats,
    "closing restores focus, selected day and the Chat list",
    restored,
  );

  await action(page, /^Trip preferences/).click();
  const preferences = dialog(page, "Trip preferences");
  await preferences.waitFor();
  const preferenceField = preferences.getByLabel("Add a preference", { exact: true });
  await preferenceField.fill("Keep unsaved panel text");
  await preferenceField.press("Enter");
  await panelTab(page, /^Ideas/).click();
  await dialog(page, "Ideas").waitFor();
  await panelTab(page, /^Trip preferences/).click();
  await preferences.waitFor();
  check(
    (await preferences.getByText("Keep unsaved panel text", { exact: true }).count()) === 1,
    "switching actions keeps an unsubmitted Trip preferences edit",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".trip-home-action-surface.is-open"));
  await action(page, /^Trip preferences/).click();
  const reopened = dialog(page, "Trip preferences");
  await reopened.waitFor();
  check(
    (await reopened.getByText("Keep unsaved panel text", { exact: true }).count()) === 1,
    "closing and reopening keeps an unsubmitted Trip preferences edit",
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector(".trip-home-action-surface.is-open"));

  await home(page)
    .getByRole("button", { name: /^Budget/ })
    .click();
  const budget = dialog(page, "Budget");
  await budget.waitFor();
  await budget.locator('input[type="number"]').fill("5200");
  await budget.getByRole("button", { name: "Save", exact: true }).click();
  await budget.waitFor({ state: "hidden" });
  await page.waitForFunction(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}");
    const trip = catalog.trips?.find((item) => item.title === "Sydney long weekend");
    const chip = document.querySelector(".fact-chips")?.textContent ?? "";
    return String(trip?.snapshot?.draft?.budgetTotal) === "5200" && chip.includes("5,200");
  });
  await action(page, /^Trip preferences/).click();
  const afterBudget = dialog(page, "Trip preferences");
  await afterBudget.waitFor();
  check(
    (await afterBudget.getByText("Keep unsaved panel text", { exact: true }).count()) === 1,
    "a later Budget save keeps the unsubmitted Trip preferences edit",
  );
  await afterBudget.getByRole("button", { name: "Save", exact: true }).click();
  await afterBudget.waitFor({ state: "hidden" });
  await page.waitForFunction(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}");
    const trip = catalog.trips?.find((item) => item.title === "Sydney long weekend");
    const preferences = trip?.snapshot?.draft?.preferences ?? [];
    return (
      String(trip?.snapshot?.draft?.budgetTotal) === "5200" &&
      preferences.includes("Keep unsaved panel text")
    );
  });
  const merged = await page.evaluate(() => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}");
    const trip = catalog.trips?.find((item) => item.title === "Sydney long weekend");
    return {
      budget: trip?.snapshot?.draft?.budgetTotal,
      preferences: trip?.snapshot?.draft?.preferences ?? [],
      chip: document.querySelector(".fact-chips")?.textContent ?? "",
    };
  });
  check(
    String(merged.budget) === "5200" &&
      merged.preferences.includes("Keep unsaved panel text") &&
      merged.chip.includes("5,200"),
    "saving Trip preferences overlays local edits onto the latest Budget",
    merged,
  );

  await action(page, /^Calendar/).click();
  await dialog(page, "Calendar").waitFor();
  await page.locator(".trip-home-action-backdrop").click({ position: { x: 20, y: 20 } });
  await dialog(page, "Calendar").waitFor({ state: "hidden" });
  check(
    (await page.evaluate(() => document.activeElement?.textContent ?? "")).includes("Calendar"),
    "a desktop outside press closes the panel and restores trigger focus",
  );

  await page.screenshot({ path: `${OUT}/desktop-1440-en.png` });
  check(desktop.errors.length === 0, "desktop journey has no browser errors", desktop.errors);
  await desktop.context.close();

  const converted = await open("en", { width: 1440, height: 1000 }, false, "CNY");
  await openHome(converted.page);
  await action(converted.page, /^Bookings/).click();
  const convertedBookings = dialog(converted.page, "Bookings");
  await convertedBookings.waitFor();
  const notice = convertedBookings.locator(".currency-notice");
  await notice.waitFor();
  check(
    (await notice.innerText()).includes("Approximate converted amounts") &&
      (await convertedBookings.getByRole("region", { name: "Flights", exact: true }).count()) === 1,
    "non-AUD Bookings show the estimate/exchange-rate notice and Flights heading",
    await notice.innerText(),
  );
  check(converted.errors.length === 0, "converted Bookings journey has no browser errors");
  await converted.context.close();

  const chinese = await open("zh", { width: 1440, height: 1000 });
  await openHome(chinese.page, "zh");
  await action(chinese.page, /^备选地点/).click();
  await dialog(chinese.page, "备选地点").waitFor();
  await chinese.page.screenshot({ path: `${OUT}/desktop-1440-zh.png` });
  await panelTab(chinese.page, /^预订/).click();
  const zhBookings = dialog(chinese.page, "预订");
  await zhBookings.waitFor();
  check(
    (await zhBookings.getByRole("region", { name: "航班", exact: true }).count()) === 1 &&
      (await panelTab(chinese.page, /^备选地点/).count()) === 1,
    "Chinese panels expose translated Flights heading and switcher entries",
  );
  await panelTab(chinese.page, /^备选地点/).click();
  check(
    (await dialog(chinese.page, "备选地点")
      .getByRole("button", { name: "把Surry Hills bakery排到第 1 天", exact: true })
      .count()) === 1,
    "Chinese schedule accessible names come from the translation catalogue",
  );
  check(chinese.errors.length === 0, "Chinese journey has no browser errors", chinese.errors);
  await chinese.context.close();

  const rejected = await open("en", { width: 1440, height: 1000 });
  await openHome(rejected.page);
  await markMap(rejected.page);
  await rejected.page.evaluate(() => window.__googleRendererFixture.fail());
  await rejected.page
    .locator(".trip-home__map")
    .getByText("The map could not load. Try again.")
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const teardown = await rejected.page.evaluate(() => {
    const fixture = window.__googleRendererFixture;
    return {
      handlerErrors: fixture.authHandlerErrors,
      liveMaps: fixture.maps.filter((map) => !map.destroyed).length,
      markers: document.querySelectorAll("fixture-google-marker").length,
    };
  });
  check(
    teardown.handlerErrors.length === 0 && teardown.liveMaps === 0 && teardown.markers === 0,
    "Google rejecting the key removes the markers and the map without throwing",
    teardown,
  );
  for (let visit = 0; visit < 2; visit += 1) {
    await home(rejected.page).getByRole("button", { name: "Back to trips" }).click();
    await rejected.page.locator(".trip-cards .trip-card").first().waitFor();
    await openHome(rejected.page);
    await rejected.page
      .locator(".trip-home__map .google-map")
      .first()
      .waitFor({ state: "attached" });
  }
  await rejected.page
    .locator(".trip-home__map")
    .getByText("The map could not load. Try again.")
    .first()
    .waitFor({ timeout: 5_000 });
  check(true, "a map mounted after Google rejects the key reports the failure, not a blank map");
  await home(rejected.page).getByRole("button", { name: "Back to trips" }).click();
  await rejected.page
    .locator(".trip-cards .trip-card")
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  const afterRejection = await rejected.page.evaluate(() => ({
    crashed: /Application error/.test(document.body.innerText),
    trips: document.querySelectorAll(".trip-cards .trip-card").length,
  }));
  await rejected.page.screenshot({ path: `${OUT}/google-rejected-trip-switch.png` });
  check(
    !afterRejection.crashed && afterRejection.trips > 0 && rejected.errors.length === 0,
    "leaving Trip home after Google rejects the key keeps the workspace running",
    { ...afterRejection, errors: rejected.errors },
  );
  await rejected.context.close();

  for (const width of [390, 1001]) {
    const responsive = await open("en", { width, height: width <= 520 ? 844 : 900 }, width <= 520);
    await openHome(responsive.page, "en", width);
    await action(responsive.page, /^Itinerary/).click();
    const panel = dialog(responsive.page, "Itinerary");
    await panel.waitFor();
    if (width <= 520) {
      const box = await panel.boundingBox();
      check(
        box && Math.abs(box.x) <= 1 && Math.abs(box.width - width) <= 1,
        `phone panel fills the screen at ${width}px`,
        box,
      );
      await panel.getByRole("button", { name: "Change time, 09:00–10:30", exact: true }).click();
      await panel.locator("#stop-time-opera").getByLabel("Start", { exact: true }).fill("09:15");
      await responsive.page.evaluate(() => history.back());
      await responsive.page.waitForFunction(
        () =>
          !document.querySelector(".item-editor") &&
          !!document.querySelector(".trip-home-action-surface.is-open") &&
          history.state?.tripPhoneOverlay === true,
      );
      check(
        (await dialog(responsive.page, "Itinerary").isVisible()) &&
          new URL(responsive.page.url()).pathname === "/",
        `phone Back closes the nested time editor before the action panel at ${width}px`,
      );
      await responsive.page.evaluate(() => history.back());
      await responsive.page.waitForFunction(
        () =>
          !document.querySelector(".trip-home-action-surface.is-open") &&
          history.state?.tripPhoneOverlay !== true,
      );
      const navigation = responsive.page.getByRole("button", { name: "Back to trips" });
      await navigation.waitFor();
      const phoneClose = await responsive.page.evaluate(() => ({
        open: !!document.querySelector(".trip-home-action-surface.is-open"),
        focus: document.activeElement?.textContent ?? "",
        navigation: !!document.querySelector(".trip-home__back"),
      }));
      check(
        phoneClose.open === false &&
          phoneClose.navigation &&
          /Itinerary|行程/.test(phoneClose.focus),
        `Back closes the phone action panel and keeps navigation and trigger focus at ${width}px`,
        phoneClose,
      );
      await home(responsive.page).getByRole("button", { name: "Back to trips" }).click();
      await responsive.page.locator(".phone-mine").waitFor();
      await responsive.page.locator(".phone-mine__settings").click();
      const settings = responsive.page.getByRole("dialog", { name: "Settings" });
      await settings.waitFor();
      await responsive.page.evaluate(() => history.back());
      await settings.waitFor({ state: "hidden" });
      check(
        (await settings.isHidden()) && (await responsive.page.locator(".phone-mine").isVisible()),
        `Settings keeps its own Back close path at ${width}px`,
      );
    } else {
      await panelTab(responsive.page, /^Bookings/).click();
      const bookings = dialog(responsive.page, "Bookings");
      await bookings.waitFor();
      const layout = await responsive.page.evaluate(() => {
        const surface = document.querySelector(".trip-home-action-surface");
        const switcher = surface?.querySelector(".trip-home-action-switcher");
        const content = surface?.querySelector(".trip-home-action-content");
        if (
          !(surface instanceof HTMLElement) ||
          !(switcher instanceof HTMLElement) ||
          !(content instanceof HTMLElement)
        )
          return null;
        return {
          selected: switcher.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? "",
          surfaceWidth: surface.getBoundingClientRect().width,
          contentWidth: content.getBoundingClientRect().width,
        };
      });
      check(
        layout?.selected === "Bookings" &&
          layout.contentWidth > 240 &&
          (width !== 521 || layout.surfaceWidth >= width - 24),
        `in-panel switching works at ${width}px`,
        layout,
      );
    }
    check((await noOverflow(responsive.page)) <= 0, `no horizontal overflow at ${width}px`);
    await responsive.page.screenshot({ path: `${OUT}/panel-${width}-en.png` });
    check(responsive.errors.length === 0, `${width}px journey has no browser errors`);
    await responsive.context.close();
  }

  if (process.env.CHANNEL === "chrome") {
    const zoomed = await open("en", { width: 1440, height: 1000 }, false, "AUD", (options) =>
      chromium.launchPersistentContext("", {
        ...options,
        channel: "chrome",
        headless: true,
      }),
    );
    const zoomSettings = await zoomed.context.newPage();
    await zoomSettings.goto("chrome://settings/appearance");
    const zoomLevel = zoomSettings.locator("#zoomLevel");
    await zoomLevel.waitFor({ state: "visible", timeout: 15_000 });
    await zoomed.page.bringToFront();
    await openHome(zoomed.page);
    for (const zoom of [125, 150]) {
      await zoomLevel.selectOption({ label: `${zoom}%` });
      await zoomed.page.waitForFunction((ratio) => devicePixelRatio >= ratio, zoom / 100);
      await action(zoomed.page, /^Itinerary/).click();
      await dialog(zoomed.page, "Itinerary").waitFor();
      await panelTab(zoomed.page, /^Bookings/).click();
      await dialog(zoomed.page, "Bookings").waitFor();
      check(
        (await noOverflow(zoomed.page)) <= 0,
        `${zoom}% Chrome zoom keeps in-panel switching without overflow`,
      );
      await zoomed.page.keyboard.press("Escape");
    }
    check(zoomed.errors.length === 0, "Chrome zoom journey has no browser errors");
    await zoomed.context.close();
  }
} catch (error) {
  const mapState = await current
    ?.evaluate(() => {
      const map = document.querySelector(".trip-home__map");
      const canvas = map?.querySelector(".trip-map-canvas");
      return {
        canvasClass: canvas?.className,
        html: map?.innerHTML.slice(0, 1_000),
        provider: canvas?.querySelector(".google-map")?.getAttribute("data-provider"),
        text: map?.textContent,
      };
    })
    .catch(() => undefined);
  check(false, "journey completes", {
    error: String(error),
    mapState,
    pageErrors: currentErrors,
    requests: currentRequests,
  });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser?.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ fixture: "local catalog; no live providers", results }, null, 2),
  );
}

process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
