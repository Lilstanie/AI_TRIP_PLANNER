import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/calendar-trip-date-label", process.env.RUN_ID ?? "latest");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, message, observed) => {
  results.push({ ok: Boolean(ok), message, observed });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const draft = {
  destination: "Sydney",
  origin: "",
  start: "2030-10-01",
  end: "2030-10-04",
  groupSize: "2",
  budgetTotal: "2000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
};
const plan = {
  tripId: "mine-trip",
  brief: {
    tripId: "mine-trip",
    userId: "local",
    destination: "Sydney",
    dates: [draft.start, draft.end],
    groupSize: 2,
    budgetTotal: 2000,
  },
  round: 1,
  budgetTotal: 2000,
  estTotal: 200,
  overrunPct: -90,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Sydney museum",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Sydney museum",
        items: [{ id: "mine-stop", kind: "activity", detail: "Sydney museum", estCost: 200 }],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};
const savedAt = "2026-10-05T00:00:00Z";
const snapshot = { version: 3, id: "mine-chat", savedAt, plan, draft, messages: [], input: "" };
const cases = [
  {
    destination: "Sydney",
    dates: ["2030-11-10", "2030-11-13"],
    en: ["Sunday 10 November 2030", "Wednesday 13 November 2030"],
    zh: ["2030年11月10日星期日", "2030年11月13日星期三"],
    days: 4,
  },
  {
    destination: "Kyoto",
    dates: ["2030-11-15", "2030-11-16"],
    en: ["Friday 15 November 2030", "Saturday 16 November 2030"],
    zh: ["2030年11月15日星期五", "2030年11月16日星期六"],
    days: 2,
  },
  {
    destination: "Auckland",
    dates: ["2030-12-31", "2031-01-02"],
    en: ["Tuesday 31 December 2030", "Thursday 2 January 2031"],
    zh: ["2030年12月31日星期二", "2031年1月2日星期四"],
    days: 3,
  },
];
const trips = cases.map(({ destination, dates }) => {
  const copy = structuredClone(snapshot);
  copy.id = `${destination}-chat`;
  copy.plan.tripId = destination;
  copy.plan.brief = { ...copy.plan.brief, tripId: destination, destination, dates };
  copy.draft = { ...copy.draft, destination, start: dates[0], end: dates[1] };
  return {
    id: `trip:${destination}`,
    title: destination,
    status: "draft",
    updatedAt: savedAt,
    conversationIds: [`conversation:${copy.id}`],
    snapshot: copy,
  };
});
const catalog = {
  version: 4,
  trips,
  conversations: trips.map((trip) => ({
    id: trip.conversationIds[0],
    title: trip.title,
    updatedAt: savedAt,
    tripId: trip.id,
    messages: [],
    input: "",
    snapshot: trip.snapshot,
  })),
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "mine",
    editorView: "map",
  },
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [label, dates] of [
    ["same-day", ["2030-11-15", "2030-11-15"]],
    ["invalid-date", ["2030-02-30", "2030-03-02"]],
  ]) {
    const invalid = structuredClone(catalog);
    invalid.trips[0].snapshot.plan.brief.dates = dates;
    const stored = JSON.stringify(invalid);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript((stored) => {
      localStorage.setItem("trip-workspace-catalog-v3", stored);
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity: "", preferences: [] },
          language: "en",
          dataMode: "mock",
          appearance: "system",
          updatedAt: "2026-10-05T00:00:00Z",
        }),
      );
    }, stored);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(BASE);
    await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Workspace history could not be read." })
      .waitFor();
    check(
      await page.evaluate(
        (stored) => localStorage.getItem("trip-workspace-catalog-v3") === stored,
        stored,
      ),
      `${label}: rejected catalog is preserved`,
    );
    check(errors.length === 0, `${label}: rejection causes no browser page error`, errors);
    writeFileSync(`${OUT}/${label}.aria.yml`, await page.locator("body").ariaSnapshot());
    await page.screenshot({ path: `${OUT}/${label}.png` });
    await context.close();
  }
  for (const width of [1440, 390, 375]) {
    for (const locale of ["en", "zh"]) {
      const label = `${width}-${locale}`;
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        isMobile: width < 520,
        hasTouch: width < 520,
        timezoneId: width === 390 ? "Australia/Sydney" : "Pacific/Honolulu",
        locale: "en-AU",
        reducedMotion: "reduce",
      });
      await context.addInitScript(
        ({ catalog, locale }) => {
          if (!localStorage.getItem("trip-workspace-catalog-v3")) {
            localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
            localStorage.setItem(
              "trip.settings.v1",
              JSON.stringify({
                version: 1,
                travel: { homeCity: "", preferences: [] },
                language: locale,
                dataMode: "mock",
                appearance: "system",
                updatedAt: "2026-10-05T00:00:00Z",
              }),
            );
            localStorage.setItem("trip.locationPrompt", "dismissed");
          }
        },
        { catalog, locale },
      );
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.clock.install({ time: new Date("2030-11-01T12:00:00Z") });
      await page.goto(BASE);
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
      if (width === 1440)
        await page
          .getByRole("button", { name: locale === "en" ? /^Trips/ : /^行程/ })
          .first()
          .click();
      else
        await page
          .getByRole("tab", { name: locale === "en" ? "Mine" : "我的", exact: true })
          .click();
      await page
        .getByRole("tab", { name: locale === "en" ? "Calendar" : "日历", exact: true })
        .click();
      const grid = page.getByRole("grid");
      await grid.waitFor();
      for (const item of cases) {
        if (item.destination === "Auckland")
          await page
            .getByRole("button", { name: locale === "en" ? "Next month" : "下个月", exact: true })
            .click();
        const prefix =
          locale === "en" ? `Trip to ${item.destination}: ` : `前往 ${item.destination} 的行程：`;
        const expected = prefix + item[locale].join(locale === "en" ? " to " : " 至 ");
        const bars = grid.locator(".trip-calendar__trip").filter({ hasText: item.destination });
        const firstBar = bars.first();
        await firstBar.waitFor();
        const startCell = grid.locator(
          `[data-calendar-time="${Date.parse(item.dates[0] + "T00:00:00Z")}"]`,
        );
        check(
          (await startCell.getAttribute("aria-label")) === item[locale][0],
          `${label} ${item.destination}: day cell keeps its full date`,
          await startCell.getAttribute("aria-label"),
        );
        const names = await grid
          .locator(".trip-calendar__trip")
          .evaluateAll(
            (nodes, destination) =>
              nodes
                .filter((node) => node.getAttribute("aria-label")?.includes(destination))
                .map((node) => node.getAttribute("aria-label")),
            item.destination,
          );
        check(
          names.length === item.days && names.every((name) => name === expected),
          `${label} ${item.destination}: every bar announces the complete localized date range`,
          { expected, names },
        );
        await startCell.focus();
        await page.keyboard.press("ArrowRight");
        check(
          await page
            .waitForFunction(
              (time) => document.activeElement?.getAttribute("data-calendar-time") === String(time),
              Date.parse(item.dates[0] + "T00:00:00Z") + 86400000,
              { timeout: 5000 },
            )
            .then(() => true),
          `${label} ${item.destination}: arrow moves date focus`,
        );
        await startCell.focus();
        await page.keyboard.press("Tab");
        check(
          await firstBar.evaluate(
            (node) =>
              node === document.activeElement &&
              node.matches(":focus-visible") &&
              getComputedStyle(node).outlineStyle !== "none",
          ),
          `${label} ${item.destination}: Tab reaches bar with visible focus`,
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
          `${label} ${item.destination}: no horizontal page overflow`,
        );
        writeFileSync(`${OUT}/${label}-${item.destination}.aria.yml`, await grid.ariaSnapshot());
        writeFileSync(
          `${OUT}/${label}-${item.destination}.html`,
          await grid.evaluate((node) => node.outerHTML),
        );
        await page.screenshot({ path: `${OUT}/${label}-${item.destination}.png` });
      }
      await grid
        .locator(".trip-calendar__trip")
        .filter({ hasText: "Auckland" })
        .first()
        .press(width === 375 ? "Space" : "Enter");
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("trip-workspace-catalog-v3"))?.activeTripId ===
          "trip:Auckland",
      );
      check(true, `${label}: keyboard activation opens the matching trip`);
      if (width === 390 && locale === "en") {
        await page.getByRole("tab", { name: "Mine", exact: true }).click();
        await page
          .getByRole("button", { name: "Switch language to 简体中文", exact: true })
          .click();
        await page.getByRole("tab", { name: "日历", exact: true }).click();
        check(
          (await page.locator(".trip-calendar__trip").first().getAttribute("aria-label"))?.includes(
            "星期",
          ),
          `${label}: changing UI language refreshes the accessible range`,
        );
      }
      check(errors.length === 0, `${label}: no browser page errors`, errors);
      await context.close();
    }
  }
} finally {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      writeFileSync(`${OUT}/interrupted.aria.yml`, await page.locator("body").ariaSnapshot());
      await page.screenshot({ path: `${OUT}/interrupted.png` });
    }
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        fixture: "local catalog, mock data, no live providers",
        browser: browser.version(),
        results,
      },
      null,
      2,
    ),
  );
}
const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
