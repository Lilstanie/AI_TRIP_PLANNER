import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-action-rail", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-29T00:00:00Z";
const tripId = "sydney-action-rail";
const dates = ["2030-11-14", "2030-11-16"];
const brief = {
  tripId,
  userId: "local",
  destination: "Sydney",
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
  {
    id: "gallery",
    kind: "activity",
    location: "Art Gallery",
    detail: "Rainy afternoon idea",
  },
];
const snapshotFor = (id, message) => ({
  version: 3,
  id,
  savedAt,
  draft: {
    destination: "Sydney",
    origin: "",
    start: dates[0],
    end: dates[1],
    groupSize: "2",
    budgetTotal: "4500",
    preferences: ["Quiet mornings", "Seafood"],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: message ? [{ role: "user", text: message }] : [],
  input: "",
  plan: {
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
        estCost: 1200,
        proposal: {
          agent: "itinerary",
          summary: "Sydney visit",
          items,
          assumptions: [],
          conflictsWith: [],
        },
      },
    ],
  },
});
const conversations = [
  {
    id: "conversation:sydney-food",
    title: "Food ideas",
    renamed: true,
    updatedAt: "2026-10-28T00:00:00Z",
    tripId: "trip:sydney-action-rail",
    messages: [{ role: "user", text: "Food ideas marker" }],
    input: "",
    snapshot: snapshotFor("sydney-food", "Food ideas marker"),
  },
  {
    id: "conversation:sydney-family",
    title: "Family plan",
    renamed: true,
    updatedAt: "2026-10-29T00:00:00Z",
    tripId: "trip:sydney-action-rail",
    messages: [{ role: "user", text: "Family plan marker" }],
    input: "",
    snapshot: snapshotFor("sydney-family", "Family plan marker"),
  },
];
const catalog = {
  version: 4,
  activeConversationId: conversations[0].id,
  activeTripId: "trip:sydney-action-rail",
  trips: [
    {
      id: "trip:sydney-action-rail",
      title: "Sydney long weekend",
      renamed: true,
      updatedAt: savedAt,
      conversationIds: conversations.map((item) => item.id),
      snapshot: snapshotFor("trip", ""),
    },
  ],
  conversations,
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

let browser;
let current;
let currentErrors = [];

async function open(language, viewport, phone = false) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  });
  await context.addInitScript(
    ({ catalog, settings }) => {
      if (localStorage.getItem("action-rail-seeded")) return;
      localStorage.setItem("action-rail-seeded", "1");
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
      localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
    },
    { catalog, settings: settingsFor(language) },
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

const home = (page) => page.locator(".trip-home");
const chats = (page) => home(page).getByRole("list", { name: /^(Chats|聊天)$/ });
const actions = (page) => home(page).getByRole("list", { name: /^(Trip actions|行程操作)$/ });
const action = (page, name) => actions(page).getByRole("button", { name });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));

