import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-walkthrough", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
let profileName = "";
const check = (ok, name, observed) => {
  const label = `${profileName}: ${name}`;
  results.push({ ok: Boolean(ok), name: label, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-05T00:00:00Z";
const stop = (id, day, startTime, location) => ({
  id,
  kind: "activity",
  day,
  startTime,
  endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  location,
  detail: location,
});
const makeTrip = ({
  id,
  destination,
  dates,
  groupSize,
  budgetTotal,
  preferences,
  stops,
  chats,
}) => {
  const brief = { tripId: id, userId: "local", destination, dates, groupSize, budgetTotal };
  const snapshotWith = (items, stamp, message) => ({
    version: 3,
    id,
    savedAt: stamp,
    draft: {
      destination,
      origin: "",
      start: dates[0],
      end: dates[1],
      groupSize: String(groupSize),
      budgetTotal: String(budgetTotal),
      preferences,
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: message ? [{ role: "user", text: message }] : [],
    input: "",
    plan: {
      tripId: id,
      brief,
      round: 1,
      budgetTotal,
      estTotal: 900,
      overrunPct: -50,
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
  const conversations = chats.map(({ key, title, updatedAt, stale }) => {
    const snapshot = {
      ...snapshotWith(stale ? [] : stops, updatedAt, `${title} marker`),
      id: `${id}-${key}`,
    };
    return {
      id: `conversation:${id}-${key}`,
      title,
      renamed: true,
      updatedAt,
      tripId: `trip:${id}`,
      messages: snapshot.messages,
      input: "",
      snapshot,
    };
  });
  return {
    trip: {
      id: `trip:${id}`,
      title: `Trip to ${destination}`,
      updatedAt: "2026-10-27T00:00:00Z",
      conversationIds: conversations.map((item) => item.id),
      snapshot: snapshotWith(stops, "2026-10-27T00:00:00Z", ""),
    },
    conversations,
  };
};
const sydney = makeTrip({
  id: "sydney",
  destination: "Sydney",
  dates: ["2030-11-14", "2030-11-17"],
  groupSize: 2,
  budgetTotal: 4500,
  preferences: ["Quiet mornings", "Vegetarian", "No long drives"],
  stops: [stop("Opera", 1, "09:00", "Opera House"), stop("Bridge", 1, "11:00", "Harbour Bridge")],
  chats: [
    { key: "a", title: "Sydney chat", updatedAt: "2026-10-26T00:00:00Z" },
    { key: "b", title: "Harbour ideas", updatedAt: "2026-10-10T00:00:00Z", stale: true },
  ],
});
const melbourne = makeTrip({
  id: "melbourne",
  destination: "Melbourne",
  dates: ["2030-11-05", "2030-11-07"],
  groupSize: 1,
  budgetTotal: 1200,
  preferences: [],
  stops: [],
  chats: [{ key: "a", title: "Melbourne chat", updatedAt: "2026-10-25T00:00:00Z" }],
});
const hobart = makeTrip({
  id: "hobart",
  destination: "Hobart",
  dates: ["2030-11-20", "2030-11-22"],
  groupSize: 3,
  budgetTotal: 3000,
  preferences: [],
  stops: [],
  chats: [],
});
const entries = [sydney, melbourne, hobart];
const catalog = {
  version: 4,
  activeConversationId: sydney.conversations[0].id,
  activeTripId: sydney.trip.id,
  trips: entries.map(({ trip }) => trip),
  conversations: entries.flatMap(({ conversations }) => conversations),
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

const placeFor = (text) => ({
  id: `stub:${text}`,
  displayName: { text },
  formattedAddress: `${text}, Sydney NSW, Australia`,
  location: { latitude: -33.8568, longitude: 151.2153 },
  googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(text)}`,
});

const LABELS = {
  en: {
    trips: /^Trips/,
    chats: /^Chats/,
    mine: /^Mine/,
    back: "Back to trips",
    tripsHeading: "Your trips",
    calendarTab: "Calendar",
    tripsTab: "Trips",
    details: "Trip details",
    sections: "Trip actions",
    map: "Trip map",
    list: "Chats",
    box: "New chat",
    send: "Send",
    rename: "Rename",
    delete: "Delete",
    undo: "Undo",
    itinerary: /^Itinerary(\s+2 stops)?$/,
    preferences: /^Trip preferences(\s+3 preferences)?$/,
    calendar: /^Calendar/,
    tripTab: /^Trip( updated)?$/,
    travellers: "2 travellers",
    traveller: "1 traveller",
  },
  zh: {
    trips: /^行程/,
    chats: /^聊天/,
    mine: /^我的/,
    back: "返回行程",
    tripsHeading: "你的行程",
    calendarTab: "日历",
    tripsTab: "行程",
    details: "行程信息",
    sections: "行程操作",
    map: "行程地图",
    list: "聊天",
    box: "新聊天",
    send: "发送",
    rename: "重命名",
    delete: "删除",
    undo: "撤销",
    itinerary: /^行程概览(\s+2 站点)?$/,
    preferences: /^旅行偏好(\s+3 项偏好)?$/,
    calendar: /^日历/,
    tripTab: /^行程(已更新)?$/,
    travellers: "2 位旅客",
    traveller: "1 位旅客",
  },
};

const PROFILES = [
  { name: "desktop 1440 en", language: "en", viewport: { width: 1440, height: 1000 } },
  { name: "phone 390 en", language: "en", viewport: { width: 390, height: 844 }, phone: true },
  { name: "desktop 1440 zh", language: "zh", viewport: { width: 1440, height: 1000 } },
  { name: "phone 390 zh", language: "zh", viewport: { width: 390, height: 844 }, phone: true },
];

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));
const itemsOf = (snapshot) =>
  snapshot.plan.sections.flatMap((section) => section.proposal?.items ?? []).length;
const profiles = [];
let current;
let currentErrors = [];

async function walk(profile) {
  const L = LABELS[profile.language];
  const { phone } = profile;
  const slug = profile.name.replace(/\s+/g, "-");
  const context = await browser.newContext({
    viewport: profile.viewport,
    reducedMotion: "reduce",
    locale: profile.language === "zh" ? "zh-CN" : "en-AU",
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
    { catalog, settings: settingsFor(profile.language) },
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

  const home = page.locator(".trip-home");
  const heading = home.getByRole("heading", { level: 1 });
  const cardsList = home.getByRole("list", { name: L.sections });
  const tripCard = (name) =>
    page
      .locator(phone ? ".phone-mine .trip-card" : ".trip-cards button.trip-card")
      .filter({ has: page.locator(".trip-card__title", { hasText: name }) })
      .first();
  const tripsTabs = page.locator(".trips-page__tabs");
  const rows = home.getByRole("list", { name: L.list }).getByRole("button");
  const rowTitles = async () =>
    (await rows.locator(".trip-home-chats__name").allInnerTexts()).map((text) => text.trim());
  const sectionCard = (name) => cardsList.getByRole("button", { name });
  const leaveHome = async () => {
    if (phone && (await home.count()))
      await home.getByRole("button", { name: L.back, exact: true }).click();
  };
  const goTrips = async () => {
    await leaveHome();
    if (phone) {
      await page.getByRole("tab", { name: L.mine }).click();
      await page.getByRole("searchbox").fill("");
      await tripsTabs.getByRole("tab", { name: L.tripsTab, exact: true }).click();
    } else await page.locator(".sidebar-nav").getByRole("button", { name: L.trips }).click();
  };
  const goHome = async (name) => {
    await goTrips();
    await tripCard(name).click();
    await home.waitFor();
  };
  const goChats = async () => {
    await leaveHome();
    if (phone) {
      await page.getByRole("tab", { name: L.mine }).click();
      await page.locator(".phone-mine").waitFor();
      await tripsTabs.getByRole("tab", { name: L.tripsTab, exact: true }).click();
    } else await page.locator(".sidebar-nav").getByRole("button", { name: L.chats }).click();
  };
  const markers = (name = L.map) =>
    home.getByRole("region", { name, exact: true }).first().locator(".trip-map-marker");
  const settled = async (count) => {
    for (let waited = 0; waited < 15000; waited += 250) {
      if ((await markers().count()) >= count) return true;
      await page.waitForTimeout(250);
    }
    return false;
  };
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const tripsPageShown = async () => {
    if (phone) {
      await page.locator(".phone-mine").waitFor();
      return (
        (await page.getByRole("tab", { name: L.mine }).getAttribute("aria-selected")) === "true"
      );
    }
    await page.getByRole("heading", { name: L.tripsHeading, level: 1 }).waitFor();
    return true;
  };
  const shot = (name) => page.screenshot({ path: `${OUT}/${slug}-${name}.png` });

  await goTrips();
  await page.waitForTimeout(500);

  await tripCard(/Sydney/).click();
  await home.waitFor();
  check(
    /Sydney/.test(await heading.innerText()),
    "the Trips card opens the Trip home with the title as heading",
  );
  const tags = await home.getByRole("list", { name: L.details }).locator("li").allInnerTexts();
  check(
    tags.length === 4 && tags[0] === "Sydney" && tags[2] === L.travellers && /4,500/.test(tags[3]),
    "one line of tags shows destination, dates, travellers and budget",
    tags,
  );
  const labels = (await cardsList.getByRole("button").allInnerTexts()).map((text) =>
    text.replace(/\s+/g, " ").trim(),
  );
  check(
    labels.length === 5 &&
      L.itinerary.test(labels[0]) &&
      L.calendar.test(labels[4]) &&
      L.preferences.test(labels[3]) &&
      /2/.test(labels[0]) &&
      /3/.test(labels[3]),
    "five action cards show the stop and preference counts",
    labels,
  );
  check(
    await settled(2),
    "the map beside or below the page marks the two placed stops",
    await markers().count(),
  );
  check(
    JSON.stringify(await rowTitles()) === JSON.stringify(["Sydney chat", "Harbour ideas"]),
    "the chats of this trip are listed newest first",
    await rowTitles(),
  );
  check((await overflow()) <= 0, "the page does not scroll sideways", await overflow());
  await shot("home");

  await home.getByRole("button", { name: L.back, exact: true }).click();
  check(await tripsPageShown(), "the back button returns to the Trips page");

  const calendarTab = tripsTabs.getByRole("tab", { name: L.calendarTab, exact: true });
  {
    await calendarTab.click();
    await page.locator(".trip-calendar__trip[aria-label*='Melbourne']").first().click();
    await home.waitFor();
    const melbourneTags = await home
      .getByRole("list", { name: L.details })
      .locator("li")
      .allInnerTexts();
    check(
      /Melbourne/.test(await heading.innerText()) && melbourneTags.includes(L.traveller),
      "a calendar band opens the Trip home of that trip",
      melbourneTags,
    );
    await home.getByRole("button", { name: L.back, exact: true }).click();
    check(
      (await tripsPageShown()) && (await calendarTab.getAttribute("aria-selected")) === "true",
      "back from a trip opened on the calendar returns to the Calendar tab",
    );
  }

  await goChats();
  await page.getByRole("searchbox").fill("Sydney");
  await (
    phone
      ? tripCard(/Sydney/)
      : page
          .locator(".history-item--trip")
          .getByRole("button", { name: /Sydney/ })
          .first()
  ).click();
  await home.waitFor();
  check(
    /Sydney/.test(await heading.innerText()),
    "a trip found in the Chats search opens the Trip home",
  );

  await goChats();
  await page.getByRole("searchbox").fill("Sydney chat");
  await page
    .locator(".history-item:not(.history-item--trip)")
    .getByRole("button", { name: /Sydney chat/ })
    .first()
    .click();
  await page.getByText("Sydney chat marker", { exact: true }).waitFor();
  check(
    (await home.count()) === 0 && (await page.locator(".composer textarea").count()) === 1,
    "a chat chosen from the Chats list opens the conversation, not the Trip home",
  );
  if (phone) await page.locator(".phone-tabbar").waitFor();
  await shot("chat-from-list");

  await goHome(/Sydney/);
  await rows.filter({ hasText: "Harbour ideas" }).click();
  await page.getByText("Harbour ideas marker", { exact: true }).waitFor();
  await page.waitForTimeout(1200);
  const afterOlder = await stored(page);
  check(
    (await home.count()) === 1 &&
      itemsOf(afterOlder.trips.find((trip) => trip.id === sydney.trip.id).snapshot) === 2,
    "a chat row opens that chat and the older chat does not downgrade the trip's plan",
    itemsOf(afterOlder.trips.find((trip) => trip.id === sydney.trip.id).snapshot),
  );

  await goHome(/Sydney/);
  const typed = profile.language === "zh" ? "去哪里吃饭？" : "Where should we eat?";
  await home.getByRole("textbox", { name: L.box }).fill(typed);
  await home.getByRole("button", { name: L.send }).click();
  await page.locator(".composer textarea").waitFor();
  check(
    (await page.getByText(typed, { exact: true }).count()) >= 1 &&
      (await page.locator(".composer textarea").inputValue()) === "",
    "the first send opens a linked Chat with the message already sent",
  );
  await page.waitForTimeout(1200);
  await goHome(/Sydney/);
  const afterNew = await rowTitles();
  check(afterNew.length === 3, "the new chat is listed on the trip's home", afterNew);
  const storedNew = await stored(page);
  check(
    storedNew.trips.length === 3 &&
      storedNew.conversations.filter((item) => item.tripId === sydney.trip.id).length === 3,
    "the new chat belongs to the same trip and no trip was added",
  );

  await sectionCard(L.itinerary).click();
  const itineraryDialog = page.getByRole("dialog");
  await itineraryDialog.waitFor();
  await itineraryDialog.locator(".trip-home-action__list li").first().waitFor();
  check(
    (await itineraryDialog.locator(".trip-home-action__list li").count()) === 2 &&
      (await home.count()) === 1,
    "Itinerary opens in place with the card's two stops",
  );
  await shot("itinerary");
  await page.keyboard.press("Escape");

  await goHome(/Sydney/);
  await sectionCard(L.preferences).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByText("Quiet mornings", { exact: true }).waitFor();
  const dialogText = await dialog.innerText();
  check(
    ["Quiet mornings", "Vegetarian", "No long drives"].every((item) => dialogText.includes(item)),
    "Preferences opens the panel with the trip's three preferences",
  );
  await shot("preferences");
  await page.keyboard.press("Escape");
  if (await dialog.count()) await dialog.getByRole("button").first().click();

  await goHome(/Sydney/);
  await sectionCard(L.calendar).click();
  const calendarDialog = page.getByRole("dialog");
  await calendarDialog.waitFor();
  await calendarDialog.locator(".trip-home-calendar").waitFor();
  check(
    (await calendarDialog.locator(".trip-home-calendar").count()) === 1 &&
      (await home.count()) === 1,
    "Calendar opens only this Trip in place",
  );
  await shot("calendar");
  await page.keyboard.press("Escape");

  await goHome(/Sydney/);
  page.once("dialog", (dialog) => dialog.accept("Harbour holiday"));
  await home.locator(".trip-home__menu button").click();
  await page.getByRole("menuitem", { name: L.rename }).click();
  await page.getByRole("heading", { name: "Harbour holiday", level: 1 }).waitFor();
  const renamed = (await stored(page)).trips.find((trip) => trip.id === sydney.trip.id);
  await home.getByRole("button", { name: L.back, exact: true }).click();
  await tripsPageShown();
  check(
    renamed?.title === "Harbour holiday" &&
      renamed.renamed === true &&
      (await tripCard(/Harbour holiday/).count()) === 1,
    "Rename updates the heading, the stored trip and the Trips page card",
    renamed?.title,
  );

  await tripCard(/Hobart/).click();
  await home.waitFor();
  const emptyLabels = (await cardsList.getByRole("button").allInnerTexts()).map((text) =>
    text.replace(/\s+/g, " ").trim(),
  );
  check(
    /Hobart/.test(await heading.innerText()) &&
      (await home.getByRole("list", { name: L.list }).count()) === 0 &&
      (await home.getByRole("textbox", { name: L.box }).count()) === 1 &&
      emptyLabels.length === 5 &&
      emptyLabels.slice(0, 4).every((text) => !/\d/.test(text)) &&
      /3/.test(emptyLabels[4]) &&
      (await markers().count()) === 0,
    "an empty Trip shows five actions, only the Calendar day count, no Chats or markers, and the composer",
    emptyLabels,
  );
  check((await overflow()) <= 0, "the empty trip does not scroll sideways");
  await shot("empty-trip");
  await home.locator(".trip-home__menu button").click();
  await page.getByRole("menuitem", { name: L.delete }).click();
  await tripsPageShown();
  const notice = page.getByRole("status").filter({ hasText: /Hobart/ });
  check(
    (await notice.count()) >= 1 && (await tripCard(/Hobart/).count()) === 0,
    "Delete returns to the Trips page with an Undo notice and the card gone",
  );
  await shot("deleted");
  await page.getByRole("button", { name: L.undo, exact: true }).first().click();
  await page.waitForTimeout(500);
  const restored = await stored(page);
  check(
    (await tripCard(/Hobart/).count()) === 1 &&
      restored.trips.some((trip) => trip.id === hobart.trip.id),
    "Undo brings the trip and its card back",
  );

  check(errors.length === 0, "no page or console errors", errors);
  profiles.push({ name: profile.name, errors: errors.length });
  await context.close();
}

try {
  for (const profile of PROFILES) {
    profileName = profile.name;
    await walk(profile);
  }
} catch (error) {
  check(false, "journey completes", { error: String(error), pageErrors: currentErrors });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        passed: results.every((result) => result.ok),
        profiles,
        results,
        fixture: "local catalog; place lookups stubbed; no live services",
      },
      null,
      2,
    ),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
