import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-cards", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-05T00:00:00Z";
const stop = (id, day, startTime) => ({
  id,
  kind: "activity",
  ...(day === undefined
    ? {}
    : {
        day,
        startTime,
        endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
      }),
  location: id,
  detail: id,
});
const makeTrip = ({ id, destination, dates, stops, preferences, conversationStops }) => {
  const conversationId = `conversation:${id}`;
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates,
    groupSize: 2,
    budgetTotal: 3000,
  };
  const snapshotWith = (items) => ({
    version: 3,
    id,
    savedAt,
    draft: {
      destination,
      origin: "",
      start: dates[0],
      end: dates[1],
      groupSize: "2",
      budgetTotal: "3000",
      preferences,
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
      budgetTotal: 3000,
      estTotal: 900,
      overrunPct: -70,
      sections: items.length
        ? [
            {
              id: "itinerary",
              label: "Day plan",
              status: "draft",
              summary: `${destination} visit`,
              estCost: 0,
              proposal: {
                agent: "itinerary",
                summary: `${destination} visit`,
                items,
                assumptions: [],
                conflictsWith: [],
              },
            },
          ]
        : [],
    },
  });
  const snapshot = snapshotWith(stops);
  const chatSnapshot = conversationStops ? snapshotWith(conversationStops) : snapshot;
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
      snapshot: chatSnapshot,
    },
  };
};
const sydney = makeTrip({
  id: "sydney",
  destination: "Sydney",
  dates: ["2030-11-14", "2030-11-17"],
  stops: [
    stop("Opera", 1, "09:00"),
    stop("Bridge", 1, "11:00"),
    stop("Bondi", 2, "10:00"),
    stop("Manly", 3, "10:00"),
    stop("Idea only", undefined),
  ],
  preferences: ["Quiet mornings", "Vegetarian", "No long drives"],
});
const melbourne = makeTrip({
  id: "melbourne",
  destination: "Melbourne",
  dates: ["2030-03-05", "2030-03-07"],
  stops: [],
  preferences: [],
});
const hobart = makeTrip({
  id: "hobart",
  destination: "Hobart",
  dates: ["2020-06-20", "2020-06-22"],
  stops: [stop("Salamanca", 1, "10:00")],
  preferences: ["Quiet mornings"],
  conversationStops: [],
});
const entries = [sydney, melbourne, hobart];
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

let current;
let currentErrors = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));

async function open(language, viewport, seed = catalog) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
    hasTouch: viewport.width <= 520,
  });
  await context.addInitScript(
    ({ catalog, settings }) => {
      if (localStorage.getItem("seeded")) return;
      localStorage.setItem("seeded", "1");
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
    },
    { catalog: seed, settings: settingsFor(language) },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  current = page;
  currentErrors = errors;
  return { context, page, errors };
}

const tripCards = (page, name) => page.locator(".trip-cards").getByRole("button", { name });
const home = (page) => page.locator(".trip-home");
const sections = (page) => home(page).getByRole("list", { name: /^(Trip sections|行程板块)$/ });
const card = (page, name) => sections(page).getByRole("button", { name });
const goTrips = (page, name) => page.locator(".sidebar-nav").getByRole("button", { name });
const openHome = async (page, name, trips = /^Trips/) => {
  await goTrips(page, trips).click();
  await tripCards(page, name).first().click();
  await home(page).waitFor();
};
const panelStops = (page) =>
  page.locator("#trip-trigger-count").evaluate((node) => node.textContent.trim());
const overflow = (page) =>
  page.evaluate(() => ({
    page: document.documentElement.scrollWidth - innerWidth,
    main: (() => {
      const main = document.querySelector(".trip-home__main");
      return main ? main.scrollWidth - main.clientWidth : 0;
    })(),
  }));

