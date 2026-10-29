import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-shared-editor", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const tripId = "sydney-ideas-bookings";
const dates = ["2030-11-14", "2030-11-16"];
const placeFor = (text) => {
  const hash = [...text].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    id: `fixture-${encodeURIComponent(text)}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW`,
    location: { latitude: -33.85 - (hash % 100) / 1000, longitude: 151.2 + (hash % 70) / 1000 },
  };
};
const plan = {
  tripId,
  brief: {
    tripId,
    userId: "local",
    destination: "Sydney",
    origin: "Melbourne",
    dates,
    groupSize: 2,
    budgetTotal: 4500,
  },
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
        items: [
          {
            id: "opera",
            kind: "activity",
            day: 1,
            startTime: "09:00",
            endTime: "10:30",
            location: "Sydney Opera House",
            detail: "Guided tour",
            booked: true,
            placeId: placeFor("Sydney Opera House").id,
          },
          {
            id: "harbour",
            kind: "activity",
            day: 3,
            startTime: "10:00",
            endTime: "11:00",
            location: "Circular Quay",
            detail: "Harbour walk",
            placeId: placeFor("Circular Quay").id,
          },
          {
            id: "bakery",
            kind: "activity",
            location: "Surry Hills bakery",
            detail: "Breakfast idea",
          },
        ],
        assumptions: [],
        conflictsWith: [],
      },
    },
    {
      id: "dining",
      label: "Dining",
      status: "draft",
      summary: "Sydney dining",
      estCost: 100,
      proposal: {
        agent: "dining",
        summary: "Sydney dining",
        items: [
          {
            id: "fish",
            kind: "meal",
            location: "Sydney fish restaurant",
            detail: "Seafood dinner",
          },
          {
            id: "harbour",
            kind: "meal",
            location: "Circular Quay",
            detail: "Already scheduled",
          },
        ],
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
            detail: "Qantas · returning 2030-11-16",
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
            candidates: [
              { id: "qantas", carrier: "Qantas", price: 500, stops: 0 },
              { id: "other", carrier: "Not selected airline", price: 400 },
            ],
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
        items: [
          {
            id: "stay-item",
            selectionId: "stay-selection",
            kind: "hotel",
            day: 1,
            location: "Harbour Hotel",
            detail: "Selected stay proposal",
          },
        ],
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
              {
                id: "other-hotel",
                name: "Not selected hotel",
                area: "Elsewhere",
                pricePerNight: 100,
                rating: 8,
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
  savedAt: "2026-10-29T00:00:00Z",
  draft: {
    destination: "Sydney",
    origin: "Melbourne",
    start: dates[0],
    end: dates[1],
    groupSize: "2",
    budgetTotal: "4500",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [],
  input: "",
  plan,
};
const conversation = {
  id: "conversation:sydney-ideas-bookings",
  title: "Sydney planning",
  renamed: true,
  updatedAt: "2026-10-29T00:00:00Z",
  tripId: `trip:${tripId}`,
  messages: [],
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
      updatedAt: "2026-10-29T00:00:00Z",
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
let preview;

async function open(language, fixture = catalog) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
  });
  await context.addInitScript(
    ({ catalog, language }) => {
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
          displayCurrency: "AUD",
          updatedAt: "2026-10-29T00:00:00Z",
        }),
      );
    },
    { catalog: fixture, language },
  );
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  preview = {
    mode: "normal",
    gate: undefined,
    release: undefined,
    requests,
  };
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  current = page;
  currentErrors = errors;
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    await route.fulfill({ json: { places: /nothing/i.test(text) ? [] : [placeFor(text)] } });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    const name = decodeURIComponent(placeId).replace(/^fixture-/, "");
    await route.fulfill({ json: { place: { ...placeFor(name), id: placeId } } });
  });
  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (preview.gate) await preview.gate;
    if (preview.mode === "refused") {
      await route.fulfill({
        json: {
          blockerNotices: [{ key: "This schedule conflicts with an existing stop." }],
          blockers: [{ key: "This schedule conflicts with an existing stop." }],
          routes: [],
        },
      });
      return;
    }
    const response = await route.fetch();
    const json = await response.json();
    if (body.operation?.kind === "place" && json.plan) {
      const items =
        json.plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
      const stop = items.find((item) => item.id === body.operation.id);
      if (stop) {
        stop.placeId = body.operation.placeId;
        stop.location = body.operation.title ?? stop.location;
      }
    }
    await route.fulfill({ response, json });
  });
  await page.route(/^(?!http:\/\/localhost|http:\/\/127\.0\.0\.1).*/, (route) => route.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
    .click();
  await page.locator(".trip-cards .trip-card").first().click();
  await page.locator(".trip-home").waitFor();
  return { context, page, errors };
}

const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const action = (page, name) =>
  page.getByRole("list", { name: /^(Trip actions|行程操作)$/ }).getByRole("button", { name });
