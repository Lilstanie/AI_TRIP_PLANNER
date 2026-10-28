import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/one-line-budget", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const plain = (text) => text.replace(/\s+/g, " ").trim();
const item = (kind, detail, estCost) => ({
  kind,
  detail,
  ...(estCost === undefined ? {} : { estCost }),
  day: 1,
  startTime: "09:00",
  endTime: "10:00",
  location: "Sydney",
});
const section = (id, label, items, estCost) => ({
  id,
  label,
  summary: `${label} fixture`,
  status: "draft",
  estCost: estCost ?? 0,
  proposal: { agent: id, summary: `${label} fixture`, items, assumptions: [], conflictsWith: [] },
});

const scenarios = [
  { name: "normal", costs: [180, 80, 60, 40], extraUnpriced: 1, budget: 800, unpriced: 1, pct: 45 },
  { name: "all-priced", costs: [180, 80, 60, 40], budget: 800, unpriced: 0, pct: 45 },
  { name: "every-unpriced", costs: [], budget: 800, unpriced: 4, pct: 0 },
  { name: "over-budget", costs: [180, 80, 60, 40], budget: 200, unpriced: 0, pct: 100 },
  {
    name: "no-transport",
    costs: [180, 80, 60, 40],
    noTransport: true,
    budget: 800,
    unpriced: 1,
    pct: 35,
  },
  { name: "yen", costs: [180, 80, 60, 40], budget: 800, unpriced: 0, pct: 45, currency: "JPY" },
];

