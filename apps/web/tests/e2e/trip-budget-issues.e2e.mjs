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
  console.log(`${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`);
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
      ...section("accommodation", "Accommodation", "accommodation", [
        { id: "stay-budget", kind: "hotel", detail: "Selected fixture stay", day: 1, selectionId: "stay-1" },
      ], 200),
      proposal: {
        agent: "accommodation", summary: "Accommodation fixture", assumptions: [], conflictsWith: [],
        items: [{ id: "stay-budget", kind: "hotel", detail: "Selected fixture stay", day: 1, selectionId: "stay-1" }],
        stays: [{
          id: "stay-1", city: "Sydney", checkIn: "2026-12-16", checkOut: "2026-12-18", day: 1,
          nights: 2, rooms: 2, selectedId: "stay-selected",
          candidates: [
            { id: "stay-selected", name: "Selected stay", area: "CBD", pricePerNight: 50, rating: 8 },
            { id: "stay-alternative", name: "Unselected expensive stay", area: "CBD", pricePerNight: 999, rating: 9 },
          ],
        }],
      },
    },
    {
      ...section("transport", "Transport", "transport", [
        { id: "flight-budget", kind: "flight", detail: "Selected fixture flight", day: 1, selectionId: "flight-1" },
      ], 40),
      proposal: {
        agent: "transport", summary: "Transport fixture", assumptions: [], conflictsWith: [],
        items: [{ id: "flight-budget", kind: "flight", detail: "Selected fixture flight", day: 1, selectionId: "flight-1" }],
        flights: [{
          id: "flight-1", from: "MEL", to: "SYD", depart: "2026-12-16", day: 1, passengers: 2,
          selectedId: "flight-selected",
          candidates: [
            { id: "flight-selected", carrier: "Selected Air", price: 40 },
            { id: "flight-alternative", carrier: "Alternative Air", price: 999 },
          ],
        }],
      },
    },
    section("dining", "Dining", "dining", [], 0),
    section(
      "itinerary",
      "Day plan",
      "itinerary",
      [
        item("priced", "Priced gallery", { estCost: 300, location: "Sydney Opera House", startTime: "09:00", endTime: "11:00" }),
        item("zero", "Free garden", { estCost: 0, location: "Royal Botanic Garden", startTime: "10:00", endTime: "12:00" }),
        item("unknown", "Unpriced museum", { location: "" }),
        item("failed", "Lookup failure cafe", { location: "Lookup failure cafe", startTime: "13:00", endTime: "14:00" }),
      ],
      300,
    ),
  ],
  conflicts: [],
};
const savedAt = new Date(0).toISOString();
const snapshot = {
  version: 4,
  id: "trip-budget-issues-fixture",
  savedAt,
  plan,
  draft: {
    destination: "Sydney", origin: "", start: plan.brief.dates[0], end: plan.brief.dates[1],
    groupSize: "2", budgetTotal: "400", preferences: [], nationality: "", roomAllocation: "shared",
    minRating: "0", freeCancellation: false,
  },
  messages: [{ role: "user", text: "Create a fixture trip." }, { role: "agent", text: "Ready." }],
  input: "",
};
const conversationId = "conversation:trip-budget-issues-fixture";
const tripId = "trip:trip-budget-issues-fixture";
const catalog = {
  version: 4,
  activeConversationId: conversationId,
  activeTripId: tripId,
  conversations: [{ id: conversationId, title: "Sydney budget issues fixture", updatedAt: savedAt, tripId, messages: snapshot.messages, input: "", snapshot }],
  trips: [{ id: tripId, title: "Sydney budget issues fixture", updatedAt: savedAt, conversationIds: [conversationId], snapshot }],
  layout: { sidebar: { collapsed: false }, preferences: { width: 280 }, trip: { width: 340 }, view: "chat", editorView: "map" },
};
const settings = {
  version: 1, travel: { homeCity: "", preferences: [], interests: [], dietary: [] }, memberships: [],
  assistant: { style: "neutral", memory: true }, dataMode: "mock", appearance: "system", language: "en",
  displayCurrency: "JPY", updatedAt: savedAt,
};
const browser = await chromium.launch({ headless: true, ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}) });
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe") await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [] }) });
  });
  await page.addInitScript(({ seed, userSettings }) => {
    localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
    localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
  }, { seed: catalog, userSettings: settings });
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
  check(/JPY\s*54,000/.test(await summary.innerText()), "compact summary shows known estimate in display currency", await summary.innerText());
  check(/JPY\s*40,000/.test(await summary.innerText()), "budget limit uses display currency", await summary.innerText());
  check(!(await budget.evaluate((node) => node.open)), "item breakdown starts collapsed");
  await budget.locator("summary").click();
  check(await budget.getByText("Free garden", { exact: true }).count() > 0, "breakdown distinguishes a known zero item");
  check(await budget.getByText("Unpriced museum", { exact: true }).count() > 0, "breakdown discloses an unknown item without a zero amount");
  check(await budget.getByText("JPY 20,000", { exact: true }).count() > 0, "selected stay uses nightly rate times rooms and nights", await budget.innerText());
  check(await budget.getByText("JPY 4,000", { exact: true }).count() > 0, "selected flight fare is counted once for the whole group", await budget.innerText());
  check(await budget.getByText("Unselected expensive stay", { exact: true }).count() === 0 && await budget.getByText("Alternative Air", { exact: true }).count() === 0, "unselected booking alternatives are excluded from item rows");
  const issues = page.getByRole("region", { name: /Trip issues|行程问题/ });
  check(await issues.count() === 1, "issue summary is present in the Trip panel");
  if (await issues.count()) {
    await issues.getByRole("heading", { name: /Unlocated place/ }).waitFor();
    await issues.getByRole("heading", { name: /Place lookup failed/ }).waitFor();
    const issueText = await issues.innerText();
    check(/time conflict/i.test(issueText) && /unlocated/i.test(issueText) && /unpriced/i.test(issueText) && /lookup failed/i.test(issueText), "issue summary distinguishes all required issue types", issueText);
    check(await issues.getByRole("button", { name: /Priced gallery/ }).count() > 0, "time conflict links to an affected Stop");
    await issues.getByRole("button", { name: /Unpriced museum/ }).click();
    const selectedUnpricedStop = page.locator(".timeline-stop__main").filter({ hasText: "Unpriced museum" });
    check((await selectedUnpricedStop.getAttribute("aria-expanded")) === "true", "unpriced issue navigates to and opens its Stop");
    await issues.getByRole("button", { name: /Unlocated place.*Unpriced museum/ }).click();
    const selectedUnlocatedStop = page.locator(".timeline-stop__main").filter({ hasText: "Unpriced museum" });
    check((await selectedUnlocatedStop.getAttribute("aria-expanded")) === "true", "unlocated issue navigates to and opens its Stop");
    await issues.getByRole("button", { name: /Time conflict.*Priced gallery/ }).click();
    const selectedOverlapStop = page.locator(".timeline-stop__main").filter({ hasText: "Priced gallery" });
    check((await selectedOverlapStop.getAttribute("aria-expanded")) === "true", "time conflict navigates to and opens an overlapping Stop");
  }
  check(errors.length === 0, "fixture Trip renders without runtime errors", errors);
  await page.screenshot({ path: `${OUT}/budget-issues.png`, fullPage: true });

  const zhContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN", reducedMotion: "reduce" });
  const zhPage = await zhContext.newPage();
  zhPage.on("pageerror", (error) => errors.push(String(error)));
  await zhPage.route("**/api/places/search", async (route) => {
    const body = route.request().postDataJSON();
    if (body.text === "Lookup failure cafe") await route.fulfill({ status: 503, body: "fixture lookup failure" });
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ places: [] }) });
  });
  await zhPage.addInitScript(({ seed, userSettings }) => {
    localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
    localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
  }, { seed: catalog, userSettings: { ...settings, language: "zh" } });
  await zhPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await zhPage.locator(".workspace-app").waitFor();
  await zhPage.getByRole("button", { name: /^聊天/ }).click();
  await zhPage.locator('.history-item__open[title="Sydney budget issues fixture"]').click();
  const localizedOpenTrip = zhPage.getByRole("button", { name: "打开你的行程", exact: true });
  if (await localizedOpenTrip.count()) await localizedOpenTrip.click();
  await zhPage.locator(".trip-panel").waitFor();
  const localizedSummary = zhPage.locator(".trip-panel__budget-summary > summary");
  const localizedText = await localizedSummary.innerText();
  check(/JPY\s*54,000|¥\s*54,000/.test(localizedText), "Chinese compact summary retains the JPY known estimate", localizedText);
  check(/行程预算|预算/.test(localizedText), "budget summary labels are localized in Chinese", localizedText);
  const localizedIssues = zhPage.getByRole("region", { name: /行程问题/ });
  check(await localizedIssues.count() === 1, "Chinese issue summary is present in the Trip panel");
  if (await localizedIssues.count()) {
    await localizedIssues.getByRole("heading", { name: /尚未定位/ }).waitFor();
    await localizedIssues.getByRole("heading", { name: /地点查询失败/ }).waitFor();
    const issueText = await localizedIssues.innerText();
    check(/时间冲突/.test(issueText) && /尚未定位/.test(issueText) && /未定价/.test(issueText) && /地点查询失败/.test(issueText), "Chinese issue groups distinguish overlap, unlocated, unpriced and lookup failure", issueText);
  }
  await zhPage.screenshot({ path: `${OUT}/budget-issues-zh.png`, fullPage: true });
  await zhContext.close();
  await context.close();
} catch (error) {
  if (page) {
    writeFileSync(`${OUT}/failure-state.txt`, `${page.url()}\n${await page.locator("body").innerText().catch(() => "")}`);
    await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
  }
  check(false, "budget and issue journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