try {
  const { context, page, errors } = await open("en", { width: 1440, height: 1000 });

  await openHome(page, /^Trip to Sydney/);
  const labels = await sections(page).getByRole("button").allInnerTexts();
  check(
    labels.length === 3 &&
      /^Itinerary\s+4 stops$/.test(labels[0].replace(/\n/g, " ")) &&
      labels[1] === "Calendar" &&
      /^Preferences\s+3 preferences$/.test(labels[2].replace(/\n/g, " ")),
    "Sydney shows exactly Itinerary with 4 stops, Calendar and Preferences with 3",
    labels,
  );
  check(
    (await home(page)
      .getByText(/Ideas|Bookings|Media|Receipts/)
      .count()) === 0,
    "no card for Ideas, Bookings, Media or Receipts",
  );
  check(
    (await card(page, "Itinerary 4 stops").count()) === 1 &&
      (await card(page, "Preferences 3 preferences").count()) === 1 &&
      (await card(page, "Calendar").count()) === 1,
    "cards have accessible names that include the counts",
  );
  await page.screenshot({ path: `${OUT}/home-1440-en.png` });
  const before = await stored(page);

  await card(page, /^Itinerary/).click();
  await page.locator(".trip-workspace").waitFor();
  check(
    (await home(page).count()) === 0 &&
      (await page.locator(".trip-trigger").getAttribute("aria-expanded")) === "true" &&
      /^4\b/.test(await panelStops(page)),
    "Itinerary opens the conversation view with the Trip panel open showing the card's 4 stops",
    await panelStops(page),
  );
  const afterItinerary = await stored(page);
  check(
    afterItinerary.activeTripId === sydney.trip.id &&
      afterItinerary.trips.length === before.trips.length &&
      JSON.stringify(afterItinerary.trips) === JSON.stringify(before.trips),
    "Itinerary changes only the active trip and conversation in the stored catalog",
  );
  await page.screenshot({ path: `${OUT}/itinerary-1440-en.png` });

  await openHome(page, /^Trip to Hobart/);
  const hobartLabels = await sections(page).getByRole("button").allInnerTexts();
  check(
    /^Itinerary\s+1 stop$/.test(hobartLabels[0].replace(/\n/g, " ")) &&
      /^Preferences\s+1 preference$/.test(hobartLabels[2].replace(/\n/g, " ")),
    "singular counts read 1 stop and 1 preference",
    hobartLabels,
  );
  await card(page, /^Itinerary/).click();
  await page.locator(".trip-workspace").waitFor();
  const hobartTrip = await panelStops(page);
  check(
    /^1\b/.test(hobartTrip) && (await stored(page)).activeTripId === hobart.trip.id,
    "Itinerary opens this trip's own plan even when its chat holds an older snapshot",
    hobartTrip,
  );

  await openHome(page, /^Trip to Melbourne/);
  const melbourneLabels = await sections(page).getByRole("button").allInnerTexts();
  check(
    melbourneLabels.length === 3 &&
      melbourneLabels[0] === "Itinerary" &&
      melbourneLabels[1] === "Calendar" &&
      melbourneLabels[2] === "Preferences",
    "a trip with no stops and no preferences shows the three cards without counts",
    melbourneLabels,
  );
  await page.screenshot({ path: `${OUT}/home-no-counts-1440-en.png` });

  await openHome(page, /^Trip to Sydney/);
  await card(page, /^Preferences/).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const dialogText = await dialog.innerText();
  check(
    ["Quiet mornings", "Vegetarian", "No long drives"].every((item) => dialogText.includes(item)) &&
      (await home(page).count()) === 0,
    "Preferences opens the preferences panel with this trip's three preferences",
    dialogText.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT}/preferences-1440-en.png` });
  await page.keyboard.press("Escape");

  await openHome(page, /^Trip to Hobart/);
  await card(page, "Calendar").click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  const month = await page.locator(".trip-calendar__head").innerText();
  check(
    (await page
      .getByRole("tab", { name: "Calendar", exact: true })
      .getAttribute("aria-selected")) === "true" &&
      /June\s+2020/.test(month) &&
      (await page.locator(".trip-calendar__trip[aria-label^='Trip to Hobart']").count()) >= 1,
    "Calendar opens the Trips page calendar tab on the month of this trip, even a past one",
    month,
  );
  await page.screenshot({ path: `${OUT}/calendar-hobart-1440-en.png` });
  await goTrips(page, /^Trips/).click();
  await goTrips(page, /^Calendar/).click();
  await page.waitForTimeout(300);
  const nextMonth = await page.locator(".trip-calendar__head").innerText();
  check(
    !/2020/.test(nextMonth),
    "Calendar from the sidebar afterwards does not stay on the earlier trip",
    nextMonth,
  );
  check(errors.length === 0, "desktop run has no page or console errors", errors);
  await context.close();

  const probe = await open("en", { width: 1440, height: 1000 });
  await goTrips(probe.page, /^Chats/).click();
  await probe.page
    .locator(".history-item:not(.history-item--trip)")
    .getByRole("button", { name: /Hobart chat/ })
    .first()
    .click();
  await probe.page.getByText("Plan Hobart marker", { exact: true }).waitFor();
  await probe.page.waitForTimeout(1000);
  const snapshotStops = (snapshot) =>
    snapshot.plan.sections.flatMap((part) => part.proposal?.items ?? []).filter((item) => item.day)
      .length;
  const afterChat = await stored(probe.page);
  check(true, "observed: opening a chat row whose snapshot is older than its trip's", {
    tripStopsBefore: snapshotStops(hobart.trip.snapshot),
    chatStopsBefore: snapshotStops(hobart.conversation.snapshot),
    tripStopsAfter: snapshotStops(
      afterChat.trips.find((trip) => trip.id === hobart.trip.id).snapshot,
    ),
    chatStopsAfter: snapshotStops(
      afterChat.conversations.find((item) => item.id === hobart.conversation.id).snapshot,
    ),
  });
  await probe.context.close();

  const narrow = await open("en", { width: 768, height: 1000 });
  await narrow.page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await narrow.page
    .locator(".drawer")
    .getByRole("button", { name: /^Trips/ })
    .first()
    .click();
  await tripCards(narrow.page, /^Trip to Sydney/)
    .first()
    .click();
  await home(narrow.page).waitFor();
  check(
    (await card(narrow.page, "Itinerary 4 stops").count()) === 1,
    "narrow window shows the cards",
  );
  const narrowBox = await overflow(narrow.page);
  check(
    narrowBox.page <= 0 && narrowBox.main <= 0,
    "narrow window has no horizontal overflow",
    narrowBox,
  );
  await narrow.page.screenshot({ path: `${OUT}/home-768-en.png` });
  await card(narrow.page, /^Itinerary/).click();
  await narrow.page.locator(".trip-workspace").waitFor();
  check(
    /^4\b/.test(await panelStops(narrow.page)),
    "Itinerary opens the Trip panel at narrow width",
  );
  check(narrow.errors.length === 0, "narrow run has no page or console errors", narrow.errors);
  await narrow.context.close();

  const phone = await open("en", { width: 390, height: 844 });
  await phone.page
    .getByRole("tablist", { name: "Workspace sections" })
    .getByRole("tab", { name: "Mine", exact: true })
    .click();
  await phone.page.locator(".trip-card").filter({ hasText: "Sydney" }).first().click();
  await home(phone.page).waitFor();
  const phoneCards = await phone.page
    .locator(".trip-home-card")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left));
  check(
    phoneCards.length === 3 && new Set(phoneCards.map(Math.round)).size === 1,
    "on a phone the Trip home shows the three cards stacked in one column",
    phoneCards,
  );
  await phone.page.screenshot({ path: `${OUT}/phone-390-en.png` });
  await card(phone.page, /^Itinerary/).click();
  check(
    (await phone.page
      .getByRole("tablist", { name: "Workspace sections" })
      .getByRole("tab", { name: "Trip", exact: true })
      .getAttribute("aria-selected")) === "true",
    "on a phone Itinerary opens the Trip tab",
  );
  await phone.context.close();

  const stacked = await open("en", { width: 600, height: 900 });
  await stacked.page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await stacked.page
    .locator(".drawer")
    .getByRole("button", { name: /^Trips/ })
    .first()
    .click();
  await tripCards(stacked.page, /^Trip to Sydney/)
    .first()
    .click();
  await home(stacked.page).waitFor();
  const columns = await stacked.page.evaluate(() => {
    const tops = [...document.querySelectorAll(".trip-home-card")].map(
      (node) => node.getBoundingClientRect().top,
    );
    return { tops, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  check(
    new Set(columns.tops).size === 3 && columns.overflow <= 0,
    "at 600px wide the cards stack in one column without overflow",
    columns,
  );
  await stacked.page.screenshot({ path: `${OUT}/home-600-en.png` });
  await stacked.context.close();

  const zh = await open("zh", { width: 1440, height: 1000 });
  await openHome(zh.page, /Sydney/, /^行程/);
  const zhLabels = (await sections(zh.page).getByRole("button").allInnerTexts()).map((text) =>
    text.replace(/\n/g, " "),
  );
  check(
    zhLabels.length === 3 &&
      zhLabels[0] === "行程概览 4 站点" &&
      zhLabels[1] === "日历" &&
      zhLabels[2] === "旅行偏好 3 项偏好" &&
      (await sections(zh.page).getAttribute("aria-label")) === "行程板块",
    "Chinese card labels, counts and list name are translated",
    zhLabels,
  );
  check(
    (await card(zh.page, "旅行偏好 3 项偏好").count()) === 1,
    "Chinese cards keep accessible names with counts",
  );
  await zh.page.screenshot({ path: `${OUT}/home-1440-zh.png` });
  check(zh.errors.length === 0, "Chinese run has no page or console errors", zh.errors);
  await zh.context.close();

  const broken = structuredClone(catalog);
  delete broken.trips[0].snapshot.plan;
  const corrupt = await open("en", { width: 1440, height: 1000 }, broken);
  await goTrips(corrupt.page, /^Trips/).click();
  await corrupt.page.waitForTimeout(500);
  check(
    (await corrupt.page.locator(".trip-home-cards").count()) === 0,
    "a stored trip without a plan never renders cards",
    corrupt.errors,
  );
  await corrupt.context.close();
} catch (error) {
  check(false, "journey completes", { error: String(error), pageErrors: currentErrors });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ results, fixture: "local catalog; no live services" }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
