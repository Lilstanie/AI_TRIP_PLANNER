import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-chats", process.env.LABEL ?? "run");
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
const makeTrip = ({ id, destination, dates, groupSize, budgetTotal, chats }) => {
  const brief = { tripId: id, userId: "local", destination, dates, groupSize, budgetTotal };
  const snapshotFor = (message) => ({
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
    messages: message ? [{ role: "user", text: message }] : [],
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
  });
  const conversations = chats.map(({ key, title, updatedAt }) => {
    const snapshot = { ...snapshotFor(`${title} marker`), id: `${id}-${key}` };
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
      updatedAt: savedAt,
      conversationIds: conversations.map((item) => item.id),
      snapshot: snapshotFor(""),
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
  chats: [
    { key: "a", title: "Sydney chat", updatedAt: "2026-10-05T00:00:00Z" },
    { key: "b", title: LONG, updatedAt: "2026-10-10T00:00:00Z" },
    { key: "c", title: "Harbour ideas", updatedAt: "2026-10-20T00:00:00Z" },
  ],
});
const melbourne = makeTrip({
  id: "melbourne",
  destination: "Melbourne",
  dates: ["2030-11-05", "2030-11-07"],
  groupSize: 1,
  budgetTotal: 1200,
  chats: [{ key: "a", title: "Melbourne chat", updatedAt: "2026-10-25T00:00:00Z" }],
});
const hobart = makeTrip({
  id: "hobart",
  destination: "Hobart",
  dates: ["2030-11-20", "2030-11-22"],
  groupSize: 3,
  budgetTotal: 3000,
  chats: [],
});
const loose = {
  id: "conversation:loose",
  title: "Loose notes",
  renamed: true,
  updatedAt: "2026-10-26T00:00:00Z",
  messages: [{ role: "user", text: "Loose notes marker" }],
  input: "",
};
const entries = [sydney, melbourne, hobart];
const catalog = {
  version: 4,
  activeConversationId: sydney.conversations[0].id,
  activeTripId: sydney.trip.id,
  trips: entries.map(({ trip }) => trip),
  conversations: [...entries.flatMap(({ conversations }) => conversations), loose],
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
const storedWhen = async (page, test) => {
  let latest;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    latest = await stored(page);
    if (test(latest)) return latest;
    await page.waitForTimeout(100);
  }
  return latest;
};

async function open(language, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({
    viewport,
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

const home = (page) => page.locator(".trip-home");
const list = (page) => home(page).getByRole("list", { name: /^(Chats|聊天)$/ });
const rows = (page) => list(page).getByRole("button");
const box = (page) => home(page).locator(".composer textarea");
const send = (page) => home(page).getByRole("button", { name: /^(Send|发送)$/ });
const rowTitles = async (page) =>
  (await rows(page).locator(".trip-home-chats__name").allInnerTexts()).map((text) => text.trim());
const sidebar = (page, name) => page.locator(".sidebar-nav").getByRole("button", { name });
async function openHome(page, name, trips = /^Trips/) {
  const nav = sidebar(page, trips);
  if (await nav.isVisible()) await nav.click();
  else {
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.getByRole("button", { name: trips }).first().click();
  }
  await page
    .locator(".trip-cards button.trip-card")
    .filter({ has: page.locator(".trip-card__title", { hasText: name }) })
    .first()
    .click();
  await home(page).waitFor();
}

try {
  const { context, page, errors } = await open("en");

  await openHome(page, /^Trip to Sydney/);
  const titles = await rowTitles(page);
  check(
    JSON.stringify(titles) === JSON.stringify(["Harbour ideas", LONG, "Sydney chat"]),
    "the list shows only this trip's chats, newest first",
    titles,
  );
  const dates = await rows(page).locator("time").allInnerTexts();
  check(
    dates.length === 3 && /20 Oct 2026/.test(dates[0]) && /10 Oct 2026/.test(dates[1]),
    "each row shows a formatted date",
    dates,
  );
  check(
    (await list(page).count()) === 1 &&
      (await home(page).getByRole("heading", { name: "Chats", level: 2 }).count()) === 1 &&
      (await box(page).count()) === 1,
    "the list, its heading and the box have accessible names",
  );
  await page.screenshot({ path: `${OUT}/home-1440-en.png` });

  await rows(page).filter({ hasText: "Harbour ideas" }).click();
  await page.getByText("Harbour ideas marker", { exact: true }).waitFor();
  const opened = await stored(page);
  check(
    (await home(page).count()) === 0 &&
      opened.activeConversationId === "conversation:sydney-c" &&
      opened.activeTripId === sydney.trip.id,
    "choosing a row opens that chat and leaves the Trip home",
    opened.activeConversationId,
  );

  await openHome(page, /^Trip to Sydney/);
  await box(page).fill("Where should we eat?");
  await send(page).click();
  await page.locator(".composer textarea").waitFor();
  check(
    (await page.getByText("Where should we eat?", { exact: true }).count()) >= 1 &&
      (await home(page).count()) === 0,
    "the first send opens a linked Chat",
  );
  const afterStart = await storedWhen(
    page,
    (value) => value.conversations.filter((item) => item.tripId === sydney.trip.id).length === 4,
  );
  const added = afterStart.conversations.find(
    (item) => item.tripId === sydney.trip.id && !item.id.startsWith("conversation:sydney-"),
  );
  check(
    afterStart.trips.length === 3 &&
      added &&
      afterStart.trips
        .find((trip) => trip.id === sydney.trip.id)
        .conversationIds.includes(added.id) &&
      afterStart.activeConversationId === added.id &&
      added.snapshot?.plan.brief.destination === "Sydney",
    "the new chat is stored on the same trip with the plan and becomes active",
    { trips: afterStart.trips.length, added: added?.id },
  );

  await openHome(page, /^Trip to Sydney/);
  const second = await rowTitles(page);
  check(
    second.length === 4 && second[0] === "Where should we eat?" && second[1] === "Harbour ideas",
    "the new chat leads the list",
    second,
  );
  check(
    (await page.getByRole("button", { name: /^(Start chat|开始聊天)$/ }).count()) === 0 &&
      (await send(page).isDisabled()),
    "Trip home has no Start chat action and disables empty Send",
  );

  await sidebar(page, /^Chats/).click();
  await page.getByRole("searchbox").fill("");
  const panel = page.locator(".chats-panel.is-open");
  await panel
    .locator(".history-item:not(.history-item--trip)")
    .filter({ hasText: "Sydney chat" })
    .first()
    .locator(".history-item__more")
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const renameDialog = page.getByRole("dialog", { name: "Rename chat" });
  await renameDialog.getByRole("textbox").fill("Renamed chat");
  await renameDialog.getByRole("button", { name: "Save", exact: true }).click();
  await renameDialog.waitFor({ state: "detached" });
  await page.keyboard.press("Escape");
  await openHome(page, /^Trip to Sydney/);
  check(
    (await rowTitles(page)).includes("Renamed chat"),
    "a chat renamed in the Chats panel shows its new title",
  );
  await sidebar(page, /^Chats/).click();
  await page
    .locator(".chats-panel.is-open .history-item:not(.history-item--trip)")
    .filter({ hasText: "Harbour ideas" })
    .first()
    .locator(".history-item__more")
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete chat" });
  await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await deleteDialog.waitFor({ state: "detached" });
  await page.keyboard.press("Escape");
  const afterDelete = await rowTitles(page);
  check(
    (await home(page).count()) === 1 &&
      !afterDelete.includes("Harbour ideas") &&
      afterDelete.length === 3,
    "a chat deleted while the page is open leaves the list",
    afterDelete,
  );

  await openHome(page, /^Trip to Hobart/);
  check(
    (await list(page).count()) === 0 &&
      (await page.locator(".trip-home__main").getByRole("heading", { level: 2 }).count()) === 0 &&
      (await box(page).count()) === 1 &&
      (await send(page).count()) === 1,
    "a trip with no chats shows only the composer",
  );
  await page.screenshot({ path: `${OUT}/home-no-chats-1440-en.png` });
  await box(page).fill("Hobart first question");
  await send(page).click();
  await page.locator(".composer textarea").waitFor();
  const hobartState = await storedWhen(
    page,
    (value) => value.conversations.filter((item) => item.tripId === hobart.trip.id).length === 1,
  );
  check(
    hobartState.conversations.filter((item) => item.tripId === hobart.trip.id).length === 1 &&
      hobartState.trips.find((trip) => trip.id === hobart.trip.id).conversationIds.length === 1,
    "the first send on a trip with no chats creates its first chat",
  );

  let release;
  const held = new Promise((resolveHeld) => (release = resolveHeld));
  let chatRequests = 0;
  await page.route("**/api/chat", async (route) => {
    chatRequests += 1;
    await held;
    await route.continue().catch(() => {});
  });
  await openHome(page, /^Trip to Melbourne/);
  await rows(page).filter({ hasText: "Melbourne chat" }).click();
  await page.locator(".composer textarea").fill("Add a laneway walk");
  await page.locator(".composer textarea").press("Enter");
  await page.getByText("Add a laneway walk", { exact: true }).waitFor();
  await page.waitForFunction(() => document.body.innerText.includes("Add a laneway walk"));
  await openHome(page, /^Trip to Sydney/);
  await box(page).fill("Fresh question");
  await send(page).click();
  await page.locator(".composer textarea").waitFor();
  release();
  await page.waitForTimeout(1500);
  const running = await stored(page);
  const melbourneChat = running.conversations.find(
    (item) => item.id === "conversation:melbourne-a",
  );
  const fresh = running.conversations.find((item) => item.id === running.activeConversationId);
  check(
    chatRequests >= 1 &&
      melbourneChat.messages.some((message) => message.text === "Add a laneway walk") &&
      fresh.tripId === sydney.trip.id &&
      fresh.messages.some((message) => message.text === "Fresh question"),
    "a chat started while the assistant runs on another chat keeps both chats apart",
    { requests: chatRequests, fresh: fresh.messages.length },
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  const reloaded = await stored(page);
  check(
    reloaded.trips.length === 3 && reloaded.conversations.length >= 6,
    "the catalog still parses after a reload",
  );
  check(errors.length === 0, "English run has no page or console errors", errors);
  await context.close();

  const narrow = await open("en", { width: 700, height: 900 });
  await openHome(narrow.page, /^Trip to Sydney/);
  const geometry = await narrow.page.evaluate(() => {
    const inView = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    };
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: [...document.querySelectorAll(".trip-home-chats__row")].every(inView),
      box: inView(document.querySelector(".trip-home__composer")),
    };
  });
  check(
    geometry.overflow <= 0 && geometry.rows && geometry.box,
    "at 700 px the rows, the long title and the box stay on screen",
    geometry,
  );
  await narrow.page.screenshot({ path: `${OUT}/home-700-en.png` });
  await rows(narrow.page).first().click();
  await narrow.page.locator(".composer textarea").waitFor();
  check(
    (await narrow.page.locator(".trip-home").count()) === 0,
    "at 700 px choosing a row opens the chat",
  );
  check(narrow.errors.length === 0, "narrow run has no page or console errors", narrow.errors);
  await narrow.context.close();

  const tie = await open("en");
  await tie.page.clock.setFixedTime(new Date("2030-01-01T00:00:00.000Z"));
  await openHome(tie.page, /^Trip to Melbourne/);
  for (const text of ["First tie", "Second tie"]) {
    await box(tie.page).fill(text);
    await send(tie.page).click();
    await tie.page.locator(".composer textarea").waitFor();
    await storedWhen(tie.page, (value) =>
      value.conversations.some(
        (item) =>
          item.tripId === melbourne.trip.id &&
          item.messages.some((message) => message.text === text),
      ),
    );
    await tie.page.waitForTimeout(500);
    await openHome(tie.page, /^Trip to Melbourne/);
  }
  const stamps = (await stored(tie.page)).conversations
    .filter((item) =>
      item.messages.some(
        (message) => typeof message.text === "string" && message.text.endsWith(" tie"),
      ),
    )
    .map((item) => item.updatedAt);
  check(
    stamps.length === 2 && stamps[0] === stamps[1],
    "two chats saved in the same millisecond share one timestamp",
    stamps,
  );
  await rows(tie.page).first().click();
  await tie.page.locator(".composer textarea").waitFor();
  check(
    (await tie.page.getByText("Second tie", { exact: true }).count()) >= 1,
    "of two chats with the same timestamp the one started last leads the list",
  );
  check(tie.errors.length === 0, "tie run has no page or console errors", tie.errors);
  await tie.context.close();

  const zh = await open("zh");
  await openHome(zh.page, /Sydney/, /^行程/);
  const zhDates = await rows(zh.page).locator("time").allInnerTexts();
  check(
    (await list(zh.page).count()) === 1 &&
      (await box(zh.page).count()) === 1 &&
      (await send(zh.page).count()) === 1 &&
      (await zh.page
        .locator(".trip-home")
        .getByRole("heading", { name: "聊天", level: 2 })
        .count()) === 1 &&
      zhDates.every((text) => /2026年/.test(text)),
    "Chinese list name, box name, Send and dates are translated",
    zhDates,
  );
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