async function openHome(page, language = "en") {
  const mine = page.getByRole("tab", { name: /^(Mine|我的)$/ });
  if (await mine.isVisible()) {
    await mine.click();
    await page.locator(".phone-mine .trip-card").first().click();
  } else {
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
      .click();
    await page.locator(".trip-cards .trip-card").first().click();
  }
  await home(page).waitFor();
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
  });
  const desktop = await open("en", { width: 1440, height: 1000 });
  const { page } = desktop;
  await openHome(page);

  check(
    (await actions(page).count()) === 1 && (await actions(page).getByRole("button").count()) === 5,
    "Trip home has one five-action rail",
  );
  const actionNames = await actions(page).getByRole("button").allInnerTexts();
  check(
    ["Itinerary", "Ideas", "Bookings", "Trip preferences", "Calendar"].every((name, index) =>
      actionNames[index]?.includes(name),
    ),
    "the rail orders Itinerary, Ideas, Bookings, Trip preferences and Calendar",
    actionNames,
  );
  const chatNames = await chats(page).getByRole("button").allInnerTexts();
  check(
    chatNames.some((name) => name.includes("Food ideas")) &&
      chatNames.some((name) => name.includes("Family plan")),
    "the centre lists every Chat linked to the Trip",
    chatNames,
  );

  await chats(page)
    .getByRole("button", { name: /Family plan/ })
    .click();
  await page.getByText("Family plan marker", { exact: true }).waitFor();
  check(
    (await home(page).count()) === 1 &&
      (await actions(page).isVisible()) &&
      (await page.getByRole("button", { name: "Back to trip home" }).isVisible()),
    "opening a Trip Chat keeps Trip home and the action rail in place",
  );
  await page.screenshot({ path: `${OUT}/chat-with-rail-1440-en.png` });
  await page.getByRole("button", { name: "Back to trip home" }).click();
  await chats(page).waitFor();

  await action(page, /^Itinerary/).click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  const boxes = await page.evaluate(() => {
    const main = document.querySelector(".trip-home__main").getBoundingClientRect();
    const drawer = document.querySelector(".trip-home-action-surface").getBoundingClientRect();
    return { mainLeft: main.left, mainRight: main.right, drawerLeft: drawer.left };
  });
  check(
    boxes.drawerLeft > boxes.mainLeft &&
      boxes.drawerLeft < boxes.mainRight &&
      (await itinerary.getByText("Sydney Opera House", { exact: true }).count()) === 1,
    "desktop Itinerary drawer covers the rail and leaves the main column visible",
    boxes,
  );
  await page.keyboard.press("Escape");
  await itinerary.waitFor({ state: "hidden" });
  check(
    (await page.evaluate(() => document.activeElement?.textContent?.includes("Itinerary"))) ===
      true,
    "Escape closes the drawer and restores focus to its card",
  );

  await action(page, /^Ideas/).click();
  const ideas = dialog(page, "Ideas");
  await ideas.waitFor();
  check(
    (await ideas.getByText("Surry Hills bakery", { exact: true }).count()) === 1 &&
      (await ideas.getByText("Art Gallery", { exact: true }).count()) === 1,
    "Ideas lists unscheduled activities",
  );
  await action(page, /^Bookings/).focus();
  await page.keyboard.press("Enter");
  const bookings = dialog(page, "Bookings");
  await bookings.waitFor();
  check(
    (await dialog(page, "Ideas").count()) === 0 &&
      (await bookings.getByText("Sydney Opera House", { exact: true }).count()) === 1,
    "a second action replaces the first drawer and Bookings lists booked activities",
  );
  await page.locator(".trip-home-action-backdrop").click({ position: { x: 20, y: 20 } });
  await bookings.waitFor({ state: "hidden" });

  await action(page, /^Trip preferences/).click();
  const preferences = dialog(page, "Trip preferences");
  await preferences.waitFor();
  check(
    (await preferences.getByText("Quiet mornings", { exact: true }).count()) >= 1 &&
      (await preferences.getByText("Seafood", { exact: true }).count()) >= 1,
    "Trip preferences surface belongs to this Trip",
  );
  await preferences.getByRole("button", { name: /Close/ }).click();

  await action(page, "Calendar").click();
  const calendar = dialog(page, "Calendar");
  await calendar.waitFor();
  check(
    /November\s+2030/.test(await calendar.innerText()) &&
      (await calendar.getByText("Sydney Opera House", { exact: true }).count()) >= 1,
    "Calendar is a read-only view of this Trip's month and activity",
  );
  await calendar.getByRole("button", { name: /14 November 2030/i }).click();
  await dialog(page, "Itinerary").waitFor();
  const mapDay = await page.locator(".trip-home__map").getAttribute("data-day");
  check(mapDay === "1", "choosing a calendar date focuses the map on that day", mapDay);
  check(
    (await dialog(page, "Calendar").count()) === 0,
    "choosing a calendar date replaces Calendar with Itinerary",
  );
  await page.keyboard.press("Escape");

  const before = await stored(page);
  const box = home(page).getByRole("textbox", { name: "New chat" });
  await box.fill("Find a quiet dinner");
  await home(page).getByRole("button", { name: "Start chat" }).click();
  await page.locator(".composer textarea").waitFor();
  await page.waitForFunction(
    (count) =>
      JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").conversations
        ?.length === count,
    before.conversations.length + 1,
  );
  check(
    (await page.locator(".composer textarea").inputValue()) === "Find a quiet dinner" &&
      (await home(page).count()) === 1,
    "sending from Trip home opens a new Chat without leaving Trip home",
  );
  const after = await stored(page);
  const linked = after.conversations.filter((item) => item.tripId === "trip:sydney-action-rail");
  check(
    after.conversations.length === before.conversations.length + 1 &&
      linked.length === 3 &&
      after.trips.length === before.trips.length &&
      after.trips[0].conversationIds.includes(after.activeConversationId),
    "the new Chat is stored under the same Trip",
    { before: before.conversations.length, after: linked.length },
  );
  check((await noOverflow(page)) <= 0, "desktop layout has no horizontal overflow");
  await page.screenshot({ path: `${OUT}/new-chat-1440-en.png` });
  check(
    desktop.errors.length === 0,
    "desktop journey has no page or console errors",
    desktop.errors,
  );
  await desktop.context.close();

  const phone = await open("en", { width: 390, height: 844 }, true);
  await phone.page.locator(".phone-tabbar").waitFor();
  await openHome(phone.page);
  const phoneOrder = await phone.page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().top;
    return {
      actions: rect(".trip-home__actions"),
      chats: rect(".trip-home__main .trip-home-chats"),
      map: rect(".trip-home__map"),
      composer: rect(".trip-home__main .trip-home-chats__box"),
    };
  });
  check(
    phoneOrder.actions < phoneOrder.chats &&
      phoneOrder.chats < phoneOrder.map &&
      phoneOrder.map < phoneOrder.composer,
    "phone order is actions, Chats, map and composer",
    phoneOrder,
  );
  await action(phone.page, /^Itinerary/).click();
  const phoneDialog = dialog(phone.page, "Itinerary");
  await phoneDialog.waitFor();
  const phoneDrawer = await phoneDialog.boundingBox();
  check(
    phoneDrawer &&
      Math.abs(phoneDrawer.x) <= 1 &&
      Math.abs(phoneDrawer.width - 390) <= 1 &&
      Math.abs(phoneDrawer.height - 844) <= 1,
    "the phone action drawer fills the screen",
    phoneDrawer,
  );
  check((await noOverflow(phone.page)) <= 0, "phone layout has no horizontal overflow");
  await phone.page.screenshot({ path: `${OUT}/drawer-390-en.png` });
  check(phone.errors.length === 0, "phone journey has no page or console errors", phone.errors);
  await phone.context.close();

  const zh = await open("zh", { width: 1024, height: 900 });
  await openHome(zh.page, "zh");
  check(
    (await home(zh.page).getByRole("list", { name: "行程操作" }).count()) === 1 &&
      (await home(zh.page).getByRole("button", { name: /行程/ }).count()) >= 1,
    "Chinese desktop/tablet exposes translated Trip actions without overflow",
  );
  check((await noOverflow(zh.page)) <= 0, "tablet layout has no horizontal overflow");
  await zh.page.screenshot({ path: `${OUT}/home-1024-zh.png` });
  check(zh.errors.length === 0, "Chinese journey has no page or console errors", zh.errors);
  await zh.context.close();
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
