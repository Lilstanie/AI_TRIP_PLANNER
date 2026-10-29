import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

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
const actions = (page) => home(page).getByRole("list", { name: /^(Trip actions|行程操作)$/ });
const action = (page, name) => actions(page).getByRole("button", { name });
const dialog = (page, name) => page.getByRole("dialog", { name, exact: true });
const panelSwitcher = (page) => page.getByRole("tablist", { name: /^(Trip actions|行程操作)$/ });
const panelTab = (page, name) => panelSwitcher(page).getByRole("tab", { name });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

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

  await home(page)
    .getByRole("list", { name: /^(Chats|聊天)$/ })
    .getByRole("button", { name: /Family plan/ })
    .click();
  await page.getByText("Family plan marker", { exact: true }).waitFor();

  await page.evaluate(() => {
    const main = document.querySelector(".trip-home__main");
    if (main) main.scrollTop = 180;
  });
  const scrolled = await page.evaluate(
    () => document.querySelector(".trip-home__main")?.scrollTop ?? 0,
  );
  check(scrolled >= 160, "Trip home can scroll before opening a panel", scrolled);

  await action(page, /^Itinerary/).click();
  const itinerary = dialog(page, "Itinerary");
  await itinerary.waitFor();
  const initiallyNarrow = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface");
    return {
      expanded: surface?.classList.contains("is-expanded"),
      maps: document.querySelectorAll(".trip-home__map").length,
    };
  });
  check(
    initiallyNarrow?.expanded === false && initiallyNarrow.maps === 1,
    "an action opens in the narrow rail with one map",
    initiallyNarrow,
  );
  const dayTwo = itinerary.getByRole("tab", { name: /^Day 2/ });
  await dayTwo.click();
  check(
    (await dayTwo.getAttribute("aria-selected")) === "true" &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2",
    "selecting an Itinerary day keeps the shared selected day",
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
  check(
    (await dialog(page, "Itinerary").count()) === 0 &&
      (await bookings.getByRole("region", { name: "Flights", exact: true }).count()) === 1 &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2" &&
      (await page.getByRole("button", { name: "Back to trip home" }).count()) === 1,
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

  const expand = dialog(page, "Bookings").getByRole("button", {
    name: "Expand panel",
    exact: true,
  });
  await expand.click();
  const expanded = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface");
    const content = surface?.querySelector(".drawer__body > *:not(.trip-home-action-map)");
    const map = surface?.querySelector(".trip-home-action-map, .trip-home__map");
    if (!surface || !content || !map) return null;
    const surfaceBox = surface.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const mapBox = map.getBoundingClientRect();
    return {
      expanded: surface.classList.contains("is-expanded"),
      sideBySide: Math.abs(contentBox.top - mapBox.top) <= 40 && mapBox.left > contentBox.right - 8,
      width: surfaceBox.width,
      mapWidth: mapBox.width,
      maps: document.querySelectorAll(".trip-home__map").length,
    };
  });
  check(
    expanded?.expanded && expanded.sideBySide && expanded.mapWidth > 200 && expanded.maps === 1,
    "Expand places panel content and the map side by side",
    expanded,
  );

  await panelTab(page, /^Ideas/).click();
  const ideas = dialog(page, "Ideas");
  await ideas.waitFor();
  check(
    (await ideas.getByText("Surry Hills bakery", { exact: true }).count()) === 1 &&
      (await page
        .locator(".trip-home-action-surface")
        .evaluate((element) => element.classList.contains("is-expanded"))) &&
      (await page.locator(".trip-home__map").getAttribute("data-day")) === "2",
    "switching while expanded keeps the expanded layout, Ideas content and selected day",
  );

  await ideas.getByRole("button", { name: "Collapse panel", exact: true }).click();
  const collapsed = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface");
    const rail = document.querySelector(".trip-home__aside");
    if (!surface || !rail) return null;
    const surfaceBox = surface.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    return {
      expanded: surface.classList.contains("is-expanded"),
      coversRail:
        Math.abs(surfaceBox.left - railBox.left) <= 24 && surfaceBox.width <= railBox.width + 24,
    };
  });
  check(
    collapsed?.expanded === false && collapsed.coversRail,
    "Collapse restores the narrow right panel",
    collapsed,
  );

  await panelTab(page, /^Itinerary/).click();
  const collapsedItinerary = dialog(page, "Itinerary");
  await collapsedItinerary.waitFor();
  await collapsedItinerary
    .getByRole("button", { name: "Change time, 10:00–11:00", exact: true })
    .click();
  const afterCollapse = await collapsedItinerary
    .locator("#stop-time-harbour")
    .getByLabel("Start", { exact: true })
    .inputValue();
  check(
    afterCollapse === "10:30" &&
      (await collapsedItinerary
        .getByRole("tab", { name: /^Day 2/ })
        .getAttribute("aria-selected")) === "true",
    "expanding and collapsing keeps the unsubmitted edit and selected day",
    afterCollapse,
  );
  await page.keyboard.press("Escape");
  check(
    (await collapsedItinerary.isVisible()) &&
      (await collapsedItinerary.locator("#stop-time-harbour").count()) === 0,
    "Escape closes the nested time editor before the action panel",
  );
  await page.keyboard.press("Escape");
  await collapsedItinerary.waitFor({ state: "hidden" });
  const restored = await page.evaluate(() => ({
    focus: document.activeElement?.textContent ?? "",
    scroll: document.querySelector(".trip-home__main")?.scrollTop ?? 0,
    day: document.querySelector(".trip-home__map")?.getAttribute("data-day"),
    chat: !!document.querySelector('.trip-home-chat, [aria-label="Chat"]'),
  }));
  check(
    restored.focus.includes("Itinerary") &&
      restored.scroll >= 160 &&
      restored.day === "2" &&
      restored.chat,
    "closing restores focus, scroll, selected day and Chat",
    restored,
  );

  const resizer = page.getByRole("separator", { name: "Resize chat and map" });
  await resizer.focus();
  await page.keyboard.press("End");
  await action(page, /^Calendar/).click();
  await dialog(page, "Calendar").waitFor();
  const extreme = await page.evaluate(() => {
    const surface = document.querySelector(".trip-home-action-surface")?.getBoundingClientRect();
    const rail = document.querySelector(".trip-home__aside")?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      width: surface?.width,
      railWidth: rail?.width,
    };
  });
  check(
    extreme.overflow <= 0 && extreme.width <= (extreme.railWidth ?? 0) + 24,
    "an extreme chat/map split keeps the narrow panel usable without overflow",
    extreme,
  );
  await page.keyboard.press("Escape");
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
      .getByRole("button", { name: "将 Surry Hills bakery 安排到第 1 天", exact: true })
      .count()) === 1,
    "Chinese schedule accessible names come from the translation catalogue",
  );
  check(chinese.errors.length === 0, "Chinese journey has no browser errors", chinese.errors);
  await chinese.context.close();

  for (const width of [375, 520, 521, 1000, 1001]) {
    const responsive = await open("en", { width, height: width <= 520 ? 844 : 900 }, width <= 520);
    await openHome(responsive.page, "en", width);
    await action(responsive.page, /^Itinerary/).click();
    const panel = dialog(responsive.page, "Itinerary");
    await panel.waitFor();
    if (width <= 520) {
      const box = await panel.boundingBox();
      check(
        box &&
          Math.abs(box.x) <= 1 &&
          Math.abs(box.width - width) <= 1 &&
          (await panel.getByRole("button", { name: "Expand panel" }).count()) === 0,
        `phone panel fills the screen without Expand at ${width}px`,
        box,
      );
      await responsive.page.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      check(
        (await panel.isHidden()) &&
          (await responsive.page
            .locator(".phone-tabbar")
            .getByRole("tab", { name: /^Mine/ })
            .count()) === 0,
        `Escape closes the phone action panel while Trip home keeps phone navigation at ${width}px`,
      );
      await home(responsive.page).getByRole("button", { name: "Back to trips" }).click();
      await responsive.page.locator(".phone-mine").waitFor();
      await responsive.page.locator(".phone-mine__settings").click();
      const settings = responsive.page.getByRole("dialog", { name: "Settings" });
      await settings.waitFor();
      await responsive.page.keyboard.press("Escape");
      await settings.waitFor({ state: "hidden" });
      check(
        (await settings.isHidden()) && (await responsive.page.locator(".phone-mine").isVisible()),
        `Settings keeps its own Escape close path at ${width}px`,
      );
    } else {
      await panelTab(responsive.page, /^Bookings/).click();
      await dialog(responsive.page, "Bookings").waitFor();
      check(true, `in-panel switching works at ${width}px`);
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
