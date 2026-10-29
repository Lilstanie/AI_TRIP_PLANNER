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
const newerSnapshot = snapshotFor("sydney-family", "Family plan marker");
newerSnapshot.savedAt = "2026-10-29T01:00:00Z";
newerSnapshot.draft.preferences = ["Late breakfast"];
newerSnapshot.plan.sections[0].proposal.items = items.map((item) =>
  item.id === "opera" ? { ...item, location: "Newer chat Opera House" } : item,
);
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
    snapshot: newerSnapshot,
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

async function restoredBlank(page) {
  await page.waitForFunction((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return (
      value &&
      !value.activeTripId &&
      value.conversations.some((chat) => chat.id === value.activeConversationId && !chat.tripId)
    );
  }, "trip-workspace-catalog-v3");
}

async function open(language, viewport, phone = false, createContext) {
  const options = {
    viewport,
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  };
  const context = await (createContext ? createContext(options) : browser.newContext(options));
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
  await restoredBlank(page);
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
  let before;
  const mine = page.getByRole("tab", { name: /^(Mine|我的)$/ });
  if (await mine.isVisible()) {
    await mine.click();
    before = await stored(page);
    await page.locator(".phone-mine .trip-card").first().click();
  } else {
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
      .click();
    before = await stored(page);
    await page.locator(".trip-cards .trip-card").first().click();
  }
  await home(page).waitFor();
  const after = await stored(page);
  check(
    !before ||
      (after.activeConversationId === before.activeConversationId &&
        after.activeTripId === before.activeTripId),
    "opening Trip home preserves the stored active Chat and Trip",
  );
}

