import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/trip-home-older-chat", process.env.LABEL ?? "run");
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
const hobart = makeTrip({
  id: "hobart",
  destination: "Hobart",
  dates: ["2030-06-20", "2030-06-22"],
  tripStops: [stop("Salamanca", 1, "10:00")],
  chatStops: [stop("Salamanca", 1, "10:00"), stop("Mona", 2, "10:00")],
  tripSavedAt: "2026-10-05T00:00:00Z",
  chatSavedAt: "2026-10-20T00:00:00Z",
});
const entries = [sydney, hobart];
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
const stopsOf = (snapshot) =>
  (snapshot.plan.sections.find((section) => section.id === "itinerary")?.proposal.items ?? [])
    .map((item) => item.id)
    .sort();
const tripSnapshot = (value, id) => value.trips.find((trip) => trip.id === id).snapshot;
const chatSnapshot = (value, id) => value.conversations.find((item) => item.id === id).snapshot;
const home = (page) => page.locator(".trip-home");
const openHome = async (page, name) => {
  await page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Trips/ })
    .click();
  await page.locator(".trip-cards").getByRole("button", { name }).first().click();
  await home(page).waitFor();
};
const cardLabel = async (page) =>
  (
    await home(page)
      .getByRole("list", { name: /^Trip sections$/ })
      .getByRole("button")
      .first()
      .innerText()
  ).replace(/\s+/g, " ");

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
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
  currentErrors = [];
  current = page;
  page.on("pageerror", (error) => currentErrors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && currentErrors.push(message.text()));
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  await openHome(page, /^Trip to Sydney/);
  check(/^Itinerary 2 stops$/.test(await cardLabel(page)), "Sydney home counts 2 stops");
  await home(page).getByRole("button", { name: "Sydney chat" }).click();
  await page.getByText("Sydney marker", { exact: true }).waitFor();
  await page.waitForTimeout(1500);
  const opened = await stored(page);
  check(
    stopsOf(tripSnapshot(opened, sydney.trip.id)).join() === "Bridge,Opera",
    "opening a chat with an older snapshot leaves the trip's two stops in the stored trip",
    stopsOf(tripSnapshot(opened, sydney.trip.id)),
  );
  check(
    stopsOf(chatSnapshot(opened, sydney.conversation.id)).join() === "Bridge,Opera",
    "the opened chat carries the trip's latest plan",
    stopsOf(chatSnapshot(opened, sydney.conversation.id)),
  );
  const trigger = page.locator(".trip-trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  await timeline.waitFor();
  const names = await timeline.locator(".timeline-stop__name").allInnerTexts();
  check(names.length === 2, "the Trip panel of the opened chat shows the trip's two stops", names);
  await page.screenshot({ path: `${OUT}/older-chat-panel-1440-en.png` });
  await openHome(page, /^Trip to Sydney/);
  check(
    /^Itinerary 2 stops$/.test(await cardLabel(page)),
    "going back to the Trip home still counts 2 stops",
    await cardLabel(page),
  );

  await home(page).getByRole("button", { name: "Sydney chat" }).click();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await timeline.waitFor();
  await timeline
    .locator(".timeline-stop")
    .filter({ has: page.locator(".timeline-stop__name", { hasText: "Opera" }) })
    .first()
    .locator(".action-menu__trigger")
    .click();
  await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
  await page.waitForTimeout(1500);
  const edited = await stored(page);
  check(
    stopsOf(tripSnapshot(edited, sydney.trip.id)).join() === "Bridge" &&
      stopsOf(chatSnapshot(edited, sydney.conversation.id)).join() === "Bridge",
    "an edit after opening the older chat is saved to the trip",
    stopsOf(tripSnapshot(edited, sydney.trip.id)),
  );
  check(
    stopsOf(tripSnapshot(edited, hobart.trip.id)).join() === "Salamanca",
    "editing Sydney leaves the Hobart trip as it was",
  );

  await openHome(page, /^Trip to Hobart/);
  await home(page).getByRole("button", { name: "Hobart chat" }).click();
  await page.getByText("Hobart marker", { exact: true }).waitFor();
  await page.waitForTimeout(1500);
  const newer = await stored(page);
  check(
    stopsOf(tripSnapshot(newer, hobart.trip.id)).join() === "Mona,Salamanca",
    "a chat whose snapshot is newer than the trip's gives the trip its two stops",
    stopsOf(tripSnapshot(newer, hobart.trip.id)),
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.waitForTimeout(1000);
  const reloaded = await stored(page);
  check(
    stopsOf(tripSnapshot(reloaded, sydney.trip.id)).join() === "Bridge" &&
      stopsOf(tripSnapshot(reloaded, hobart.trip.id)).join() === "Mona,Salamanca",
    "a reload keeps both trips' latest plans",
  );
  check(currentErrors.length === 0, "the run has no page or console errors", currentErrors);
  await context.close();
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
