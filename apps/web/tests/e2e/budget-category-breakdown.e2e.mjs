import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/budget-category-breakdown", process.env.LABEL ?? "after");
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
const item = (kind, detail, estCost, day = 1) => ({
  kind,
  detail,
  ...(estCost === undefined ? {} : { estCost }),
  day,
  startTime: "09:00",
  endTime: "10:00",
  location: "Sydney",
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
  tripId: "budget-breakdown-485",
  brief: {
    tripId: "budget-breakdown-485",
    userId: "e2e",
    destination: "Sydney",
    dates: ["2026-12-16", "2026-12-17"],
    groupSize: 2,
    budgetTotal: 800,
  },
  round: 1,
  budgetTotal: 800,
  estTotal: 360,
  overrunPct: -55,
  sections: [
    section(
      "accommodation",
      "Accommodation",
      "accommodation",
      [item("stay", "Mock stay", 180)],
      180,
    ),
    section("transport", "Transport", "transport", [item("flight", "Mock transport", 80)], 80),
    section("dining", "Dining", "dining", [item("meal", "Mock meal", 60)], 60),
    section(
      "itinerary",
      "Day plan",
      "itinerary",
      [
        item("activity", "Priced activity", 40),
        item("activity", "Unpriced activity", undefined, 1),
      ],
      40,
    ),
    section("destination-guide", "Travel tips", "destination-guide", [], 0),
  ],
  conflicts: [],
};
const savedAt = new Date(0).toISOString();
const snapshot = {
  version: 4,
  id: "budget-breakdown-485",
  savedAt,
  plan,
  draft: {
    destination: "Sydney",
    origin: "",
    start: plan.brief.dates[0],
    end: plan.brief.dates[1],
    groupSize: "2",
    budgetTotal: "800",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [
    { role: "user", text: "Create a mock trip." },
    { role: "agent", text: "Ready." },
  ],
  input: "",
};
const conversationId = "conversation:budget-breakdown-485";
const tripId = "trip:budget-breakdown-485";
const catalog = {
  version: 4,
  activeConversationId: conversationId,
  activeTripId: tripId,
  conversations: [
    {
      id: conversationId,
      title: "Sydney budget breakdown",
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
      title: "Sydney budget breakdown",
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
  displayCurrency: "AUD",
  updatedAt: savedAt,
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    locale: "en-AU",
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  await page.addInitScript(
    ({ key, value, settingsKey, settingsValue }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(settingsKey, JSON.stringify(settingsValue));
    },
    { key: CATALOG_KEY, value: catalog, settingsKey: SETTINGS_KEY, settingsValue: settings },
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  const drawer = page.locator(".workspace-drawer--nav");
  if (!(await drawer.isVisible()))
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('.history-item__open[title="Sydney budget breakdown"]').waitFor();
  await page.locator('.history-item__open[title="Sydney budget breakdown"]').click();
  await page.getByRole("button", { name: "Open your trip" }).click();
  const budget = page.locator(".trip-panel__budget-summary");
  await budget.waitFor();
  const breakdown = budget.locator('[aria-label="Budget breakdown"]');
  check((await breakdown.count()) === 1, "budget card exposes a category breakdown");
  const rows = await breakdown
    .locator("li")
    .allInnerTexts()
    .catch(() => []);
  check(
    ["Accommodation", "Transport", "Meals", "Activities"].every((label) =>
      rows.some((row) => row.includes(label)),
    ),
    "breakdown lists accommodation, transport, meals and activities",
    rows,
  );
  check(
    [180, 80, 60, 40].every((amount) =>
      rows.some((row) => new RegExp(`(?:A\\$|AUD\\s*)${amount}\\.00`).test(row)),
    ),
    "known category estimates show their amounts",
    rows,
  );
  const estimateValues = rows.flatMap((row) =>
    [...row.matchAll(/(?:A\$|AUD\s*)([\d,]+\.\d{2})/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    ),
  );
  check(
    estimateValues.reduce((sum, amount) => sum + amount, 0) === plan.estTotal,
    "category estimates reconcile to the displayed total",
    { estimateValues, total: plan.estTotal },
  );
  check(
    rows.some((row) => /estimated/i.test(row)),
    "category amounts are identified as estimates",
    rows,
  );
  check(
    rows.some((row) => /unpriced|not priced/i.test(row)),
    "unpriced activity is disclosed without an invented amount",
    rows,
  );
  await page.screenshot({ path: `${OUT}/budget-breakdown.png`, fullPage: true });
  await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
  const zhBreakdown = page.locator('[aria-label="预算明细"]');
  await zhBreakdown.waitFor();
  const zhRows = await zhBreakdown.locator("li").allInnerTexts();
  check(
    ["住宿", "交通", "餐饮", "活动"].every((label) => zhRows.some((row) => row.includes(label))) &&
      zhRows.every((row) => row.includes("估算")) &&
      zhRows.some((row) => row.includes("1 项未定价")),
    "Chinese breakdown labels and estimate/unpriced markers are translated",
    zhRows,
  );
  await page.screenshot({ path: `${OUT}/budget-breakdown-zh.png`, fullPage: true });
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
  check(false, "budget breakdown journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