const homeMap = (page) => page.getByRole("region", { name: "Trip map", exact: true }).first();
const markerLabels = (scope) =>
  scope
    .locator(".trip-map-marker")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim()).sort(),
    );
const waitForText = async (scope, text, timeout = 10_000) => {
  const locator = scope.getByText(text, { exact: false }).first();
  await locator.waitFor({ timeout });
  return locator;
};
const closeDrawer = async (page) => {
  const open = page.locator('[role="dialog"][aria-modal="true"]');
  await open.getByRole("button", { name: /^Close / }).click();
  await open.waitFor({ state: "hidden" });
};
const openTripHome = async (page) => {
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page.locator(".trip-cards .trip-card").first().click();
  await page.locator(".trip-home").waitFor();
};
const openWorkspaceTrip = async (page) => {
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: "Sydney planning" })
    .first()
    .locator(".history-item__open")
    .click();
  await page.locator(".workspace-shell").waitFor();
  const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.locator(".trip-workspace .trip-panel").waitFor();
};
const stop = (scope, name) =>
  scope
    .locator(".timeline-stop")
    .filter({
      has: scope.page().locator(".timeline-stop__name", { hasText: name }),
    })
    .first();
const changeTime = async (scope, name, start, end, settle = true) => {
  const row = stop(scope, name);
  await row.getByRole("button", { name: /^Change time/ }).click();
  await scope
    .getByLabel(/^Start/)
    .first()
    .fill(start);
  await scope.getByLabel(/^End/).first().fill(end);
  await scope.getByRole("button", { name: "Change time", exact: true }).click();
  if (settle)
    await row.getByRole("button", { name: new RegExp(`^Change time, ${start}`) }).waitFor();
};

