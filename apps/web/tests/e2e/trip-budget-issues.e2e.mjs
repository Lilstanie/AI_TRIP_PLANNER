import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3114";
const OUT = resolve("output/playwright/trip-budget-issues", process.env.LABEL ?? "before");
const CATALOG_KEY = "trip-workspace-catalog-v3";
const SETTINGS_KEY = "trip.settings.v1";
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const item = (id, detail, options = {}) => ({
  id,
  kind: "activity",
  detail,
  ...(options.location === "" ? {} : { location: options.location ?? detail }),
  day: options.day ?? 1,
  startTime: options.startTime ?? "09:00",
  endTime: options.endTime ?? "10:00",
  ...(options.estCost === undefined ? {} : { estCost: options.estCost }),
});
const section = (id, label, agent, items, estCost) => ({
  id,
  label,
  summary: `${label} fixture`,
  status: "draft",
  estCost,
  proposal: { agent, summary: `${label} fixture`, items, assumptions: [], conflictsWith: [] },
});
const plan = {
  tripId: "trip-budget-issues-fixture",
  brief: {
    tripId: "trip-budget-issues-fixture",
    userId: "e2e",
    destination: "Sydney",
    dates: ["2026-12-16", "2026-12-17"],
    groupSize: 2,
    budgetTotal: 400,
    displayCurrency: "AUD",
  },
  round: 1,
  budgetTotal: 400,
  estTotal: 540,
  overrunPct: 20,
  sections: [
    {
      ...section(
        "accommodation",
        "Accommodation",
        "accommodation",
        [
          {
            id: "stay-budget",
            kind: "hotel",
            detail: "Selected fixture stay",
            day: 1,
            selectionId: "stay-1",
          },
          { id: "stay-unpriced", kind: "hotel", detail: "Unpriced stay without a day" },
        ],
        200,
      ),
      proposal: {
        agent: "accommodation",
        summary: "Accommodation fixture",
        assumptions: [],
        conflictsWith: [],
        items: [
          {
            id: "stay-budget",
            kind: "hotel",
            detail: "Selected fixture stay",
            day: 1,
            selectionId: "stay-1",
          },
          { id: "stay-unpriced", kind: "hotel", detail: "Unpriced stay without a day" },
        ],
        stays: [
          {
            id: "stay-1",
            city: "Sydney",
            checkIn: "2026-12-16",
            checkOut: "2026-12-18",
            day: 1,
            nights: 2,
            rooms: 2,
            selectedId: "stay-selected",
            candidates: [
              {
                id: "stay-selected",
                name: "Selected stay",
                area: "CBD",
                pricePerNight: 50,
                rating: 8,
              },
              {
                id: "stay-alternative",
                name: "Unselected expensive stay",
                area: "CBD",
                pricePerNight: 999,
                rating: 9,
              },
            ],
          },
        ],
      },
    },
    {
      ...section(
        "transport",
        "Transport",
        "transport",
        [
          {
            id: "flight-budget",
            kind: "flight",
            detail: "Selected fixture flight",
            day: 1,
            selectionId: "flight-1",
          },
        ],
        40,
      ),
      proposal: {
        agent: "transport",
        summary: "Transport fixture",
        assumptions: [],
        conflictsWith: [],
        items: [
          {
            id: "flight-budget",
            kind: "flight",
            detail: "Selected fixture flight",
            day: 1,
            selectionId: "flight-1",
          },
        ],
        flights: [
          {
            id: "flight-1",
            from: "MEL",
            to: "SYD",
            depart: "2026-12-16",
            day: 1,
            passengers: 2,
            selectedId: "flight-selected",
            candidates: [
              { id: "flight-selected", carrier: "Selected Air", price: 40 },
              { id: "flight-alternative", carrier: "Alternative Air", price: 999 },
            ],
          },
        ],
      },
    },
    section(
      "dining",
      "Dining",
      "dining",
      [
        { kind: "meal", detail: "Unpriced meal without a day" },
        {
          id: "scheduled-restaurant",
          kind: "meal",
          detail: "Scheduled restaurant",
          estCost: undefined,
        },
      ],
      0,
    ),
    section(
      "itinerary",
      "Day plan",
      "itinerary",
      [
        item("priced", "Priced gallery", {
          estCost: 300,
          location: "Sydney Opera House",
          startTime: "09:00",
          endTime: "11:00",
        }),
        item("zero", "Free garden", {
          estCost: 0,
          location: "Royal Botanic Garden",
          startTime: "10:00",
          endTime: "12:00",
        }),
        item("unknown", "Unpriced museum", { location: "" }),
        item("failed", "Lookup failure cafe", {
          location: "Lookup failure cafe",
          startTime: "13:00",
          endTime: "14:00",
        }),
        {
          id: "scheduled-restaurant",
          kind: "meal",
          detail: "Scheduled restaurant",
          day: 1,
          location: "Sydney",
          startTime: "18:00",
          endTime: "19:00",
        },
      ],
      300,
    ),
  ],
  conflicts: [],
  editIssues: [
    {
      code: "route_unavailable",
      message: "Route to the harbour could not be verified",
      activityIds: [],
    },
    {
      code: "route_unavailable",
      message: "Gallery transfer could not be verified",
      activityIds: ["priced"],
    },
    {
      code: "price_unverified",
      message: "Changed activity price requires verification",
      activityIds: ["priced"],
    },
  ],
};
const savedAt = new Date(0).toISOString();
const snapshot = {
  version: 4,
  id: "trip-budget-issues-fixture",
  savedAt,
  plan,
  draft: {
    destination: "Sydney",
    origin: "",
    start: plan.brief.dates[0],
    end: plan.brief.dates[1],
    groupSize: "2",
    budgetTotal: "400",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [
    { role: "user", text: "Create a fixture trip." },
    { role: "agent", text: "Ready." },
  ],
  input: "",
};
const conversationId = "conversation:trip-budget-issues-fixture";
const tripId = "trip:trip-budget-issues-fixture";
const catalog = {
  version: 4,
  activeConversationId: conversationId,
  activeTripId: tripId,
  conversations: [
    {
      id: conversationId,
      title: "Sydney budget issues fixture",
      updatedAt: savedAt,
      tripId,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
  ],
  trips: [
    {
      id: tripId,
      title: "Sydney budget issues fixture",
      updatedAt: savedAt,
      conversationIds: [conversationId],
      snapshot,
    },
  ],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "system",
  language: "en",
  displayCurrency: "JPY",
  updatedAt: savedAt,
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe")
      await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ places: [] }),
      });
  });
  await page.addInitScript(
    ({ seed, userSettings }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
      localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
    },
    { seed: catalog, userSettings: settings },
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.getByRole("button", { name: /^Chats/ }).click();
  const history = page.locator('.history-item__open[title="Sydney budget issues fixture"]');
  await history.waitFor();
  await history.click();
  const openTrip = page.getByRole("button", { name: "Open your trip" });
  if (await openTrip.count()) await openTrip.click();
  await page.locator(".trip-panel").waitFor();
  const budget = page.locator(".trip-panel__budget-summary");
  const summary = budget.locator("summary");
  check(
    /JPY\s*54,000/.test(await summary.innerText()),
    "the budget line shows the known estimate in display currency",
    await summary.innerText(),
  );
  check(
    /JPY\s*40,000/.test(await summary.innerText()),
    "budget limit uses display currency",
    await summary.innerText(),
  );
  check(
    /4 unpriced/.test(await summary.innerText()),
    "compact unknown count covers accommodation and activities; scheduled restaurant is counted once while an unplanned meal idea is excluded",
    await summary.innerText(),
  );
  check(!(await budget.evaluate((node) => node.open)), "item breakdown starts collapsed");
  await budget.locator("summary").click();
  check(
    (await budget.getByText("Free garden", { exact: true }).count()) === 0 &&
      (await budget.getByText("Unpriced museum", { exact: true }).count()) === 0,
    "the budget lists categories, not individual items",
  );
  check(
    (await budget.getByText("JPY 20,000", { exact: true }).count()) > 0,
    "the accommodation row totals the selected stay: nightly rate times rooms and nights",
    await budget.innerText(),
  );
  check(
    (await budget.getByText("JPY 4,000", { exact: true }).count()) > 0,
    "the transport row counts the selected flight fare once for the whole group",
    await budget.innerText(),
  );
  check(
    (await budget.getByText("Unselected expensive stay", { exact: true }).count()) === 0 &&
      (await budget.getByText("Alternative Air", { exact: true }).count()) === 0,
    "unselected booking alternatives are excluded from item rows",
  );
  check(
    (await page.getByRole("region", { name: /Trip issues|行程问题/ }).count()) === 0 &&
      (await page
        .locator(".trip-panel")
        .getByText(/Trip issues/)
        .count()) === 0,
    "the Trip issues block is gone from the Trip panel",
  );
  const badge = page.getByRole("button", { name: /^Open items/ });
  await badge.waitFor();
  const popover = page.getByRole("dialog", { name: "Open items" });
  const rowNames = async () =>
    await popover.getByRole("button").evaluateAll((nodes) => nodes.map((n) => n.ariaLabel ?? ""));
  await badge.click();
  await popover.waitFor();
  const rows = await rowNames();
  const badgeCount = Number((await badge.innerText()).trim());
  const listed = await popover.getByRole("listitem").allInnerTexts();
  check(
    listed.length === badgeCount && badgeCount > 0,
    "badge count equals the number of popover rows",
    { badgeCount, listed },
  );
  check(
    listed.filter((text) => text.includes("Route to the harbour could not be verified")).length ===
      1 &&
      (await popover.getByRole("button", { name: /harbour/ }).count()) === 0 &&
      !listed.some((text) => /Gallery transfer|requires verification/.test(text)),
    "an unattached edit issue is listed once as plain text; attached and price issues are not",
    listed,
  );
  check(
    rows.filter((r) => r.startsWith("Time conflict")).length === 3 &&
      rows.filter((r) => r.startsWith("Unlocated place")).length === 3 &&
      rows.some((r) => /^Unlocated place: Unpriced museum/.test(r)) &&
      rows.some((r) => /^Place lookup failed: Lookup failure cafe/.test(r)) &&
      rows.length === 7,
    "count is time conflicts + unlocated places + failed lookups",
    rows,
  );
  check(
    !rows.some((r) => /^Unpriced/.test(r)) &&
      (await popover.getByText(/Unpriced stay/).count()) === 0,
    "unpriced items are not open items",
    rows,
  );
  check(
    /4 unpriced/.test(await summary.innerText()),
    "unpriced items stay counted on the budget line",
  );
  const classes = await popover.getAttribute("class");
  check(
    /\bglass-float\b/.test(classes ?? "") && /\bglass-float--raised\b/.test(classes ?? ""),
    "popover uses the glass-float raised contract",
    classes,
  );
  check(
    (await popover.evaluate((node) => getComputedStyle(node).position)) !== "static" &&
      (await page.locator(".timeline-stop__main").first().isVisible()),
    "popover floats and the timeline stays visible",
  );
  const popoverBox = await popover.boundingBox();
  const titleBox = await page.locator(".chat-header__title").boundingBox();
  const badgeBox = await badge.boundingBox();
  check(
    popoverBox !== null &&
      popoverBox.x + popoverBox.width <= 1440 &&
      titleBox !== null &&
      badgeBox !== null &&
      badgeBox.x - (titleBox.x + titleBox.width) < 24,
    "desktop badge sits next to the trip title and its popover fits the viewport",
    { popoverBox, titleBox, badgeBox },
  );
  const rowFill = await popover
    .getByRole("button")
    .first()
    .evaluate((node) => getComputedStyle(node).backdropFilter);
  check(rowFill === "none" || rowFill === "", "rows inside the popover are opaque", rowFill);
  await page.screenshot({ path: `${OUT}/open-items-popover.png`, fullPage: true });
  const stopOf = (text) => page.locator(".timeline-stop__main").filter({ hasText: text });
  const pick = async (name, stop) => {
    if (!(await popover.count())) await badge.click();
    await popover.getByRole("button", { name }).click();
    check(
      (await stopOf(stop).getAttribute("aria-expanded")) === "true",
      `${name} selects and opens its Stop`,
    );
    check((await popover.count()) === 0, `${name} closes the popover`);
  };
  await pick(/Time conflict: Priced gallery/, "Priced gallery");
  await pick(/Unlocated place: Unpriced museum/, "Unpriced museum");
  await pick(/Place lookup failed: Lookup failure cafe/, "Lookup failure cafe");
  await badge.click();
  await popover.waitFor();
  await page.keyboard.press("Escape");
  check((await popover.count()) === 0, "Esc closes the popover");
  await badge.click();
  await popover.waitFor();
  await page.mouse.click(700, 960);
  check((await popover.count()) === 0, "outside click closes the popover");
  check(errors.length === 0, "fixture Trip renders without runtime errors", errors);
  await page.screenshot({ path: `${OUT}/budget-issues.png`, fullPage: true });

  const zhContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const zhPage = await zhContext.newPage();
  zhPage.on("pageerror", (error) => errors.push(String(error)));
  await zhPage.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe")
      await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ places: [] }),
      });
  });
  await zhPage.addInitScript(
    ({ seed, userSettings }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
      localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
    },
    { seed: catalog, userSettings: { ...settings, language: "zh" } },
  );
  await zhPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await zhPage.locator(".workspace-app").waitFor();
  await zhPage.getByRole("button", { name: /^聊天/ }).click();
  await zhPage.locator('.history-item__open[title="Sydney budget issues fixture"]').click();
  const localizedOpenTrip = zhPage.getByRole("button", { name: "打开你的行程", exact: true });
  if (await localizedOpenTrip.count()) await localizedOpenTrip.click();
  await zhPage.locator(".trip-panel").waitFor();
  const localizedSummary = zhPage.locator(".trip-panel__budget-summary > summary");
  const localizedText = await localizedSummary.innerText();
  check(
    /JPY\s*54,000|¥\s*54,000/.test(localizedText),
    "Chinese compact summary retains the JPY known estimate",
    localizedText,
  );
  check(
    /行程预算|预算/.test(localizedText),
    "budget summary labels are localized in Chinese",
    localizedText,
  );
  check(
    /4 项未定价/.test(localizedText),
    "Chinese compact unknown count covers accommodation and activities once",
    localizedText,
  );
  check(
    (await zhPage.getByRole("region", { name: "行程问题" }).count()) === 0 &&
      (await zhPage
        .locator(".trip-panel")
        .getByText(/行程问题/)
        .count()) === 0,
    "Chinese Trip panel has no Trip issues block",
  );
  const zhBadge = zhPage.getByRole("button", { name: /^待处理事项/ });
  await zhBadge.waitFor();
  await zhBadge.click();
  const zhPopover = zhPage.getByRole("dialog", { name: "待处理事项" });
  await zhPopover.waitFor();
  const zhText = await zhPopover.innerText();
  check(
    /行程问题/.test(zhText) &&
      /时间冲突/.test(zhText) &&
      /尚未定位/.test(zhText) &&
      /地点查询失败/.test(zhText) &&
      !/未定价项目/.test(zhText),
    "Chinese popover distinguishes conflict, unlocated and lookup failure without unpriced items",
    zhText,
  );
  await zhPage.screenshot({ path: `${OUT}/budget-issues-zh.png`, fullPage: true });
  await zhContext.close();

  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const phonePage = await phoneContext.newPage();
  phonePage.on("pageerror", (error) => errors.push(String(error)));
  await phonePage.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe")
      await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ places: [] }),
      });
  });
  await phonePage.addInitScript(
    ({ seed, userSettings }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
      localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
    },
    { seed: catalog, userSettings: settings },
  );
  await phonePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await phonePage.locator(".workspace-app").waitFor();
  await phonePage.getByRole("tab", { name: "Mine", exact: true }).click();
  await phonePage.locator('.history-item__open[title="Sydney budget issues fixture"]').click();
  await phonePage.getByRole("tab", { name: /^Trip/ }).click();
  await phonePage.locator(".trip-panel").waitFor();
  check(
    (await phonePage.getByRole("region", { name: /Trip issues/ }).count()) === 0 &&
      (await phonePage
        .locator(".trip-panel")
        .getByText(/Trip issues/)
        .count()) === 0,
    "phone Trip panel has no Trip issues block",
  );
  const firstPhoneStop = phonePage.locator(".timeline-stop__main").first();
  const firstPhoneStopBox = await firstPhoneStop.boundingBox();
  check(
    (await firstPhoneStop.isVisible()) &&
      firstPhoneStopBox !== null &&
      firstPhoneStopBox.y + firstPhoneStopBox.height <= 844,
    "390px phone first Stop remains within the initial viewport",
    firstPhoneStopBox,
  );
  const phoneBadge = phonePage.getByRole("button", { name: /^Open items/ });
  await phoneBadge.waitFor();
  const phoneBadgeBox = await phoneBadge.boundingBox();
  check(
    phoneBadgeBox !== null &&
      phoneBadgeBox.height >= 44 &&
      phoneBadgeBox.x + phoneBadgeBox.width <= 390,
    "phone badge has a 44px hit area inside the viewport",
    phoneBadgeBox,
  );
  await phoneBadge.click();
  const phonePopover = phonePage.getByRole("dialog", { name: "Open items" });
  await phonePopover.waitFor();
  const phonePopoverBox = await phonePopover.boundingBox();
  check(
    phonePopoverBox !== null &&
      phonePopoverBox.x >= 0 &&
      phonePopoverBox.x + phonePopoverBox.width <= 390,
    "phone popover fits the viewport",
    phonePopoverBox,
  );
  check(
    (await phonePage.evaluate(() => document.documentElement.scrollWidth)) <= 390,
    "phone has no horizontal overflow with the popover open",
  );
  await phonePopover.getByRole("button", { name: /Place lookup failed/ }).click();
  check((await phonePopover.count()) === 0, "phone row closes the popover");
  await phonePage.screenshot({ path: `${OUT}/budget-issues-phone.png`, fullPage: true });
  await phoneContext.close();
  await context.close();
} catch (error) {
  if (page) {
    writeFileSync(
      `${OUT}/failure-state.txt`,
      `${page.url()}\n${await page
        .locator("body")
        .innerText()
        .catch(() => "")}`,
    );
    await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  }
  check(false, "budget and issue journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
