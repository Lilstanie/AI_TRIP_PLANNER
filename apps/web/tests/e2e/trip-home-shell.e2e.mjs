import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-shell", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-05T00:00:00Z";
const LONG = `Grandparents ${"and cousins ".repeat(12)}reunion across the whole harbour`;
const makeTrip = ({ id, destination, dates, groupSize, budgetTotal, title, message }) => {
  const conversationId = `conversation:${id}`;
  const brief = { tripId: id, userId: "local", destination, dates, groupSize, budgetTotal };
  const snapshot = {
    version: 3,
    id,
    savedAt,
    draft: {
      destination,
      origin: "",
      start: dates[0],
      end: dates[1],
      groupSize: String(groupSize),
      budgetTotal: String(budgetTotal),
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [{ role: "user", text: message }],
    input: "",
    plan: {
      tripId: id,
      brief,
      round: 1,
      budgetTotal,
      estTotal: 900,
      overrunPct: -50,
      sections: [],
    },
  };
  return {
    trip: {
      id: `trip:${id}`,
      title: title ?? `Trip to ${destination}`,
      ...(title ? { renamed: true } : {}),
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
  dates: ["2030-11-14", "2030-11-17"],
  groupSize: 2,
  budgetTotal: 4500,
  message: "Plan Sydney marker",
});
const melbourne = makeTrip({
  id: "melbourne",
  destination: "Melbourne",
  dates: ["2030-11-05", "2030-11-07"],
  groupSize: 1,
  budgetTotal: 1200,
  message: "Plan Melbourne marker",
});
const long = makeTrip({
  id: "hobart",
  destination: "Hobart",
  dates: ["2030-11-20", "2030-11-22"],
  groupSize: 6,
  budgetTotal: 8000,
  title: LONG,
  message: "Plan Hobart marker",
});
const entries = [sydney, melbourne, long];
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

async function open(language) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    timezoneId: "Australia/Sydney",
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
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  current = page;
  currentErrors = errors;
  return { context, page, errors };
}

const cards = (page, name) => page.locator(".trip-cards").getByRole("button", { name });
const home = (page) => page.locator(".trip-home");
const heading = (page) => home(page).getByRole("heading", { level: 1 });
const goTrips = (page, name) => page.locator(".sidebar-nav").getByRole("button", { name });

try {
  const { context, page, errors } = await open("en");

  await goTrips(page, /^Trips/).click();
  await page.waitForTimeout(800);
  const before = await stored(page);
  await cards(page, /^Trip to Sydney/).click();
  await home(page).waitFor();
  check(
    (await heading(page).innerText()) === "Trip to Sydney",
    "trips card opens the Trip home with the title heading",
  );
  const tags = await home(page)
    .getByRole("group", { name: "Trip details" })
    .locator(".fact-chip__value")
    .allInnerTexts();
  check(
    tags.length === 4 &&
      tags[0] === "Sydney" &&
      /14.*17.*Nov/.test(tags[1]) &&
      tags[2] === "2 travellers" &&
      /4,500/.test(tags[3]),
    "tag line shows destination, dates, travellers and budget from the brief",
    tags,
  );
  const afterOpen = await stored(page);
  check(
    afterOpen.activeConversationId === before.activeConversationId &&
      afterOpen.activeTripId === before.activeTripId &&
      afterOpen.trips.length === 3,
    "opening the Trip home leaves the stored catalog's active conversation and trip alone",
    { before: before.activeConversationId, after: afterOpen.activeConversationId },
  );
  check(
    (await page.locator(".workspace-topbar .fact-chips, .chat-header").count()) === 0,
    "the Trip home replaces the conversation view",
  );
  await page.screenshot({ path: `${OUT}/home-1440-en.png` });

  await home(page).getByRole("button", { name: "Back to trips" }).click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  check(
    (await page.getByRole("tab", { name: "Trips", exact: true }).getAttribute("aria-selected")) ===
      "true" && (await home(page).count()) === 0,
    "back returns to the Trips page on the Trips tab",
  );

  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await page.locator(".trips-calendar__trip").filter({ hasText: "Melbourne" }).click();
  await page.getByRole("button", { name: "View trip", exact: true }).click();
  await home(page).waitFor();
  const melbourneTags = await home(page)
    .getByRole("group", { name: "Trip details" })
    .locator(".fact-chip__value")
    .allInnerTexts();
  check(
    (await heading(page).innerText()) === "Trip to Melbourne" &&
      melbourneTags.includes("1 traveller"),
    "Calendar View trip opens the Trip home, with a singular traveller count",
    melbourneTags,
  );
  await home(page).getByRole("button", { name: "Back to trips" }).click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  check(
    (await page
      .getByRole("tab", { name: "Calendar", exact: true })
      .getAttribute("aria-selected")) === "true",
    "back from a trip opened on the calendar returns to the Calendar tab",
  );

  await goTrips(page, /^Chats/).click();
  const search = page.getByRole("searchbox");
  await search.fill("Sydney");
  await page
    .locator(".history-item--trip")
    .getByRole("button", { name: /Trip to Sydney/ })
    .first()
    .click();
  await home(page).waitFor();
  check(
    (await heading(page).innerText()) === "Trip to Sydney" &&
      (await page.locator(".chats-panel.is-open").count()) === 0,
    "a trip in the Chats search opens the Trip home and closes the panel",
  );

  await goTrips(page, /^Chats/).click();
  await page
    .locator(".history-item:not(.history-item--trip)")
    .getByRole("button", { name: /Sydney chat/ })
    .first()
    .click();
  await page.getByText("Plan Sydney marker", { exact: true }).waitFor();
  check(
    (await home(page).count()) === 0 && (await page.locator(".composer textarea").count()) === 1,
    "a chat opened from Chats still opens the conversation",
  );

  await goTrips(page, /^Trips/).click();
  await cards(page, /^Trip to Sydney/).click();
  await home(page).waitFor();
  await home(page)
    .getByRole("button", { name: /^Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog", { name: "Rename trip" });
  await renameDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await renameDialog.waitFor({ state: "detached" });
  check(
    (await heading(page).innerText()) === "Trip to Sydney",
    "cancelling the rename prompt keeps the heading",
  );
  await home(page)
    .getByRole("button", { name: /^Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await renameDialog.getByRole("textbox").fill("Harbour holiday");
  await renameDialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Harbour holiday", level: 1 }).waitFor();
  const renamed = (await stored(page)).trips.find((trip) => trip.id === sydney.trip.id);
  check(
    renamed?.title === "Harbour holiday" && renamed.renamed === true,
    "Rename updates the heading and the stored trip",
    renamed?.title,
  );
  await home(page).getByRole("button", { name: "Back to trips" }).click();
  check(
    (await cards(page, /^Harbour holiday/).count()) === 1,
    "the Trips page card shows the renamed trip",
  );

  await cards(page, /^Harbour holiday/).click();
  await home(page).waitFor();
  await home(page)
    .getByRole("button", { name: /^Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  check(
    (await page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: "Deleted “Harbour holiday”" })
      .count()) === 1 &&
      (await cards(page, /^Harbour holiday/).count()) === 0 &&
      (await home(page).count()) === 0,
    "Delete from the menu returns to Trips with an Undo notice and the card gone",
  );
  await page.screenshot({ path: `${OUT}/deleted-1440-en.png` });
  await page.getByRole("main").getByRole("button", { name: "Undo", exact: true }).click();
  const restored = await stored(page);
  check(
    (await cards(page, /^Harbour holiday/).count()) === 1 &&
      restored.trips.some((trip) => trip.id === sydney.trip.id) &&
      restored.conversations.find((item) => item.id === sydney.conversation.id)?.tripId ===
        sydney.trip.id,
    "Undo restores the trip and its chat link",
  );

  await page.getByRole("button", { name: new RegExp(`^${LONG.slice(0, 20)}`) }).click();
  await home(page).waitFor();
  const box = await page.evaluate(() => {
    const menu = document.querySelector(".trip-home__menu button").getBoundingClientRect();
    const back = document.querySelector(".trip-home__back").getBoundingClientRect();
    const main = document.querySelector(".trip-home__main");
    return {
      menuRight: menu.right,
      backLeft: back.left,
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      mainOverflow: main.scrollWidth - main.clientWidth,
    };
  });
  check(
    box.menuRight <= box.viewport &&
      box.backLeft >= 0 &&
      box.overflow <= 0 &&
      box.mainOverflow <= 0,
    "a very long title wraps and keeps the back button and menu on screen",
    box,
  );
  await page.screenshot({ path: `${OUT}/long-title-1440-en.png` });
  await home(page).getByRole("button", { name: "Back to trips" }).click();

  await page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await page.locator(".trips-calendar__trip").filter({ hasText: "Melbourne" }).click();
  await page.getByRole("button", { name: "View trip", exact: true }).click();
  await home(page).waitFor();
  await goTrips(page, /^Chats/).click();
  await page.getByRole("searchbox").fill("Melbourne");
  await page
    .locator(".chats-panel")
    .getByRole("button", { name: "Actions for Trip to Melbourne" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("heading", { name: "Your trips", level: 1 }).waitFor();
  check(
    (await home(page).count()) === 0 &&
      (await page
        .getByRole("main")
        .getByRole("status")
        .filter({ hasText: "Deleted “Trip to Melbourne”" })
        .count()) === 1,
    "a trip deleted from the Chats panel while open returns to Trips with Undo",
  );
  await page.getByRole("main").getByRole("button", { name: "Undo", exact: true }).click();
  check(errors.length === 0, "English run has no page or console errors", errors);
  await context.close();

  const zh = await open("zh");
  await zh.page.locator(".sidebar-nav").getByRole("button", { name: /^行程/ }).click();
  await cards(zh.page, /Sydney/)
    .first()
    .click();
  await home(zh.page).waitFor();
  const zhTags = await home(zh.page).locator(".fact-chip__value").allInnerTexts();
  const zhTagList = await home(zh.page)
    .getByRole("group", { name: "行程信息" })
    .getAttribute("aria-label");
  check(
    (await home(zh.page).getByRole("button", { name: "返回行程列表" }).count()) === 1 &&
      zhTags.includes("2 人") &&
      zhTagList === "行程信息",
    "Chinese back button, tag list name and traveller tag are translated",
    { zhTags, zhTagList },
  );
  await home(zh.page).locator(".history-item__more").click();
  const zhMenu = await zh.page.getByRole("menuitem").allInnerTexts();
  check(zhMenu.join("|") === "重命名|删除", "Chinese menu items are translated", zhMenu);
  await zh.page.screenshot({ path: `${OUT}/home-1440-zh.png` });
  check(zh.errors.length === 0, "Chinese run has no page or console errors", zh.errors);
  await zh.context.close();
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