try {
  browser = await chromium.launch({ headless: true });
  const { context, page } = await open("en");
  await action(page, /^Itinerary/).click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  check(
    (await itinerary.locator(".trip-panel").count()) === 1,
    "home itinerary uses the Trip editing view",
  );
  check(
    (await itinerary.locator(".timeline-stop__name", { hasText: "Sydney Opera House" }).count()) >
      0,
    "activity is visible",
  );
  check((await itinerary.getByText(/Qantas/).count()) > 0, "flight is visible");
  check((await itinerary.getByText(/Harbour Hotel/).count()) > 0, "stay is visible");
  const dayTwo = itinerary.getByRole("tab", { name: /^Day 2/ });
  check(
    /(?:Booked|2 stops)/.test(await dayTwo.innerText()) &&
      !/Free day/.test(await dayTwo.innerText()),
    "a booking-only day is not labelled Free day",
    await dayTwo.innerText(),
  );
  await dayTwo.click();
  check(
    (await dayTwo.getAttribute("aria-selected")) === "true",
    "the selected day follows the shared Trip map day",
  );
  check(
    (await itinerary.locator(".timeline-booking").filter({ hasText: "Harbour Hotel" }).count()) > 0,
    "the booking-only day renders its stay",
  );
  await itinerary.getByRole("tab", { name: /^Day 1/ }).click();

  await changeTime(itinerary, "Sydney Opera House", "11:00", "12:30");
  await changeTime(itinerary, "Sydney Opera House", "13:00", "14:30");
  await itinerary.getByRole("button", { name: "Undo last change" }).click();
  await stop(itinerary, "Sydney Opera House")
    .getByRole("button", { name: /^Change time, 11:00/ })
    .waitFor();
  check(true, "two time edits followed by Undo retain the first change");

  const workspaceTime = "15:30";
  const releasePending = (() => {
    let release;
    preview.gate = new Promise((resolve) => {
      release = resolve;
    });
    return () => {
      preview.gate = undefined;
      release();
    };
  })();
  await changeTime(itinerary, "Sydney Opera House", workspaceTime, "16:00", false);
  await page.waitForFunction(() => document.body.textContent?.includes("Checking the change"));
  await closeDrawer(page);
  await openWorkspaceTrip(page);
  const workspace = page.getByRole("region", { name: "Your trip" });
  check(
    await workspace.getByText("Checking the change…", { exact: true }).isVisible(),
    "switching from home to Trip keeps the pending edit state",
  );
  releasePending();
  await stop(workspace, "Sydney Opera House")
    .getByRole("button", { name: new RegExp(`^Change time, ${workspaceTime}`) })
    .waitFor({ timeout: 10_000 });
  check(true, "a pending home edit finishes after switching to the conversation Trip entry");

  await stop(workspace, "Sydney Opera House").locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name: "Replace place", exact: true }).click();
  const replaceSearch = workspace.getByRole("searchbox").last();
  await replaceSearch.fill("Bondi Pavilion");
  await replaceSearch.press("Enter");
  await page.getByRole("button", { name: "Use Bondi Pavilion", exact: true }).click();
  await waitForText(workspace, "Bondi Pavilion");
  const workspaceMap = page.locator(".trip-workspace__map");
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".trip-map-marker")].some((node) =>
      node.textContent?.includes("Bondi Pavilion"),
    ),
  );
  check(
    (await markerLabels(workspaceMap)).some((label) => label.includes("Bondi Pavilion")),
    "a place edit updates the conversation Trip map",
    await markerLabels(workspaceMap),
  );
  await workspace.getByRole("tab", { name: /^Day 3/ }).click();
  check(
    (await workspace.getByRole("tab", { name: /^Day 3/ }).getAttribute("aria-selected")) === "true",
    "the selected day identity is explicit in the shared editor",
  );

  await openTripHome(page);
  await action(page, /^Itinerary/).click();
  const homeItinerary = dialog(page, "Itinerary");
  await homeItinerary.waitFor();
  check(
    (await homeItinerary.getByRole("tab", { name: /^Day 3/ }).getAttribute("aria-selected")) ===
      "true",
    "home Itinerary preserves the day selected in the conversation Trip entry",
  );
  await homeItinerary.getByRole("tab", { name: /^Day 1/ }).click();
  await waitForText(homeItinerary, "Bondi Pavilion");
  check(
    (await markerLabels(homeMap(page))).some((label) => label.includes("Bondi Pavilion")),
    "the place edit and shared Undo state are present in home after switching entries",
    await markerLabels(homeMap(page)),
  );
  check(
    (await homeItinerary.getByRole("button", { name: "Undo last change" }).count()) > 0,
    "Undo state is shared with home Itinerary",
  );
  await closeDrawer(page);

  await action(page, /^Ideas/).click();
  const ideas = dialog(page, "Ideas");
  await ideas.waitFor();
  await ideas.getByRole("button", { name: "Schedule Surry Hills bakery on Day 3" }).click();
  await ideas.getByRole("status").waitFor();
  await closeDrawer(page);
  await action(page, /^Itinerary/).click();
  const afterIdeas = dialog(page, "Itinerary");
  await afterIdeas.getByRole("tab", { name: /^Day 3/ }).click();
  await waitForText(afterIdeas, "Surry Hills bakery");
  check(true, "scheduling an Idea from home updates the shared itinerary");

  await closeDrawer(page);
  await openWorkspaceTrip(page);
  await workspace.getByRole("tab", { name: /^Day 3/ }).click();
  await waitForText(workspace, "Surry Hills bakery");
  check(true, "an Idea scheduled on home is visible in the conversation Trip editor");
  const bakery = stop(workspace, "Surry Hills bakery");
  await bakery.locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name: "Move to previous day", exact: true }).click();
  await workspace.getByRole("tab", { name: /^Day 2/ }).click();
  await waitForText(workspace, "Surry Hills bakery");
  check(true, "a reverse edit moves the scheduled Idea to another day");
  await workspace.getByRole("button", { name: /^Undo(?: last change)?$/ }).click();
  await workspace.getByRole("tab", { name: /^Day 3/ }).click();
  await waitForText(workspace, "Surry Hills bakery");
  check(true, "Undo from the conversation Trip restores the moved Idea");

  await workspace.getByRole("tab", { name: /^Day 1/ }).click();
  preview.mode = "refused";
  const beforeRefused = await stop(workspace, "Bondi Pavilion")
    .locator(".timeline-stop__time")
    .getAttribute("aria-label");
  await changeTime(workspace, "Bondi Pavilion", "19:00", "20:00").catch(() => undefined);
  await workspace.getByRole("alert").first().waitFor({ timeout: 10_000 });
  check(
    (await stop(workspace, "Bondi Pavilion")
      .locator(".timeline-stop__time")
      .getAttribute("aria-label")) === beforeRefused,
    "a refused preview leaves the Plan unchanged and displays the failure",
  );
  preview.mode = "normal";

  await openTripHome(page);
  await action(page, /^Itinerary/).click();
  const finalHome = dialog(page, "Itinerary");
  await finalHome.getByRole("tab", { name: /^Day 1/ }).click();
  await waitForText(finalHome, "Bondi Pavilion");
  check(
    (await markerLabels(homeMap(page))).some((label) => label.includes("Bondi Pavilion")),
    "the map and home editor still show the latest applied place after the refusal",
  );
  check(
    (await page.getByRole("dialog", { name: "Itinerary" }).count()) === 1,
    "only one shared editable Plan is present",
  );
  const unexpectedErrors = currentErrors.filter(
    (message) => !/Failed to load resource: net::ERR_FAILED/.test(message),
  );
  check(
    unexpectedErrors.length === 0,
    "shared editor journey has no unexpected page or console errors",
    unexpectedErrors,
  );
  await page.screenshot({ path: `${OUT}/desktop.png` });
  await context.close();
} catch (error) {
  check(false, "journey completes", String(error));
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser?.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ fixture: "local catalog; no live providers", results }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
