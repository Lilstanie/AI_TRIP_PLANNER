import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-calendar", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const tripId = "cross-year-calendar";
const dates = ["2030-12-27", "2031-01-05"];
const placeFor = (text) => {
  const hash = [...text].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    id: `fixture-${encodeURIComponent(text)}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW`,
    location: { latitude: -33.85 - (hash % 100) / 1000, longitude: 151.2 + (hash % 70) / 1000 },
  };
};
const activity = (id, day, location, detail, startTime, endTime) => ({
  id,
  kind: "activity",
  day,
  location,
  detail,
  placeId: placeFor(location).id,
  ...(startTime && endTime ? { startTime, endTime } : {}),
});
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
  estTotal: 1800,
  overrunPct: -60,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "A cross-year Sydney trip",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "A cross-year Sydney trip",
        items: [
          activity("walk-early", 4, "Harbour walk", "Early overlap", "09:00", "11:00"),
          activity("walk-late", 4, "Harbour walk", "Late overlap", "10:00", "12:00"),
          activity("markets", 5, "Midnight Markets", "Evening street food"),
          activity("swim", 6, "New Year swim", "First swim of 2031", "08:00", "09:00"),
          {
            id: "unscheduled",
            kind: "activity",
            location: "Unscheduled idea",
            detail: "Should stay in Ideas",
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
      summary: "Return flights",
      estCost: 800,
      proposal: {
        agent: "transport",
        summary: "Return flights",
        items: [
          {
            id: "flight-item",
            selectionId: "flight-selection",
            kind: "flight",
            day: 1,
            location: "MEL to SYD",
            detail: "Qantas · returning 2031-01-05",
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
            candidates: [{ id: "qantas", carrier: "Qantas", price: 800 }],
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
      summary: "Cross-year stay",
      estCost: 800,
      proposal: {
        agent: "accommodation",
        summary: "Cross-year stay",
        items: [],
        stays: [
          {
            id: "stay-selection",
            city: "Sydney",
            checkIn: "2030-12-28",
            checkOut: "2031-01-02",
            day: 2,
            nights: 5,
            rooms: 1,
            selectedId: "harbour-hotel",
            candidates: [
              {
                id: "harbour-hotel",
                name: "Harbour Hotel",
                area: "Circular Quay",
                pricePerNight: 160,
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
  id: "conversation:cross-year-calendar",
  title: "Cross-year Sydney",
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
      title: "Cross-year Sydney",
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

async function open({ language = "en", timezoneId = "Australia/Sydney", viewport } = {}) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId,
  });
  await context.addInitScript(
    ({ fixture, language }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(fixture));
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
    { fixture: catalog, language },
  );
  const page = await context.newPage();
  const errors = [];
  current = page;
  currentErrors = errors;
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    await route.fulfill({ json: { places: [placeFor(text)] } });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    const name = decodeURIComponent(placeId).replace(/^fixture-/, "");
    await route.fulfill({ json: { place: { ...placeFor(name), id: placeId } } });
  });
  await page.route("**/api/trip/preview-edit", async (route) => {
    try {
      const response = await route.fetch();
      const json = await response.json();
      await route.fulfill({ response, json });
    } catch {
      await route.abort().catch(() => undefined);
    }
  });
  await page.route(/^(?!http:\/\/localhost|http:\/\/127\.0\.0\.1).*/, (route) => route.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if ((viewport?.width ?? 1440) <= 520) {
    await page.locator(".phone-tabbar").waitFor();
    await page
      .locator(".phone-tabbar")
      .getByRole("tab", { name: language === "zh" ? "我的" : "Mine", exact: true })
      .click();
    await page.locator(".phone-mine .trip-card").first().click();
  } else {
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
      .click();
    await page.locator(".trip-cards .trip-card").first().click();
  }
  await page.locator(".trip-home").waitFor();
  return { context, page, errors };
}

const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const calendar = (page, language = "en") => dialog(page, language === "zh" ? "日历" : "Calendar");
const openCalendar = async (page, language = "en") => {
  await page.locator('[data-card="calendar"]').click();
  const drawer = calendar(page, language);
  await drawer.waitFor();
  const root = drawer.locator(".trip-home-calendar");
  await root.waitFor();
  await root.locator(".trip-home-calendar__date").first().waitFor();
  await drawer
    .getByRole("button", { name: language === "zh" ? /年/ : /20\d{2}/ })
    .first()
    .waitFor();
  return drawer;
};
const closeDrawer = async (page) => {
  await page.locator('[role="dialog"][aria-modal="true"] .drawer__close').click();
  await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: "hidden" });
};
const selectedDate = (scope, name) =>
  scope.getByRole("button", { name: new RegExp(`^${name}`) }).first();
const activityButton = (scope, id) => scope.locator(`[data-activity-id="${id}"]`);
const changeTime = async (scope, row, start, end) => {
  await row.getByRole("button", { name: /^Change time/ }).click();
  await scope
    .getByLabel(/^Start/)
    .first()
    .fill(start);
  await scope.getByLabel(/^End/).first().fill(end);
  await scope.getByRole("button", { name: "Change time", exact: true }).click();
};
const openConversationTrip = async (page) => {
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: "Cross-year Sydney" })
    .first()
    .locator(".history-item__open")
    .click();
  await page.locator(".workspace-shell").waitFor();
  const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.locator(".trip-workspace .trip-panel").waitFor();
};

try {
  browser = await chromium.launch({ headless: true });
  const { context, page } = await open();
  let calendarDrawer = await openCalendar(page);

  check(
    (await calendarDrawer.locator('[data-view="week"]').count()) === 1,
    "Calendar opens in week view by default",
  );
  check(
    (await calendarDrawer
      .getByRole("button", { name: "Week", exact: true })
      .getAttribute("aria-pressed")) === "true",
    "Week is the explicit default view control",
  );
  check(
    (await calendarDrawer.locator(".trip-home-calendar__week-day").count()) === 7,
    "the week surface renders seven day columns",
  );
  check(
    (await calendarDrawer.getByRole("button", { name: /^27 December 2030/ }).count()) === 1 &&
      (await calendarDrawer.getByRole("button", { name: /^26 December 2030/ }).count()) === 0,
    "the first Trip week keeps its literal UTC start date",
  );
  check(
    (await activityButton(calendarDrawer, "walk-early").count()) === 1 &&
      (await activityButton(calendarDrawer, "walk-late").count()) === 1,
    "both overlapping activities are present and independently operable",
  );
  check(
    (await activityButton(calendarDrawer, "walk-early").getAttribute("data-overlap")) === "true" &&
      (await activityButton(calendarDrawer, "walk-late").getAttribute("data-overlap")) === "true",
    "overlapping activities are marked as an overlap rather than collapsed",
  );
  check(
    (await activityButton(calendarDrawer, "markets").getAttribute("data-time")) === "untimed" &&
      (await calendarDrawer.getByText("Untimed", { exact: true }).count()) >= 1 &&
      (await calendarDrawer.getByText("All day", { exact: true }).count()) >= 1,
    "an untimed activity is explicit in the All day region",
  );
  check(
    (await calendarDrawer.locator('[data-row-type="stay"]').first().getByText("All day").count()) >
      0,
    "an overnight stay is explicit as an All day region",
  );
  check(
    (await calendarDrawer.getByText("Unscheduled idea", { exact: true }).count()) === 0,
    "calendar projection keeps unscheduled Ideas out of Trip dates",
  );
  check(
    (await activityButton(calendarDrawer, "walk-early").getAttribute("draggable")) !== "true",
    "calendar activities are not drag-to-reschedule handles",
  );
  const defaultPanel = await page.evaluate(() => {
    const drawer = document.querySelector(".trip-home-action-surface").getBoundingClientRect();
    const main = document.querySelector(".trip-home__main").getBoundingClientRect();
    return { drawerWidth: drawer.width, mainWidth: main.width, viewport: innerWidth };
  });
  check(
    defaultPanel.mainWidth > 0 && defaultPanel.drawerWidth < defaultPanel.viewport,
    "Calendar is usable inside the default side panel",
    defaultPanel,
  );

  await selectedDate(calendarDrawer, "30 December 2030").click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  check(
    (await page.locator(".trip-home__map").getAttribute("data-day")) === "4" &&
      (await itinerary.getByRole("tab", { name: /^Day 4/ }).getAttribute("aria-selected")) ===
        "true",
    "choosing a Trip date focuses the same day in map and Itinerary",
  );
  await closeDrawer(page);

  calendarDrawer = await openCalendar(page);
  check(
    (await calendarDrawer.locator('[data-selected-day="4"]').count()) === 1 &&
      (await selectedDate(calendarDrawer, "30 December 2030").getAttribute("aria-pressed")) ===
        "true",
    "selected Trip day survives closing and reopening Calendar",
  );
  await calendarDrawer.getByRole("button", { name: "Month", exact: true }).click();
  check(
    (await calendarDrawer.locator('[data-view="month"]').count()) === 1 &&
      (await calendarDrawer.locator('[data-selected-day="4"]').count()) === 1,
    "switching to Month preserves the selected Trip day",
  );
  check(
    (await selectedDate(calendarDrawer, "30 December 2030").getAttribute("aria-pressed")) ===
      "true",
    "the preserved selected day remains exposed in Month",
  );
  await calendarDrawer.getByRole("button", { name: "Next month", exact: true }).click();
  check(
    (await calendarDrawer.getByRole("button", { name: /^1 January 2031/ }).count()) === 1 &&
      (await calendarDrawer.locator('[data-selected-day="4"]').count()) === 1,
    "Trip-local month navigation crosses into January without changing the selected day",
  );
  await calendarDrawer.getByRole("button", { name: "Week", exact: true }).click();
  check(
    (await calendarDrawer.locator('[data-view="week"]').count()) === 1 &&
      (await selectedDate(calendarDrawer, "30 December 2030").getAttribute("aria-pressed")) ===
        "true" &&
      (await calendarDrawer.getByRole("button", { name: /^1 January 2031/ }).count()) === 1,
    "switching back to Week restores the same selected cross-year date",
  );
  check(
    (await calendarDrawer
      .getByRole("button", { name: "Previous week", exact: true })
      .isEnabled()) === true &&
      (await calendarDrawer
        .getByRole("button", { name: "Next week", exact: true })
        .isDisabled()) === true &&
      (await selectedDate(calendarDrawer, "30 December 2030").getAttribute("aria-pressed")) ===
        "true",
    "Week view for the selected cross-year day starts on the last Trip week with Next disabled",
  );
  await calendarDrawer.getByRole("button", { name: "Previous week", exact: true }).click();
  await calendarDrawer.getByRole("button", { name: /^27 December 2030/ }).waitFor();
  check(
    (await calendarDrawer
      .getByRole("button", { name: "Previous week", exact: true })
      .isDisabled()) === true &&
      (await calendarDrawer.getByRole("button", { name: "Next week", exact: true }).isEnabled()) ===
        true &&
      (await calendarDrawer.locator('[data-selected-day="4"]').count()) === 1 &&
      (await calendarDrawer.getByRole("button", { name: /^27 December 2030/ }).count()) === 1,
    "Previous week moves to the Trip start week, keeps the selected day, and disables Previous",
  );
  await calendarDrawer.getByRole("button", { name: "Next week", exact: true }).click();
  check(
    (await calendarDrawer.getByRole("button", { name: "Next week", exact: true }).isDisabled()) ===
      true &&
      (await selectedDate(calendarDrawer, "30 December 2030").getAttribute("aria-pressed")) ===
        "true" &&
      (await calendarDrawer.getByRole("button", { name: /^3 January 2031/ }).count()) === 1 &&
      (await calendarDrawer.getByRole("button", { name: /^6 January 2031/ }).count()) === 0,
    "Next week returns to the last Trip week without inventing a later date",
  );

  await activityButton(calendarDrawer, "walk-late").click();
  await itinerary.waitFor();
  const selectedStop = itinerary.locator(".timeline-stop.is-selected");
  check(
    (await selectedStop.count()) === 1 &&
      (await selectedStop.getByRole("button", { name: "Change time, 10:00–12:00" }).count()) === 1,
    "clicking a duplicate-named activity resolves its stable id and opens that editor stop",
  );
  await changeTime(itinerary, selectedStop, "12:30", "13:30");
  const editedTime = selectedStop.getByRole("button", {
    name: "Change time, 12:30–13:30",
    exact: true,
  });
  await editedTime.waitFor();
  await itinerary.getByRole("button", { name: "Undo last change" }).waitFor();
  check(
    (await editedTime.count()) === 1,
    "the shared itinerary editor applies the edited time",
    await selectedStop.innerText(),
  );
  await closeDrawer(page);

  calendarDrawer = await openCalendar(page);
  const editedCalendarLabel = await activityButton(calendarDrawer, "walk-late").getAttribute(
    "aria-label",
  );
  check(
    editedCalendarLabel?.includes("12:30–13:30") === true,
    "Calendar reflects the shared Plan edit",
    editedCalendarLabel,
  );
  await activityButton(calendarDrawer, "walk-late").click();
  const afterCalendar = dialog(page, "Itinerary");
  await afterCalendar.getByRole("button", { name: "Undo last change" }).click();
  await afterCalendar
    .locator(".timeline-stop.is-selected")
    .getByRole("button", { name: "Change time, 10:00–12:00" })
    .waitFor();
  check(true, "Undo restores the previous shared Plan time");
  await closeDrawer(page);
  check(
    (await page.locator(".trip-home__map").getAttribute("data-day")) === "4",
    "Undo keeps Calendar selection aligned with the home map day",
  );

  calendarDrawer = await openCalendar(page);
  const restoredCalendarLabel = await activityButton(calendarDrawer, "walk-late").getAttribute(
    "aria-label",
  );
  check(
    restoredCalendarLabel?.includes("10:00–12:00") === true,
    "Calendar reflects Undo immediately",
    restoredCalendarLabel,
  );
  check(
    (await activityButton(calendarDrawer, "markets").getAttribute("data-time")) === "untimed",
    "Undo preserves unrelated untimed activities",
  );
  await closeDrawer(page);

  await openConversationTrip(page);
  const workspace = page.getByRole("region", { name: "Your trip" });
  check(
    (await workspace.getByRole("tab", { name: /^Day 4/ }).getAttribute("aria-selected")) === "true",
    "the conversation Trip entry preserves the Calendar selected day",
  );
  check(
    (await workspace.locator(".timeline-stop").filter({ hasText: "Harbour walk" }).count()) === 2 &&
      (await workspace
        .locator(".timeline-stop")
        .filter({ hasText: "Harbour walk" })
        .getByRole("button", { name: "Change time, 10:00–12:00", exact: true })
        .count()) === 1,
    "the conversation Trip entry reflects the Calendar edit and Undo by stable activity identity",
  );

  const unexpectedErrors = currentErrors.filter(
    (message) => !/Failed to load resource: net::ERR_FAILED/.test(message),
  );
  check(
    unexpectedErrors.length === 0,
    "Calendar journey has no unexpected page or console errors",
    unexpectedErrors,
  );
  await page.screenshot({ path: `${OUT}/desktop-en-sydney.png` });
  await context.close();

  const west = await open({ timezoneId: "America/Los_Angeles" });
  calendarDrawer = await openCalendar(west.page);
  const westernState = await calendarDrawer.locator(".trip-home-calendar").evaluate((node) => ({
    selectedDate: node.getAttribute("data-selected-date"),
    text: node.textContent,
    weekDays: node.querySelectorAll(".trip-home-calendar__week-day").length,
    dateButtons: node.querySelectorAll(".trip-home-calendar__date").length,
  }));
  const westernDateLabels = await calendarDrawer.locator(".trip-home-calendar__date").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")).filter(Boolean),
  );
  await calendarDrawer.getByRole("button", { name: /^27 December 2030/ }).waitFor();
  await calendarDrawer.getByRole("button", { name: /^2 January 2031/ }).waitFor();
  check(
    westernState.selectedDate === "2030-12-27" &&
      westernDateLabels.includes("27 December 2030") &&
      westernDateLabels.includes("2 January 2031") &&
      (await calendarDrawer.getByRole("button", { name: /^27 December 2030/ }).count()) === 1 &&
      (await calendarDrawer.getByRole("button", { name: /^2 January 2031/ }).count()) === 1,
    "a western browser time zone does not shift Trip date labels",
    { westernDateLabels, westernState },
  );
  await west.page.screenshot({ path: `${OUT}/desktop-en-western.png` });
  await west.context.close();

  const zh = await open({
    language: "zh",
    timezoneId: "Australia/Sydney",
    viewport: { width: 390, height: 844 },
  });
  calendarDrawer = await openCalendar(zh.page, "zh");
  check(
    (await calendarDrawer
      .getByRole("button", { name: "周", exact: true })
      .getAttribute("aria-pressed")) === "true" &&
      (await calendarDrawer.getByRole("button", { name: "月", exact: true }).count()) === 1,
    "Chinese Calendar exposes localized Week and Month controls",
  );
  check(
    (await calendarDrawer.getByText("全天", { exact: true }).count()) >= 1 &&
      (await calendarDrawer.getByText("未定时间", { exact: true }).count()) >= 1,
    "Chinese all-day and untimed labels are explicit",
  );
  check(
    (await calendarDrawer.getByRole("button", { name: /^2030年12月27日/ }).count()) === 1,
    "Chinese date labels keep the literal Trip date",
  );
  check(
    (await zh.page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "phone Calendar has no horizontal page overflow",
  );
  const phoneButtons = await calendarDrawer
    .locator("[data-activity-id], .trip-home-calendar__date")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
  check(
    phoneButtons.every((box) => box.width >= 44 && box.height >= 44),
    "phone date and activity controls retain at least 44px hit areas",
    phoneButtons,
  );
  await zh.page.screenshot({ path: `${OUT}/phone-zh.png` });
  await zh.context.close();
} catch (error) {
  check(false, "Calendar journey completes", String(error));
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser?.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        fixture:
          "local cross-year catalog; mock place and edit services; Australia/Sydney and America/Los_Angeles",
        results,
      },
      null,
      2,
    ),
  );
}

process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
