import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-ideas-bookings", process.env.LABEL ?? "run");
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
          },
          {
            id: "harbour",
            kind: "activity",
            day: 2,
            startTime: "10:00",
            endTime: "11:00",
            location: "Circular Quay",
            detail: "Harbour walk",
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

async function open(language) {
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
    { catalog, language },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  current = page;
  currentErrors = errors;
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
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

try {
  browser = await chromium.launch({ headless: true });
  const desktop = await open("en");
  const { page } = desktop;

  await action(page, /^Ideas/).click();
  const ideas = dialog(page, "Ideas");
  await ideas.waitFor();
  check(
    (await ideas.getByText("Surry Hills bakery", { exact: true }).count()) === 1 &&
      (await ideas.getByText("Sydney fish restaurant", { exact: true }).count()) === 1 &&
      (await ideas.getByText("Sydney Opera House", { exact: true }).count()) === 0 &&
      (await ideas.getByText("Circular Quay", { exact: true }).count()) === 0,
    "Ideas includes every unscheduled activity and restaurant exactly once",
  );

  const schedule = ideas.getByRole("button", {
    name: "Schedule Surry Hills bakery on Day 2",
    exact: true,
  });
  check((await schedule.count()) === 1, "each idea exposes the established day scheduling control");
  if (await schedule.count()) {
    await schedule.click();
    await ideas.getByText("Surry Hills bakery", { exact: true }).waitFor({ state: "detached" });
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"),
    );
    const saved = stored.trips[0].snapshot.plan.sections
      .find((section) => section.id === "itinerary")
      .proposal.items.find((item) => item.id === "bakery");
    check(
      saved?.day === 2 && saved?.startTime === "11:00" && saved?.endTime === "13:00",
      "scheduling updates this Trip through the existing Plan editor",
      saved,
    );
  }
  check((await page.locator(".trip-home").count()) === 1, "scheduling stays on Trip home");
  await page.screenshot({ path: `${OUT}/ideas-1440-en.png` });

  await action(page, /^Bookings/).focus();
  await page.keyboard.press("Enter");
  const bookings = dialog(page, "Bookings");
  await bookings.waitFor();
  check((await dialog(page, "Ideas").count()) === 0, "Bookings replaces Ideas in the same drawer");
  const group = (name) => bookings.getByRole("region", { name, exact: true });
  check(
    (await group("Activities").getByText("Sydney Opera House", { exact: true }).count()) === 1 &&
      (await group("Flights").getByText("MEL → SYD · Qantas", { exact: true }).count()) === 1 &&
      (await group("Stays").getByText("Harbour Hotel", { exact: true }).count()) === 1,
    "Bookings groups booked activities and the selected flight and stay",
  );
  check(
    (await bookings.getByText("MEL → SYD · Qantas", { exact: true }).count()) === 1 &&
      (await bookings.getByText("Harbour Hotel", { exact: true }).count()) === 1 &&
      (await bookings.getByText("Not selected airline", { exact: true }).count()) === 0 &&
      (await bookings.getByText("Not selected hotel", { exact: true }).count()) === 0 &&
      (await bookings.getByText("Selected flight proposal", { exact: true }).count()) === 0 &&
      (await bookings.getByText("Selected stay proposal", { exact: true }).count()) === 0,
    "selections and their proposal items do not duplicate bookings or expose alternatives",
  );
  await page.screenshot({ path: `${OUT}/bookings-1440-en.png` });
  check(
    desktop.errors.length === 0,
    "English journey has no page or console errors",
    desktop.errors,
  );
  await desktop.context.close();

  const chinese = await open("zh");
  await action(chinese.page, /^Ideas/).click();
  const chineseIdeas = dialog(chinese.page, "Ideas");
  check(
    (await chineseIdeas
      .getByRole("button", { name: "将 Surry Hills bakery 安排到第 2 天", exact: true })
      .count()) === 1,
    "Chinese Ideas exposes a translated scheduling control",
  );
  await action(chinese.page, /^Bookings/).focus();
  await chinese.page.keyboard.press("Enter");
  const chineseBookings = dialog(chinese.page, "Bookings");
  check(
    (await chineseBookings.getByRole("region", { name: "活动", exact: true }).count()) === 1 &&
      (await chineseBookings.getByRole("region", { name: "航班", exact: true }).count()) === 1 &&
      (await chineseBookings.getByRole("region", { name: "住宿", exact: true }).count()) === 1,
    "Chinese Bookings exposes translated groups",
  );
  check(
    chinese.errors.length === 0,
    "Chinese journey has no page or console errors",
    chinese.errors,
  );
  await chinese.context.close();
} catch (error) {
  check(false, "journey completes", { error: String(error), pageErrors: currentErrors });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser?.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ fixture: "local catalog; no live providers", results }, null, 2),
  );
}

process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