function fixture(scenario) {
  const [stay, flight, meal, activity] = scenario.costs;
  const priced = scenario.costs.length > 0;
  const itinerary = [item("activity", "Priced activity", activity)];
  if (scenario.extraUnpriced) itinerary.push(item("activity", "Unpriced activity"));
  if (!priced)
    itinerary.splice(
      0,
      1,
      item("activity", "Unpriced activity"),
      item("activity", "Second unpriced"),
    );
  const total = scenario.costs.reduce(
    (sum, amount, index) => sum + (scenario.noTransport && index === 1 ? 0 : amount),
    0,
  );
  const plan = {
    tripId: "one-line-budget-757",
    brief: {
      tripId: "one-line-budget-757",
      userId: "e2e",
      destination: "Sydney",
      dates: ["2026-12-16", "2026-12-17"],
      groupSize: 2,
      budgetTotal: scenario.budget,
    },
    round: 1,
    budgetTotal: scenario.budget,
    estTotal: total,
    overrunPct: 0,
    sections: [
      section(
        "accommodation",
        "Accommodation",
        [item("stay", "Provider stay description", stay)],
        stay,
      ),
      section(
        "transport",
        "Transport",
        scenario.noTransport ? [] : [item("flight", "Provider flight description", flight)],
        scenario.noTransport ? 0 : flight,
      ),
      section("dining", "Dining", [item("meal", "Provider meal description", meal)], meal),
      section("itinerary", "Day plan", itinerary, activity),
      section("destination-guide", "Travel tips", [], 0),
    ],
    conflicts: [],
  };
  const savedAt = new Date(0).toISOString();
  const snapshot = {
    version: 4,
    id: plan.tripId,
    savedAt,
    plan,
    draft: {
      destination: "Sydney",
      origin: "",
      start: plan.brief.dates[0],
      end: plan.brief.dates[1],
      groupSize: "2",
      budgetTotal: String(scenario.budget),
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
  const conversationId = `conversation:${plan.tripId}`;
  const tripId = `trip:${plan.tripId}`;
  return {
    total,
    catalog: {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney one-line budget",
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
          title: "Sydney one-line budget",
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
    },
    settings: {
      version: 1,
      travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
      memberships: [],
      assistant: { style: "neutral", memory: true },
      dataMode: "mock",
      appearance: "system",
      language: "en",
      displayCurrency: scenario.currency ?? "AUD",
      updatedAt: savedAt,
    },
  };
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
try {
  for (const width of [1440, 390]) {
    for (const language of ["en", "zh"]) {
      const zh = language === "zh";
      for (const scenario of scenarios) {
        const tag = `${scenario.name}-${width}-${language}`;
        const { catalog, settings, total } = fixture(scenario);
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          reducedMotion: "reduce",
        });
        page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.addInitScript(
          ({ catalog, settings }) => {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
            localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
          },
          { catalog, settings: { ...settings, language } },
        );
        await page.goto(BASE, { waitUntil: "domcontentloaded" });
        await page.locator(".workspace-app").waitFor();
        const history = page.locator('.history-item__open[title="Sydney one-line budget"]');
        if (width === 390)
          await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
        else await page.getByRole("button", { name: zh ? /^聊天/ : /^Chats/ }).click();
        await history.click();
        if (width === 390) await page.getByRole("tab", { name: zh ? /^行程/ : /^Trip/ }).click();
        else if (!(await page.locator(".trip-panel__budget-summary").isVisible()))
          await page
            .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
            .click();
        const card = page.locator(".trip-panel__budget-summary");
        await card.waitFor();
        const summary = card.locator("summary");

        const collapsed = plain(await summary.innerText());
        check(!(await card.evaluate((node) => node.open)), `${tag}: the budget starts collapsed`);
        const box = await summary.boundingBox();
        const lineHeight = await summary.evaluate(
          (node) => parseFloat(getComputedStyle(node).lineHeight) || 18,
        );
        const textRows = await summary
          .locator(
            scenario.unpriced > 0 && width === 1440
              ? "strong, .trip-panel__budget-unknown"
              : "strong, .budget-status, .trip-panel__budget-unknown",
          )
          .evaluateAll(
            (nodes) =>
              new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().top / 8))).size,
          );
        check(
          width === 1440 ? textRows === 1 : textRows <= 2,
          `${tag}: total, limit${scenario.unpriced > 0 ? "" : ", status"} and unpriced count sit on ${width === 1440 ? "one line" : "at most two lines"}`,
          { textRows, height: box?.height, lineHeight },
        );
        check(
          (await card.locator(".trip__budget strong").count()) === 1 &&
            !/NaN|undefined/.test(collapsed),
          `${tag}: one known total and no broken values`,
          collapsed,
        );
        check(collapsed.includes("/"), `${tag}: the total is shown over the limit`, collapsed);
        const unpricedText = collapsed.match(zh ? /(\d+) 项未定价/ : /(\d+) unpriced/);
        check(
          scenario.unpriced > 0
            ? Number(unpricedText?.[1]) === scenario.unpriced
            : unpricedText === null,
          `${tag}: unpriced count is ${scenario.unpriced || "absent"}`,
          collapsed,
        );
        const bar = card.getByRole("progressbar");
        check(
          (await bar.count()) === 1 &&
            Number(await bar.getAttribute("aria-valuenow")) === scenario.pct,
          `${tag}: progress bar at ${scenario.pct}%`,
        );
        check(
          (await card.locator(".bar--over").count()) === (scenario.name === "over-budget" ? 1 : 0),
          `${tag}: the bar is marked over only when over budget`,
        );
        const status = plain(await card.locator(".budget-status").innerText());
        const expectedStatus =
          scenario.name === "over-budget"
            ? zh
              ? "超出预算"
              : "Over budget"
            : scenario.unpriced > 0
              ? zh
                ? "未定价费用未计入"
                : "unpriced costs not counted"
              : zh
                ? "预算内"
                : "Within budget";
        check(status.includes(expectedStatus), `${tag}: status wording`, status);
        if (scenario.currency === "JPY")
          check(
            /JPY|¥/.test(collapsed) && !/AUD/.test(collapsed),
            `${tag}: total and limit are in yen`,
            collapsed,
          );
        else
          check(
            collapsed.includes(scenario.budget === 200 ? "AUD 200" : "AUD 800"),
            `${tag}: limit shown in AUD`,
            collapsed,
          );
        if (width === 390)
          check(
            (box?.height ?? 0) >= 44,
            `${tag}: the summary is a 44 px touch target`,
            box?.height,
          );
        await page.screenshot({ path: `${OUT}/${tag}-collapsed.png`, fullPage: true });

        await summary.click();
        check(await card.evaluate((node) => node.open), `${tag}: tapping opens the category list`);
        const rows = (await card.locator(".trip-panel__budget-breakdown > li").allInnerTexts()).map(
          plain,
        );
        const labels = zh
          ? ["住宿", "交通", "餐饮", "活动"]
          : ["Accommodation", "Transport", "Meals", "Activities"];
        check(
          rows.length === 4 && labels.every((label, index) => rows[index].startsWith(label)),
          `${tag}: one row per category`,
          rows,
        );
        check(
          (await card
            .locator(".trip-panel__budget-breakdown li li, .trip-panel__budget-breakdown ul ul")
            .count()) === 0 &&
            (await card
              .locator(".trip-panel__budget-breakdown > li")
              .evaluateAll((nodes) =>
                nodes.every((node) => node.getBoundingClientRect().height < 30),
              )),
          `${tag}: each category is one line`,
        );
        const expandedText = plain(await card.innerText());
        check(
          !/Provider (stay|flight|meal)|Priced activity|Unpriced activity/.test(expandedText),
          `${tag}: no provider text in the budget`,
        );
        check(
          !/Not included|未计入|Estimated|估算|equals your budget|under the|over the|低于|超出.*预算[^内]/.test(
            expandedText.replace(status, ""),
          ),
          `${tag}: no duplicate notes or suffixes`,
          expandedText,
        );
        check(
          (await card.locator(".budget-status").count()) === 1 &&
            expandedText.split(status).length - 1 === 1,
          `${tag}: the status wording appears once`,
        );
        if (total > 0 && !scenario.currency) {
          const totalText = plain(await card.locator(".trip__budget strong").innerText());
          check(
            expandedText.split(totalText).length - 1 === 1,
            `${tag}: the known total appears once`,
            totalText,
          );
          const sum = rows
            .flatMap((row) =>
              [...row.matchAll(/AUD ([\d,]+\.\d{2})/g)].map((m) =>
                Number(m[1].replaceAll(",", "")),
              ),
            )
            .reduce((a, b) => a + b, 0);
          check(sum === total, `${tag}: categories add up to the total`, { sum, total });
        }
        if (scenario.name === "every-unpriced")
          check(
            rows
              .filter((row) => !row.startsWith(zh ? "餐饮" : "Meals"))
              .every((row) => row.includes(zh ? "未计价" : "Not costed")),
            `${tag}: categories with no known cost say so`,
            rows,
          );
        check(
          (await page.evaluate(() => document.documentElement.scrollWidth)) <= width &&
            errors.length === 0,
          `${tag}: no sideways scroll or page errors`,
          errors,
        );
        await page.screenshot({ path: `${OUT}/${tag}-expanded.png`, fullPage: true });
        await summary.click();
        check(!(await card.evaluate((node) => node.open)), `${tag}: tapping again closes the list`);
        await context.close();
      }
    }
  }
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
  check(false, "one-line budget journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(checks, null, 2));
}
process.exitCode = checks.some((entry) => !entry.ok) ? 1 : 0;
