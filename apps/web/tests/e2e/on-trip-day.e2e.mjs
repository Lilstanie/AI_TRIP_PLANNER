import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3018";
const OUT = resolve("output/playwright/on-trip-day", process.env.RUN_ID ?? "latest");
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, message, observed) => {
  checks.push({ ok: Boolean(ok), message, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${message}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const destination = {
  id: "e2e-sydney",
  displayName: { text: "Sydney" },
  formattedAddress: "Sydney NSW, Australia",
  location: { latitude: -33.8688, longitude: 151.2093 },
  source: "osm",
};
const snapshotSeed = (
  dates,
  tripId,
  includeUnpriced = true,
  budgetTotal = 400,
  estTotal = 400,
  destinationName = "Sydney",
) => {
  const plan = {
    tripId,
    brief: {
      tripId,
      userId: "local",
      destination: destinationName,
      origin: "Honolulu",
      dates,
      groupSize: 1,
      budgetTotal,
    },
    round: 1,
    budgetTotal,
    estTotal,
    overrunPct: 0,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        status: "draft",
        summary: "Sydney stops",
        estCost: 400,
        proposal: {
          agent: "itinerary",
          summary: "Sydney stops",
          items: [
            ...[1, 2, 3, 4].map((day) => ({
              id: `${tripId}-stop-${day}`,
              kind: "activity",
              day,
              detail: `Stop ${day}`,
              estCost: 100,
              startTime: "09:00",
              endTime: "10:00",
            })),
            ...(includeUnpriced
              ? [
                  {
                    id: `${tripId}-unpriced`,
                    kind: "activity",
                    day: 1,
                    detail: "Unpriced attraction",
                  },
                ]
              : []),
          ],
          assumptions: [],
          conflictsWith: [],
        },
      },
      {
        id: "destination-guide",
        label: "Travel tips",
        status: "draft",
        summary: "Local tips",
        estCost: 0,
        proposal: {
          agent: "destination-guide",
          summary: "Local tips",
          items: [{ kind: "safety", detail: "Keep valuables secure." }],
          assumptions: [],
          conflictsWith: [],
        },
      },
    ],
  };
  const snapshot = {
    version: 3,
    id: `${tripId}-chat`,
    savedAt: "2026-10-16T00:00:00Z",
    plan,
    draft: {
      destination: destinationName,
      origin: "Honolulu",
      start: dates[0],
      end: dates[1],
      groupSize: "1",
      budgetTotal: String(budgetTotal),
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [],
    input: "",
  };
  const tripKey = `trip:${tripId}`;
  const conversationKey = `conversation:${snapshot.id}`;
  const catalog = {
    version: 4,
    activeConversationId: conversationKey,
    activeTripId: tripKey,
    conversations: [
      {
        id: conversationKey,
        title: "Sydney",
        updatedAt: snapshot.savedAt,
        tripId: tripKey,
        messages: [],
        input: "",
        snapshot,
      },
    ],
    trips: [
      {
        id: tripKey,
        title: "Sydney",
        updatedAt: snapshot.savedAt,
        conversationIds: [conversationKey],
        snapshot,
      },
    ],
    layout: {
      sidebar: { collapsed: false },
      preferences: { open: false, width: 280 },
      trip: { open: true, width: 340 },
      view: "chat",
      editorView: "map",
    },
  };
  return { snapshot, catalog };
};
const installSnapshot = (page, dates, tripId, includeUnpriced = true) =>
  page.evaluate(
    (seed) => {
      localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
      localStorage.setItem("trip.dataMode", "mock");
      localStorage.setItem("trip.locationPrompt", "dismissed");
    },
    snapshotSeed(dates, tripId, includeUnpriced),
  );
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: "Pacific/Honolulu",
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    (seed) => {
      if (!localStorage.getItem("trip-workspace-catalog-v3")) {
        localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
        localStorage.setItem("trip.dataMode", "mock");
        localStorage.setItem("trip.locationPrompt", "dismissed");
      }
    },
    snapshotSeed(["2026-10-17", "2026-10-19"], "on-trip-sydney-boundary"),
  );
  const page = await context.newPage();
  await page.clock.install({ time: new Date("2026-10-16T14:30:00Z") });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: [destination] } }),
  );
  await page.route("**/api/places/details", (route) =>
    route.fulfill({ json: { place: destination } }),
  );
  const tripTab = page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ });
  const openSeededTrip = async () => {
    await page.locator(".workspace-app").waitFor();
    await page.getByRole("tab", { name: /^Mine/ }).click();
    const mine = page.locator(".phone-mine");
    await mine.locator(".trip-card").first().click();
    await tripTab.click();
  };
  const openTripNamed = async (title) => {
    await page.getByRole("tab", { name: /^Mine/ }).click();
    const cards = page.locator(".phone-mine .trip-card");
    const index = await cards
      .locator(".trip-card__title")
      .evaluateAll(
        (titles, target) => titles.findIndex((item) => item.textContent?.trim() === target),
        title,
      );
    await cards.nth(index).click();
    await tripTab.click();
  };
  await page.goto(BASE);
  await page.locator(".workspace-app").waitFor();
  await openSeededTrip();
  const trip = page.locator("#phone-panel-trip");
  await trip.getByRole("tab", { name: /^Day 1\b/ }).waitFor();
  const today = trip.getByRole("tab", { name: /Today/ });
  await today.waitFor({ timeout: 15_000 }).catch(() => undefined);
  check(
    (await today.count()) === 1,
    "Today marks the Sydney-local current day at the date boundary",
    await trip.getByRole("tab").allInnerTexts(),
  );
  check(
    (await today.count()) === 1 && (await today.getAttribute("data-day")) === "1",
    "Sydney selects Day 1 although Honolulu's date is the previous day",
  );
  const tips = trip.locator(".trip-tips");
  await tips.waitFor();
  check(!(await tips.evaluate((node) => node.open)), "Travel tips start collapsed on-trip");
  const budget = trip.locator(".trip-budget");
  check(
    (await budget.count()) === 1 && !(await budget.evaluate((node) => node.open)),
    "budget starts collapsed on-trip",
  );
  check(
    (await budget.getByText("At budget · unpriced stops not counted", { exact: true }).count()) ===
      1,
    "exact budget with unpriced stops uses the caution status",
  );
  check(
    (await budget.locator(".budget-status--caution").count()) === 1,
    "exact budget with unpriced stops uses the caution class",
  );
  check(
    (await budget.getByText("The known estimate equals your budget.", { exact: true }).count()) ===
      1,
    "exact budget retains its explanation",
  );
  const unpricedCaution = budget.locator(".trip__budget-note");
  check(
    (await unpricedCaution.count()) === 1 &&
      /Not included: costs for stops without a published price \(1\)\./.test(
        await unpricedCaution.evaluate((node) => node.textContent ?? ""),
      ),
    "unpriced-stop detail and existing class remain present",
    await unpricedCaution.evaluate((node) => node.textContent),
  );
  await trip.getByRole("tab", { name: /^Day 2\b/ }).click();
  check(
    (await trip.getByRole("tab", { name: /^Day 2\b/ }).getAttribute("aria-selected")) === "true",
    "manual day selection remains usable",
  );
  await page.reload();
  await openSeededTrip();
  check(
    (await page
      .locator("#phone-panel-trip")
      .getByRole("tab", { name: /^Day 2\b/ })
      .getAttribute("aria-selected")) === "true",
    "manual day selection is restored after reload",
  );
  await page.screenshot({ path: `${OUT}/on-trip-sydney-boundary.png`, fullPage: true });

  await page.evaluate(() => localStorage.setItem("trip-tips-folded:on-trip-sydney-boundary", "0"));
  await page.reload();
  await openSeededTrip();
  await trip.locator(".trip-tips").waitFor();
  check(
    await trip.locator(".trip-tips").evaluate((node) => node.open),
    "an explicit saved open preference overrides the on-trip default",
  );

  await installSnapshot(page, ["2026-10-17", "2026-10-19"], "exact-budget-priced-only", false);
  await page.reload();
  await openSeededTrip();
  const ordinaryBudget = page.locator("#phone-panel-trip .trip-budget");
  check(
    (await ordinaryBudget.getByText("At budget", { exact: true }).count()) === 1,
    "exact budget without unpriced stops retains ordinary status",
  );
  check(
    (await ordinaryBudget.locator(".budget-status--caution").count()) === 0,
    "exact budget without unpriced stops has no caution class",
  );

  await installSnapshot(page, ["2026-10-18", "2026-10-19"], "before-trip-sydney-boundary", false);
  await page.reload();
  await openSeededTrip();
  await trip.getByRole("tab", { name: /^Day 1\b/ }).waitFor();
  check(
    (await trip.getByRole("tab", { name: /Today/ }).count()) === 0,
    "Before the destination-local start date, no day is marked Today",
  );
  check(
    (await trip.getByRole("tab", { name: /^Day 1\b/ }).getAttribute("aria-selected")) === "true",
    "Before the trip, Day 1 remains the default",
  );
  check(
    await tips.evaluate((node) => node.open),
    "Before the trip, Travel tips retain the existing expanded default",
  );
  check(
    await trip.locator(".trip-budget").evaluate((node) => node.open),
    "Before the trip, budget retains the existing expanded default",
  );

  const secondTrip = snapshotSeed(
    ["2026-10-17", "2026-10-19"],
    "on-trip-second-budget-default",
    false,
    400,
    400,
    "Sydney alternate",
  );
  await page.evaluate((seed) => {
    const catalog = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"));
    catalog.conversations.push(...seed.catalog.conversations);
    catalog.trips.push(...seed.catalog.trips);
    localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
  }, secondTrip);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".phone-mine .trip-card").length >= 2);
  await openTripNamed("Trip to Sydney");
  const firstBudget = page.locator("#phone-panel-trip .trip-budget");
  if (!(await firstBudget.evaluate((node) => node.open))) {
    await firstBudget.locator("summary").click();
  }
  await page.getByRole("tab", { name: /^Mine/ }).click();
  const tripCards = page.locator(".phone-mine .trip-card");
  await tripCards.filter({ hasText: "Sydney alternate" }).click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("trip-workspace-catalog-v3")).activeTripId !==
      "trip:before-trip-sydney-boundary",
  );
  await tripTab.click();
  const secondBudget = page.locator("#phone-panel-trip .trip-budget");
  await secondBudget.waitFor();
  const secondToday = page.locator("#phone-panel-trip").getByRole("tab", { name: /Today/ });
  await secondToday.waitFor({ timeout: 5_000 }).catch(() => undefined);
  check(
    (await secondToday.count()) === 1,
    "the newly selected trip retains Today",
    await page.locator("#phone-panel-trip [role=tab]").allInnerTexts(),
  );
  await page.waitForTimeout(500);
  check(
    !(await secondBudget.evaluate((node) => node.open)),
    "manual budget expansion on one trip does not override the next trip's collapsed default",
  );
  await page.evaluate(
    (seed) => {
      localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
    },
    snapshotSeed(["2026-10-17", "2026-10-19"], "on-trip-budget-headroom-unpriced", true, 500, 480),
  );
  await page.reload();
  await openSeededTrip();
  const headroomBudget = page.locator("#phone-panel-trip .trip-budget");
  await headroomBudget.waitFor();
  check(
    (await headroomBudget
      .getByText("Known estimate within budget · unpriced stops not counted", { exact: true })
      .count()) === 1,
    "below-budget estimate with unpriced stops is qualified",
  );
  check(
    (await headroomBudget.locator(".budget-status--caution").count()) === 1,
    "below-budget estimate with unpriced stops uses caution status",
  );
  check(errors.length === 0, "no browser errors", errors);
  await page.screenshot({ path: `${OUT}/before-trip.png`, fullPage: true });
  await context.close();
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((result) => !result.ok)) process.exitCode = 1;
