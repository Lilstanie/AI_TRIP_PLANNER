import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve(
  "output/playwright/phone-browsing-context",
  process.env.LABEL ?? `${Date.now()}`,
);
mkdirSync(OUT, { recursive: true });
const results = [];
function check(ok, message) {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
  if (!ok) throw new Error(message);
}
const savedAt = "2026-10-26T00:00:00Z";
function trip(name) {
  const tripId = `context-${name}`;
  const draft = {
    destination: name,
    origin: "",
    start: "2030-10-01",
    end: "2030-10-03",
    groupSize: "2",
    budgetTotal: "2000",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  };
  const plan = {
    tripId,
    brief: {
      tripId,
      userId: "local",
      destination: name,
      dates: [draft.start, draft.end],
      groupSize: 2,
      budgetTotal: 2000,
    },
    round: 1,
    budgetTotal: 2000,
    estTotal: 300,
    overrunPct: -85,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        status: "draft",
        summary: name,
        estCost: 300,
        proposal: {
          agent: "itinerary",
          summary: name,
          assumptions: [],
          conflictsWith: [],
          items: [1, 2, 3].map((day) => ({
            id: `${tripId}-${day}`,
            kind: "activity",
            day,
            startTime: "10:00",
            endTime: "11:00",
            detail: `${name} visit ${day}`,
            location: `${name} museum`,
            placeId: `${tripId}-repeated`,
            estCost: 100,
          })),
        },
      },
    ],
  };
  const snapshot = { version: 3, id: tripId, savedAt, plan, draft, messages: [], input: "" };
  return {
    id: `trip:${tripId}`,
    title: name,
    status: "draft",
    updatedAt: savedAt,
    conversationIds: [`conversation:${tripId}`],
    snapshot,
  };
}
const trips = [trip("Sydney"), trip("Kyoto")];
const settings = (language) => ({
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "system",
  language,
  displayCurrency: "AUD",
  updatedAt: savedAt,
});
const locales = [
  {
    language: "en",
    notNow: "Not now",
    chat: /^Chat$/,
    map: /^Map$/,
    trip: /^Trip(?: updated)?$/,
    mine: /^Mine$/,
  },
  {
    language: "zh",
    notNow: "暂不",
    chat: /^聊天$/,
    map: /^地图$/,
    trip: /^行程(?:已更新)?$/,
    mine: /^我的$/,
  },
];
const catalog = {
  version: 4,
  activeTripId: trips[0].id,
  activeConversationId: trips[0].conversationIds[0],
  trips,
  conversations: trips.map((item) => ({
    id: item.conversationIds[0],
    title: `${item.title} ideas`,
    renamed: true,
    updatedAt: savedAt,
    tripId: item.id,
    snapshot: item.snapshot,
    messages: [],
    input: "",
  })),
  layout: {
    sidebar: { collapsed: false },
    preferences: { open: false, width: 280 },
    trip: { open: false, width: 340 },
    view: "mine",
    editorView: "map",
  },
};
let activePage;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const { language, notNow, ...tabNames } of locales) {
    for (const { width, height } of [
      { width: 390, height: 844 },
      { width: 360, height: 800 },
      { width: 375, height: 667 },
    ]) {
      const prefix = `${language} ${width}`;
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ seed, settings }) => {
          if (!localStorage.getItem("trip-workspace-catalog-v3")) {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
            localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
          }
        },
        { seed: catalog, settings: settings(language) },
      );
      const page = await context.newPage();
      activePage = page;
      const errors = [];
      page.on("pageerror", (error) => {
        errors.push(String(error));
        console.error(String(error));
      });
      await page.route("**/api/places/details", (route) =>
        route.fulfill({
          json: {
            place: {
              id: route.request().postDataJSON().placeId,
              displayName: { text: "Repeated museum" },
              location: { latitude: -33.86, longitude: 151.21 },
            },
          },
        }),
      );
      let revision = structuredClone(trips[0].snapshot.plan);
      let responseNumber = 0;
      await page.route("**/api/chat", (route) =>
        route.fulfill({
          contentType: "application/x-ndjson",
          body:
            JSON.stringify({
              type: "complete",
              response: { reply: `Revision ${++responseNumber}`, plan: revision },
            }) + "\n",
        }),
      );
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".phone-tabbar").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
      const prompt = page.getByRole("button", { name: notNow, exact: true });
      if (await prompt.isVisible()) await prompt.click();
      const tab = (name) =>
        page.locator(".phone-tabbar").getByRole("tab", { name: tabNames[name.toLowerCase()] });
      const mapDay = (n) => page.locator(".phone-map-sheet__days button").nth(n - 1);
      const tripDay = (n) => page.locator(`.day-strip [data-day="${n}"]`).filter({ visible: true });
      const tripSelected = async (n) => (await tripDay(n).getAttribute("aria-selected")) === "true";
      const mapSelected = async (n) => (await mapDay(n).getAttribute("aria-pressed")) === "true";
      const expandMap = async () => page.locator(".phone-map-sheet__handle").press("End");
      await openTripWorkspace(
        page,
        page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }),
      );
      await tab("Map").click();
      await expandMap();
      await mapDay(2).click();
      await tab("Trip").click();
      check(await tripSelected(2), `${prefix}: Map day carries to Trip without selecting a Stop`);
      await tripDay(3).click();
      await tab("Map").click();
      await expandMap();
      check(await mapSelected(3), `${prefix}: Trip day carries to Map`);
      await mapDay(2).click();
      await page.locator(".phone-map-sheet__stops button").first().click();
      await tab("Trip").click();
      const selectedStop = page
        .locator(".timeline-stop__main[aria-expanded=true]")
        .filter({ visible: true });
      check(
        (await tripSelected(2)) &&
          (await selectedStop.getAttribute("aria-controls")) === "stop-place-card-context-Sydney-2",
        `${prefix}: exact later Stop of repeated place reaches Trip`,
      );
      for (const wide of [521, 1440, 520]) {
        await page.setViewportSize({ width: wide, height: 1000 });
        await page
          .locator(wide <= 520 ? ".workspace-app[data-phone]" : ".workspace-app:not([data-phone])")
          .waitFor();
        check(
          (await tripSelected(2)) && (await selectedStop.count()) === 1,
          `${prefix}: context survives width ${wide}`,
        );
      }
      await page.setViewportSize({ width, height });
      const revise = async () => {
        await tab("Chat").click();
        const composer = page.locator(".composer textarea");
        await composer.fill("Revise the itinerary");
        const expected = responseNumber + 1;
        await composer.press("Enter");
        await page.getByText(`Revision ${expected}`, { exact: true }).waitFor();
        await tab("Trip").click();
      };
      await revise();
      check(
        (await tripSelected(2)) && (await selectedStop.count()) === 1,
        `${prefix}: same Trip revision retains valid Stop and day`,
      );
      revision.sections[0].proposal.items = revision.sections[0].proposal.items.filter(
        (item) => item.day !== 2,
      );
      revision.round++;
      await revise();
      check(
        (await tripSelected(2)) && (await selectedStop.count()) === 0,
        `${prefix}: removed Stop clears, empty day stays selected`,
      );
      await tripDay(3).click();
      revision.brief.dates[1] = "2030-10-02";
      revision.sections[0].proposal.items = revision.sections[0].proposal.items.filter(
        (item) => item.day <= 2,
      );
      revision.round++;
      await revise();
      check(
        (await tripSelected(2)) && (await tripDay(3).count()) === 0,
        `${prefix}: removed calendar day falls back to nearest remaining day`,
      );
      const openTrip = async (name) => {
        await tab("Mine").click();
        await openTripWorkspace(
          page,
          page.locator(".phone-mine .trip-card").filter({ hasText: name }),
        );
        await tab("Trip").click();
        check(
          (await tab("Trip").getAttribute("aria-selected")) === "true",
          `${prefix}: saved ${name} opens in Trip`,
        );
      };
      await openTrip("Kyoto");
      check(await tripSelected(1), `${prefix}: unseen Trip defaults to first day`);
      await tripDay(3).click();
      await openTrip("Sydney");
      await tripDay(2).and(page.locator("[aria-selected=true]")).waitFor();
      check(await tripSelected(2), `${prefix}: Sydney restores its own context`);
      await openTrip("Kyoto");
      await tripDay(3).and(page.locator("[aria-selected=true]")).waitFor();
      check(await tripSelected(3), `${prefix}: Kyoto restores independent context`);
      await page.reload();
      await page.locator(".phone-tabbar").waitFor();
      await openTrip("Kyoto");
      check(await tripSelected(3), `${prefix}: reopen after reload restores Trip context`);
      await tab("Mine").click();
      await page.locator(".phone-mine").getByText("Sydney ideas", { exact: true }).click();
      check(
        (await tab("Chat").getAttribute("aria-selected")) === "true",
        `${prefix}: recent chat opens Chat`,
      );
      check(errors.length === 0, `${prefix}: no page errors ${errors.join("; ")}`);
      await page.screenshot({ path: `${OUT}/${language}-${width}-chat.png` });
      await tab("Trip").click();
      await page.screenshot({ path: `${OUT}/${language}-${width}-trip.png` });
      await context.close();
    }
  }
} catch (error) {
  await activePage?.screenshot({ path: `${OUT}/failure.png` });
  console.error(
    await activePage?.evaluate(() => ({
      days: [...document.querySelectorAll(".day-strip [data-day]")].map((node) => [
        node.getAttribute("data-day"),
        node.getAttribute("aria-selected"),
      ]),
      stored: Object.fromEntries(
        Object.entries(localStorage).filter(([key]) => key.startsWith("trip-day-selected")),
      ),
    })),
  );
  if (!results.some((item) => !item.ok)) results.push({ ok: false, message: String(error) });
  console.error(error);
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      { results, passed: results.filter((item) => item.ok).length, total: results.length },
      null,
      2,
    ),
  );
}
if (results.some((item) => !item.ok)) process.exit(1);