async function openResponsiveHome(page, width) {
  if (width <= 520) {
    await page.getByRole("tab", { name: "Mine" }).click();
    await page.locator(".phone-mine .trip-card").first().click();
  } else if (width <= 1000) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: /^Trips/ }).click();
    await page.locator(".trip-cards .trip-card").first().click();
  } else {
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: /^Trips/ })
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
  check(
    (await action(page, /^Ideas/).innerText()).includes("2 ideas"),
    "the Ideas count uses the same activity selector as the drawer",
    await action(page, /^Ideas/).innerText(),
  );
  const chatNames = await chats(page).getByRole("button").allInnerTexts();
  check(
    chatNames.some((name) => name.includes("Food ideas")) &&
      chatNames.some((name) => name.includes("Family plan")),
    "the centre lists every Chat linked to the Trip",
    chatNames,
  );
  const suggestion = home(page).getByRole("region", { name: "Trip suggestion" });
  check(
    (await suggestion.count()) === 1 &&
      (await suggestion.innerText()).includes("2 unscheduled ideas") &&
      (await suggestion.innerText()).includes("Sydney"),
    "the suggestion reflects the current Plan",
  );
  await suggestion.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.locator(".composer textarea").waitFor();
  const suggestedInput = await page.locator(".composer textarea").inputValue();
  check(
    suggestedInput.includes("2 unscheduled ideas") && suggestedInput.includes("Sydney"),
    "choosing a suggestion carries a Plan-aware prompt into a linked Chat",
    suggestedInput,
  );
  await page.getByRole("button", { name: "Back to trip home" }).click();
  await suggestion.getByRole("button", { name: "Dismiss", exact: true }).click();
  check(
    (await home(page).getByRole("region", { name: "Trip suggestion" }).count()) === 0,
    "a suggestion can be dismissed",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await restoredBlank(page);
  await page.locator(".save-state--saved").waitFor();
  await openHome(page);
  check(
    (await home(page).getByRole("region", { name: "Trip suggestion" }).count()) === 0,
    "suggestion dismissal survives reload",
  );
  await page.evaluate(() => {
    const key = "trip-workspace-catalog-v3";
    const value = JSON.parse(localStorage.getItem(key));
    value.trips[0].snapshot.plan.round += 1;
    value.trips[0].snapshot.plan.sections[0].proposal.items[0].detail = "Updated guided tour";
    localStorage.setItem(key, JSON.stringify(value));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await restoredBlank(page);
  await openHome(page);
  await suggestion.waitFor();
  check(
    (await home(page).getByRole("region", { name: "Trip suggestion" }).count()) === 1,
    "a changed Plan makes the suggestion eligible again",
  );

  await chats(page)
    .getByRole("button", { name: /Family plan/ })
    .click();
  await page.getByText("Family plan marker", { exact: true }).waitFor();
  await action(page, /^Itinerary/).click();
  await dialog(page, "Itinerary").waitFor();
  const newerPlanText = await dialog(page, "Itinerary").innerText();
  check(
    (await dialog(page, "Itinerary")
      .getByText("Newer chat Opera House", { exact: true })
      .count()) === 1 &&
      (await dialog(page, "Itinerary").getByText("Sydney Opera House", { exact: true }).count()) ===
        0,
    "Trip actions display the selected Chat's newer Plan snapshot",
    newerPlanText,
  );
  await page.keyboard.press("Escape");
  await action(page, /^Trip preferences/).click();
  await dialog(page, "Trip preferences").waitFor();
  const newerDraftText = await dialog(page, "Trip preferences").innerText();
  check(
    (await dialog(page, "Trip preferences")
      .getByText("Late breakfast", { exact: true })
      .count()) === 1 &&
      (await dialog(page, "Trip preferences")
        .getByText("Quiet mornings", { exact: true })
        .count()) === 0,
    "Trip preferences edit the same newer Chat snapshot",
    newerDraftText,
  );
  await page.keyboard.press("Escape");
  const resizer = page.getByRole("separator", { name: "Resize chat and map" });
  await resizer.focus();
  const shareBefore = await resizer.getAttribute("aria-valuenow");
  await page.keyboard.press("ArrowRight");
  check(
    (await resizer.getAttribute("aria-valuenow")) !== shareBefore,
    "an open Trip Chat retains the adjustable chat and map split",
  );
  check(
    (await home(page).count()) === 1 &&
      (await actions(page).isVisible()) &&
      (await page.getByRole("button", { name: "Back to trip home" }).isVisible()),
    "opening a Trip Chat keeps Trip home and the action rail in place",
  );
  await page.keyboard.press("End");
  await action(page, /^Itinerary/).click();
  await dialog(page, "Itinerary").waitFor();
  const resized = await page.evaluate(() => {
    const rail = document.querySelector(".trip-home__aside").getBoundingClientRect();
    const drawer = document.querySelector(".trip-home-action-surface").getBoundingClientRect();
    return {
      railLeft: rail.left,
      drawerLeft: drawer.left,
      railWidth: rail.width,
      drawerWidth: drawer.width,
    };
  });
  check(
    Math.abs(resized.drawerLeft - resized.railLeft) <= 20 &&
      resized.drawerWidth <= resized.railWidth,
    "the action drawer follows the rail at the maximum Chat split",
    resized,
  );
  await page.keyboard.press("Escape");
  await resizer.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: `${OUT}/chat-with-rail-1440-en.png` });
  await page.getByRole("button", { name: "Back to trip home" }).click();
  await chats(page).waitFor();

  await action(page, /^Itinerary/).click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  await itinerary.getByRole("heading", { name: /16 Nov/ }).waitFor();
  await itinerary.getByRole("button", { name: /Day 3 .*16 Nov/ }).click();
  check(
    (await itinerary.locator('[data-day="3"][data-selected]').count()) === 1 &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "3",
    "choosing an Itinerary day selects it and focuses the map",
  );
  const boxes = await page.evaluate(() => {
    const main = document.querySelector(".trip-home__main").getBoundingClientRect();
    const drawer = document.querySelector(".trip-home-action-surface").getBoundingClientRect();
    const rail = document.querySelector(".trip-home__aside").getBoundingClientRect();
    return {
      mainLeft: main.left,
      mainRight: main.right,
      drawerLeft: drawer.left,
      railLeft: rail.left,
    };
  });
  check(
    boxes.drawerLeft > boxes.mainLeft &&
      Math.abs(boxes.drawerLeft - boxes.railLeft) <= 20 &&
      (await itinerary.getByText("Newer chat Opera House", { exact: true }).count()) === 1,
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
  await action(page, /^Itinerary/).click();
  await itinerary.waitFor();
  await itinerary.getByRole("button", { name: /Close/ }).click();
  await itinerary.waitFor({ state: "hidden" });
  check(
    (await action(page, /^Itinerary/).evaluate((node) => node === document.activeElement)) === true,
    "Close restores focus to its card",
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
      (await bookings.getByText("Newer chat Opera House", { exact: true }).count()) === 1,
    "a second action replaces the first drawer and Bookings lists booked activities",
  );
  await page.locator(".trip-home-action-backdrop").click({ position: { x: 20, y: 20 } });
  await bookings.waitFor({ state: "hidden" });
  check(
    (await action(page, /^Bookings/).evaluate((node) => node === document.activeElement)) === true,
    "outside press restores focus to its card",
  );

  await action(page, /^Trip preferences/).click();
  const preferences = dialog(page, "Trip preferences");
  await preferences.waitFor();
  check(
    (await preferences.getByText("Late breakfast", { exact: true }).count()) === 1,
    "Trip preferences surface belongs to this Trip",
  );
  await preferences.getByRole("button", { name: /Close/ }).click();

  await action(page, "Calendar").click();
  const calendar = dialog(page, "Calendar");
  await calendar.waitFor();
  await calendar.getByText("Newer chat Opera House", { exact: true }).waitFor();
  check(
    /November\s+2030/.test(await calendar.innerText()) &&
      (await calendar.getByText("Newer chat Opera House", { exact: true }).count()) >= 1,
    "Calendar is a read-only view of this Trip's month and activity",
  );
  await calendar.getByRole("button", { name: /16 Nov/i }).click();
  await dialog(page, "Itinerary").waitFor();
  const mapDay = await page.locator(".trip-home__map").getAttribute("data-day");
  check(mapDay === "3", "choosing a calendar date focuses the map on that day", mapDay);
  check(
    (await dialog(page, "Calendar").count()) === 0,
    "choosing a calendar date replaces Calendar with Itinerary",
  );
  const selectedItineraryDay = dialog(page, "Itinerary").locator('[data-day="3"][data-selected]');
  await selectedItineraryDay.waitFor({ state: "visible" });
  await selectedItineraryDay.getByRole("heading", { name: /16 Nov/ }).waitFor({ state: "visible" });
  check(true, "choosing a calendar date exposes the matching Itinerary day");
  check(
    (await dialog(page, "Itinerary").locator('[data-day="3"][data-selected]').count()) === 1,
    "Calendar selection marks the corresponding Itinerary day",
  );
  await page.keyboard.press("Escape");

  const before = await stored(page);
  const box = home(page).getByRole("textbox", { name: "New chat" });
  await box.fill("Find a quiet dinner");
  await home(page).getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".composer textarea").waitFor();
  await page.waitForFunction(
    (count) =>
      JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "{}").conversations
        ?.length === count,
    before.conversations.length + 1,
  );
  check(
    (await page.getByText("Find a quiet dinner", { exact: true }).count()) >= 1 &&
      (await home(page).count()) === 1,
    "sending from Trip home opens a new Chat without leaving Trip home",
  );
  const after = await stored(page);
  const linked = after.conversations.filter((item) => item.tripId === "trip:sydney-action-rail");
  check(
    after.conversations.length === before.conversations.length + 1 &&
      linked.length === 4 &&
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

  const corrupt = await open("en", { width: 1440, height: 1000 });
  await corrupt.page.evaluate(
    (key) => localStorage.setItem(key, "null"),
    "trip-home-suggestion-dismissals-v1",
  );
  await openHome(corrupt.page);
  await corrupt.page.getByRole("region", { name: "Trip suggestion" }).waitFor();
  check(
    (await corrupt.page.getByRole("region", { name: "Trip suggestion" }).count()) === 1 &&
      corrupt.errors.length === 0,
    "a null suggestion-dismissal record degrades safely",
    corrupt.errors,
  );
  await corrupt.context.close();

  const quota = await open("en", { width: 1440, height: 1000 });
  await quota.page.evaluate((key) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return setItem.call(this, name, value);
    };
  }, "trip-home-suggestion-dismissals-v1");
  await openHome(quota.page);
  await quota.page
    .getByRole("region", { name: "Trip suggestion" })
    .getByRole("button", { name: "Dismiss", exact: true })
    .click();
  const quotaStatus = quota.page.getByRole("status", {
    name: "Dismissed for this visit; could not save.",
  });
  await quotaStatus.waitFor();
  check(
    (await quota.page.getByRole("region", { name: "Trip suggestion" }).count()) === 0 &&
      (await quotaStatus.innerText()) === "Dismissed for this visit; could not save." &&
      quota.errors.length === 0,
    "a quota failure dismisses for this visit and reports persistence failure",
    { status: await quotaStatus.innerText(), errors: quota.errors },
  );
  await quota.context.close();

  for (const width of [375, 520, 521, 1000, 1001]) {
    const responsive = await open("en", { width, height: width <= 520 ? 844 : 900 }, width <= 520);
    await openResponsiveHome(responsive.page, width);
    await action(responsive.page, "Calendar").click();
    const responsiveCalendar = dialog(responsive.page, "Calendar");
    await responsiveCalendar.waitFor();
    const responsiveDate = responsiveCalendar.getByRole("button", { name: /16 Nov/i });
    await responsiveDate.waitFor({ state: "visible" });
    check(
      (await noOverflow(responsive.page)) <= 0 && (await responsiveDate.isVisible()),
      `integrated Calendar remains usable at ${width}px`,
    );
    await responsiveDate.click();
    await dialog(responsive.page, "Itinerary").waitFor();
    await dialog(responsive.page, "Itinerary")
      .locator('[data-day="3"][data-selected]')
      .waitFor({ state: "visible" });
    check(
      (await responsive.page.locator(".trip-home__map").getAttribute("data-day")) === "3" &&
        (await noOverflow(responsive.page)) <= 0,
      `Calendar to Itinerary and map works at ${width}px`,
    );
    await responsive.page.keyboard.press("Escape");
    check(
      (await action(responsive.page, "Calendar").evaluate(
        (node) => node === document.activeElement,
      )) === true,
      `closing a responsive drawer restores focus at ${width}px`,
    );
    await responsive.page.screenshot({ path: `${OUT}/itinerary-${width}-en.png` });
    check(responsive.errors.length === 0, `${width}px journey has no browser errors`);
    await responsive.context.close();
  }

  if (process.env.CHANNEL === "chrome") {
    const zoomed = await open("en", { width: 1440, height: 1000 }, false, (options) =>
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
      await action(zoomed.page, "Calendar").click();
      await dialog(zoomed.page, "Calendar").waitFor();
      check(
        (await zoomed.page.evaluate(() => devicePixelRatio)) >= zoom / 100 &&
          (await noOverflow(zoomed.page)) <= 0,
        `${zoom}% actual Chrome zoom keeps Calendar reachable without overflow`,
      );
      await zoomed.page.keyboard.press("Escape");
    }
    check(zoomed.errors.length === 0, "actual Chrome zoom journey has no browser errors");
    await zoomed.context.close();
  }

  const phone = await open("en", { width: 390, height: 844 }, true);
  await phone.page.locator(".phone-tabbar").waitFor();
  await openHome(phone.page);
  await home(phone.page).getByRole("region", { name: "Trip suggestion" }).waitFor();
  check(
    (await home(phone.page).getByRole("region", { name: "Trip suggestion" }).count()) === 1,
    "phone Trip suggestion is mounted before measuring the reading order",
    await phone.page.evaluate(() => ({
      home: document.querySelector(".trip-home")?.innerText,
      dismissals: localStorage.getItem("trip-home-suggestion-dismissals-v1"),
    })),
  );
  const phoneTargets = await phone.page.evaluate(() =>
    [...document.querySelectorAll(".trip-home-suggestion__actions button, .trip-home__back")].map(
      (node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      },
    ),
  );
  check(
    phoneTargets.every((box) => box.width >= 44 && box.height >= 44),
    "phone suggestion actions and Back meet the 44px touch target",
    phoneTargets,
  );
  await chats(phone.page)
    .getByRole("button", { name: /Family plan/ })
    .click();
  const chatBack = phone.page.getByRole("button", { name: "Back to trip home" });
  const chatBackBox = await chatBack.boundingBox();
  check(
    chatBackBox && chatBackBox.width >= 44 && chatBackBox.height >= 44,
    "phone Chat Back meets the 44px touch target",
    chatBackBox,
  );
  await chatBack.click();
  await home(phone.page).getByRole("region", { name: "Trip suggestion" }).waitFor();
  const phoneOrder = await phone.page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().top;
    return {
      suggestion: rect(".trip-home-suggestion"),
      actions: rect(".trip-home__actions"),
      chats: rect(".trip-home__main .trip-home-chats"),
      map: rect(".trip-home__map"),
      composer: rect(".trip-home__main .trip-home__composer"),
    };
  });
  check(
    phoneOrder.suggestion < phoneOrder.actions &&
      phoneOrder.actions < phoneOrder.chats &&
      phoneOrder.chats < phoneOrder.map &&
      phoneOrder.map < phoneOrder.composer,
    "phone order is suggestion, actions, Chats, map and composer",
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
  const phoneItineraryDay = phoneDialog.getByRole("heading", { name: /14 Nov/ });
  await phoneItineraryDay.scrollIntoViewIfNeeded();
  const phoneDayBox = await phoneItineraryDay.boundingBox();
  check(
    phoneDayBox &&
      phoneDayBox.y >= 0 &&
      phoneDayBox.y + phoneDayBox.height <= 844 &&
      (await phoneItineraryDay.isVisible()),
    "phone Itinerary content is visible and scrollable",
    phoneDayBox,
  );
  await phoneItineraryDay.scrollIntoViewIfNeeded();
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
