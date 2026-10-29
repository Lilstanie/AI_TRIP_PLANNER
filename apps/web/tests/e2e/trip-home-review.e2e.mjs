import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-review", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const stop = (id, day, startTime) => ({
  id,
  kind: "activity",
  day,
  startTime,
  endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  location: id,
  detail: id,
});
const makeTrip = ({ id, destination, dates, tripStops, chatStops, tripSavedAt, chatSavedAt }) => {
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates,
    groupSize: 2,
    budgetTotal: 3000,
  };
  const snapshotWith = (items, savedAt, message) => ({
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
  const chatSnapshot = snapshotWith(chatStops, chatSavedAt, `${destination} marker`);
  return {
    trip: {
      id: `trip:${id}`,
      title: `Trip to ${destination}`,
      updatedAt: tripSavedAt,
      conversationIds: [`conversation:${id}`],
      snapshot: snapshotWith(tripStops, tripSavedAt, ""),
    },
    conversation: {
      id: `conversation:${id}`,
      title: `${destination} chat`,
      renamed: true,
      updatedAt: chatSavedAt,
      tripId: `trip:${id}`,
      messages: chatSnapshot.messages,
      input: "",
      snapshot: chatSnapshot,
    },
  };
};
const sydney = makeTrip({
  id: "sydney",
  destination: "Sydney",
  dates: ["2030-11-14", "2030-11-17"],
  tripStops: [stop("Opera", 1, "09:00"), stop("Bridge", 1, "11:00")],
  chatStops: [],
  tripSavedAt: "2026-10-20T00:00:00Z",
  chatSavedAt: "2026-10-05T00:00:00Z",
});
const entries = [sydney];
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
    editorView: "timeline",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "light",
  language: "en",
  displayCurrency: "AUD",
  updatedAt: "2026-10-05T00:00:00Z",
};

let current;
let currentErrors = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));
const home = (page) => page.locator(".trip-home");

async function open(viewport, phone) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    locale: "en-AU",
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
    { catalog, settings },
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

try {
  const phone = await open({ width: 390, height: 844 }, true);
  await phone.page.getByRole("tab", { name: /^Mine/ }).click();
  await phone.page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first().click();
  await home(phone.page).waitFor();
  await phone.page.setViewportSize({ width: 1440, height: 1000 });
  await phone.page.waitForTimeout(500);
  check((await home(phone.page).count()) === 1, "widening a phone window keeps the Trip home");
  await home(phone.page)
    .getByRole("button", { name: /^Itinerary/ })
    .click();
  await phone.page.locator(".trip-workspace").waitFor();
  check(
    (await phone.page.locator(".trip-trigger").getAttribute("aria-expanded")) === "true" &&
      (await phone.page.locator(".timeline-stop").count()) === 2,
    "after widening, Itinerary opens the Trip panel with its two stops",
  );
  await phone.page.screenshot({ path: `${OUT}/widened-itinerary-1440.png` });
  check(phone.errors.length === 0, "phone run has no page or console errors", phone.errors);
  await phone.context.close();

  const wide = await open({ width: 1440, height: 1000 }, false);
  const tripChats = async () =>
    (await stored(wide.page)).conversations.filter((item) => item.tripId === sydney.trip.id);
  const before = await tripChats();
  const stamp = async () => (await stored(wide.page)).trips[0].snapshot.savedAt;
  const firstStamp = await stamp();
  for (let click = 1; click <= 3; click += 1) {
    await wide.page
      .locator(".sidebar-nav")
      .getByRole("button", { name: /^Trips/ })
      .click();
    await wide.page.locator(".trip-cards button.trip-card").first().click();
    await home(wide.page).waitFor();
    const send = home(wide.page).getByRole("button", { name: "Send", exact: true });
    check(await send.isDisabled(), `empty Send stays disabled on click attempt ${click}`);
    await home(wide.page).getByRole("textbox", { name: "New chat", exact: true }).press("Enter");
    const count = (await tripChats()).length;
    check(count === before.length, `empty Enter ${click} creates no Chat`, count);
  }
  const after = await tripChats();
  check(after.length === before.length, "three empty Enter presses leave the Chat list unchanged", {
    before: before.length,
    after: after.length,
  });
  check(
    (await stamp()) === firstStamp,
    "empty Enter presses leave the trip snapshot's saved time alone",
    { firstStamp, now: await stamp() },
  );
  check(wide.errors.length === 0, "wide run has no page or console errors", wide.errors);
  await wide.context.close();
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
