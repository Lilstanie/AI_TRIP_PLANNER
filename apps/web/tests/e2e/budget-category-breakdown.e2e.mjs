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
async function transportCases() {
  const cases = [
    { name: "empty", items: [], amount: 0, unknown: true },
    { name: "absent", items: null, amount: 0, unknown: true },
    { name: "unpriced", items: [item("flight", "Fare not published")], amount: 0, unknown: true },
    { name: "free", items: [item("transport", "Free shuttle", 0)], amount: 0 },
    { name: "quoted", items: [item("flight", "Published fare", 80)], amount: 80 },
    { name: "legacy", items: [], amount: 80 },
    { name: "at-budget", items: [], amount: 0, unknown: true, budget: 280 },
    { name: "over-budget", items: [], amount: 0, unknown: true, budget: 200 },
    { name: "jpy", items: [], amount: 0, unknown: true, currency: "JPY" },
    {
      name: "partial",
      items: [item("flight", "Published fare", 80), item("flight", "Return fare unknown")],
      amount: 80,
      missing: true,
    },
  ];
  for (const width of [1440, 390]) {
    for (const language of ["en", "zh"]) {
      for (const scenario of cases) {
        const tag = `${scenario.name}-${width}-${language}`;
        const seed = structuredClone(catalog);
        for (const saved of [seed.conversations[0].snapshot, seed.trips[0].snapshot]) {
          saved.plan.sections = saved.plan.sections.filter((part) => part.id !== "transport");
          if (scenario.items)
            saved.plan.sections.push(
              section("transport", "Transport", "transport", scenario.items, scenario.amount),
            );
          saved.plan.sections.find((part) => part.id === "itinerary").proposal.items = [
            item("activity", "Priced activity", 40),
          ];
          saved.plan.estTotal = 280 + scenario.amount;
          saved.plan.budgetTotal = scenario.budget ?? 800;
          saved.plan.brief.budgetTotal = saved.plan.budgetTotal;
        }
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
        });
        const fixturePage = await context.newPage();
        page = fixturePage;
        const errors = [];
        fixturePage.on("pageerror", (error) => errors.push(String(error)));
        await fixturePage.addInitScript(
          ({ seed, settings }) => {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
            localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
          },
          {
            seed,
            settings: { ...settings, language, displayCurrency: scenario.currency ?? "AUD" },
          },
        );
        await fixturePage.goto(BASE, { waitUntil: "domcontentloaded" });
        await fixturePage.locator(".workspace-app").waitFor();
        const history = fixturePage.locator('.history-item__open[title="Sydney budget breakdown"]');
        if (width === 390)
          await fixturePage
            .getByRole("tab", { name: language === "en" ? "Mine" : "我的", exact: true })
            .click();
        else
          await fixturePage
            .getByRole("button", { name: language === "en" ? /^Chats/ : /^聊天/ })
            .click();
        await history.click();
        if (width === 390)
          await fixturePage
            .getByRole("tab", { name: language === "en" ? /^Trip/ : /^行程/ })
            .click();
        else if (!(await fixturePage.locator(".trip-panel__budget-summary").isVisible()))
          await fixturePage
            .getByRole("button", {
              name: language === "en" ? "Open your trip" : "打开你的行程",
              exact: true,
            })
            .click();
        const card = fixturePage.locator(".trip-panel__budget-summary");
        await card.waitFor();
        await card.locator("summary").click();
        const row = card.locator("li").filter({
          has: fixturePage.getByText(language === "en" ? "Transport" : "交通", { exact: true }),
        });
        const text = await row.innerText();
        const unknown = language === "en" ? "Not costed" : "未计价";
        check(
          scenario.unknown
            ? text.includes(unknown) && !text.includes("0.00")
            : new RegExp(`(?:AUD\\s*|A\\$)${scenario.amount}\\.00`).test(text),
          `${tag}: unknown and known fares remain distinct`,
          text,
        );
        const missing = Boolean(scenario.unknown || scenario.missing);
        check(
          /unpriced|未定价/.test(await card.locator("summary").innerText()) === missing,
          `${tag}: missing transport is counted on the budget line`,
        );
        const status = await card.locator(".budget-status").first().innerText();
        check(
          scenario.budget === 200
            ? /Over budget|超出预算/.test(status)
            : missing
              ? /unpriced costs not counted|未定价费用未计入/.test(status)
              : !/unpriced|未定价/.test(status),
          `${tag}: budget status qualifies missing costs`,
          status,
        );
        check(
          (await fixturePage.evaluate(() => document.documentElement.scrollWidth)) === width &&
            errors.length === 0,
          `${tag}: no page overflow or runtime errors`,
          errors,
        );
        await fixturePage.screenshot({ path: `${OUT}/transport-${tag}.png`, fullPage: true });
        await context.close();
      }
    }
  }
}
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
  await budget.locator("summary").click();
  const breakdown = budget.locator('[aria-label="Budget breakdown"]');
  check((await breakdown.count()) === 1, "budget card exposes a category breakdown");
  const rows = await breakdown
    .locator(":scope > li")
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
  const categoryRows = rows.map((row) => row.split("\n").slice(0, 2).join("\n"));
  const estimateValues = categoryRows.flatMap((row) =>
    [...row.matchAll(/(?:A\$|AUD\s*)([\d,]+\.\d{2})/g)].map((match) =>
      Number(match[1].replaceAll(",", "")),
    ),
  );
  check(
    estimateValues.reduce((sum, amount) => sum + amount, 0) === plan.estTotal,
    "category estimates reconcile to the displayed total",
    { categoryRows, estimateValues, total: plan.estTotal },
  );
  check(
    rows.every((row) => !/estimated|unpriced/i.test(row)),
    "category rows carry a name and a total only",
    rows,
  );
  check(
    /1 unpriced/.test(await budget.locator("summary").innerText()),
    "unpriced activity is counted on the budget line without an invented amount",
  );
  await page.screenshot({ path: `${OUT}/budget-breakdown.png`, fullPage: true });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Language & region" }).click();
  await page.getByRole("tab", { name: "Language & region" }).waitFor();
  await page.getByRole("button", { name: "Change" }).first().click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await page.getByRole("button", { name: "关闭设置" }).click();
  const navDrawer = page.locator(".workspace-drawer--nav");
  if (await navDrawer.isVisible()) await page.getByRole("button", { name: "关闭导航" }).click();
  await page.getByRole("button", { name: "打开你的行程" }).click();
  await page.locator(".trip-panel__budget-summary > summary").click();
  const zhBreakdown = page.locator('[aria-label="预算明细"]');
  await zhBreakdown.waitFor();
  const zhRows = await zhBreakdown.locator(":scope > li").allInnerTexts();
  check(
    ["住宿", "交通", "餐饮", "活动"].every((label) => zhRows.some((row) => row.includes(label))) &&
      (await page.locator(".trip-panel__budget-summary > summary").innerText()).includes(
        "1 项未定价",
      ),
    "Chinese breakdown labels and the unpriced count are translated",
    zhRows,
  );
  await page.screenshot({ path: `${OUT}/budget-breakdown-zh.png`, fullPage: true });
  await context.close();
  await transportCases();
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
