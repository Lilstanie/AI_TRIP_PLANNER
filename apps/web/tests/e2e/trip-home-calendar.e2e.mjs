import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const WEB = resolve(ROOT, "apps/web");
const rootRequire = createRequire(resolve(ROOT, "node_modules/.pnpm/node_modules/esbuild"));
const { build } = rootRequire("esbuild");
const OUT = resolve(ROOT, "output/playwright/trip-home-calendar", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const localeHarness = resolve(OUT, "locale-provider.tsx");
writeFileSync(
  localeHarness,
  `import { browserLocale, translate } from "@/lib/i18n/locale";
   export function useLocale() {
     const locale = browserLocale(navigator.languages);
     return { locale, t: (text, params) => translate(locale, text, params) };
   }`,
);

const dates = ["2030-11-29", "2030-12-02"];
const plan = {
  tripId: "trip:calendar-current",
  brief: {
    tripId: "calendar-current",
    userId: "local",
    destination: "Sydney",
    dates,
    groupSize: 2,
    budgetTotal: 4500,
  },
  round: 1,
  budgetTotal: 4500,
  estTotal: 1800,
  overrunPct: -60,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Sydney visit",
      estCost: 400,
      proposal: {
        agent: "itinerary",
        summary: "Sydney visit",
        assumptions: [],
        conflictsWith: [],
        items: [
          {
            id: "opera",
            kind: "activity",
            day: 1,
            location: "Sydney Opera House",
            detail: "Guided tour",
          },
          {
            id: "garden",
            kind: "activity",
            day: 1,
            location: "Royal Botanic Garden",
            detail: "Morning walk",
          },
          {
            id: "gallery",
            kind: "activity",
            day: 4,
            location: "Art Gallery of New South Wales",
            detail: "Free entry",
          },
          {
            id: "idea",
            kind: "activity",
            location: "Surry Hills bakery",
            detail: "Unscheduled Idea",
          },
        ],
      },
    },
    {
      id: "transport",
      label: "Transport",
      status: "draft",
      summary: "Return flights",
      estCost: 800,
      proposal: {
        agent: "transport",
        summary: "Return flights",
        assumptions: [],
        conflictsWith: [],
        items: [
          {
            id: "flight",
            kind: "flight",
            day: 1,
            location: "MEL → SYD",
            detail: "QF 402: returning 2030-12-02",
            selectionId: "flight-1",
          },
        ],
        flights: [
          {
            id: "flight-1",
            from: "MEL",
            to: "SYD",
            depart: dates[0],
            day: 1,
            passengers: 2,
            selectedId: "qf",
            candidates: [{ id: "qf", carrier: "Qantas", price: 800 }],
          },
        ],
      },
    },
    {
      id: "accommodation",
      label: "Accommodation",
      status: "draft",
      summary: "Three nights",
      estCost: 600,
      proposal: {
        agent: "accommodation",
        summary: "Three nights",
        assumptions: [],
        conflictsWith: [],
        items: [],
        stays: [
          {
            id: "stay-1",
            city: "Sydney",
            checkIn: dates[0],
            checkOut: dates[1],
            day: 1,
            nights: 3,
            rooms: 1,
            selectedId: "harbour",
            candidates: [
              {
                id: "harbour",
                name: "Harbour View Hotel",
                area: "Circular Quay",
                pricePerNight: 200,
                rating: 8,
              },
            ],
          },
        ],
      },
    },
  ],
};

const harness = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { TripHomeCalendar } from "./components/workspace/TripHomeCalendar";
  const root = createRoot(document.getElementById("root"));
  window.renderCalendar = () => {
    const selected = [];
    root.render(React.createElement(TripHomeCalendar, {
      plan: ${JSON.stringify(plan)},
      selectedDay: 4,
      onSelectDay: (day) => { selected.push(day); document.getElementById("root").dataset.selected = String(day); }
    }));
    window.selectedDays = selected;
  };
  window.setCalendarTheme = (theme) => { document.documentElement.dataset.theme = theme; };
  window.renderCalendar("en");
`;

const results = [];
function check(ok, name, observed) {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
}

let browser;
let server;
try {
  const bundle = await build({
    stdin: {
      contents: harness,
      resolveDir: WEB,
      sourcefile: "calendar-browser.tsx",
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    absWorkingDir: WEB,
    nodePaths: [resolve(ROOT, "node_modules/.pnpm/node_modules")],
    alias: { "@": WEB },
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "calendar-browser-dependencies",
        setup(build) {
          build.onResolve({ filter: /LocaleProvider$/ }, () => ({ path: localeHarness }));
          for (const id of [
            "react",
            "react/jsx-runtime",
            "react-dom",
            "react-dom/client",
            "scheduler",
          ])
            build.onResolve({ filter: new RegExp(`^${id.replace("/", "\\/")}$`) }, () => ({
              path: rootRequire.resolve(id),
            }));
        },
      },
    ],
  });
  const tokens = readFileSync(resolve(WEB, "app/styles/tokens.css"), "utf8");
  const base = readFileSync(resolve(WEB, "app/styles/base.css"), "utf8");
  const calendarCss = readFileSync(resolve(WEB, "app/styles/trip-home-calendar.css"), "utf8");
  const assets = {
    "/app.js": ["text/javascript", bundle.outputFiles[0].text],
    "/app.css": ["text/css", `${tokens}\n${base}\n${calendarCss}`],
  };
  server = createServer((request, response) => {
    if (request.url === "/" || request.url === "/index.html") {
      response.setHeader("content-type", "text/html");
      response.end(
        '<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><main id="root"></main><script src="/app.js"></script></body></html>',
      );
      return;
    }
    const asset = assets[request.url];
    if (!asset) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("content-type", asset[0]);
    response.end(asset[1]);
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 520, height: 1000 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.locator(".trip-home-calendar").waitFor();

  const buttons = page.locator(".trip-home-calendar__day");
  check(
    (await buttons.count()) === 4,
    "only the four current-Trip dates are interactive",
    await buttons.count(),
  );
  check(
    (await page.getByText("Surry Hills bakery", { exact: true }).count()) === 0,
    "unscheduled Ideas do not appear on the calendar",
  );
  check(
    (await page.locator(".trip-home-calendar__month").count()) === 2,
    "the cross-month Trip has November and December grids",
  );
  check(
    (await page
      .getByRole("button", { name: /29 November 2030/ })
      .getAttribute("data-activities")) === "stop,flight,stay",
    "arrival has Stop, flight and stay categories",
  );
  check(
    (await page
      .getByRole("button", { name: /30 November 2030/ })
      .getAttribute("data-activities")) === "stay",
    "an overnight stay covers the middle date",
  );
  check(
    (await page
      .getByRole("button", { name: /1 December 2030/ })
      .getAttribute("data-activities")) === "stay",
    "the final overnight is visible",
  );
  check(
    (await page
      .getByRole("button", { name: /2 December 2030/ })
      .getAttribute("data-activities")) === "stop,flight",
    "checkout has no stay and return has a flight",
  );
  const arrivalLabel = await page
    .getByRole("button", { name: /29 November 2030/ })
    .getAttribute("aria-label");
  check(
    arrivalLabel.includes("Sydney Opera House") &&
      arrivalLabel.includes("Royal Botanic Garden") &&
      arrivalLabel.includes("MEL") &&
      arrivalLabel.includes("Harbour View Hotel"),
    "the accessible arrival label includes all scheduled activity",
    arrivalLabel,
  );
  check(
    (await page.locator('[aria-pressed="true"]').count()) === 1,
    "selectedDay is exposed on one date",
  );
  check(
    (await page
      .locator(
        'input, [role="gridcell"] a, [aria-label*="Next month"], [aria-label*="Previous month"]',
      )
      .count()) === 0,
    "the calendar has no date editor or unrelated month navigation",
  );

  await page.getByRole("button", { name: /29 November 2030/ }).focus();
  await page.keyboard.press("Enter");
  check(
    (await page.evaluate(() => window.selectedDays.at(-1))) === 1 &&
      (await page.locator("#root").getAttribute("data-selected")) === "1",
    "Enter reports Trip day 1 through the public callback",
  );
  await page.getByRole("button", { name: /2 December 2030/ }).focus();
  await page.keyboard.press("Space");
  check(
    (await page.evaluate(() => window.selectedDays.at(-1))) === 4,
    "Space reports Trip day 4 through the public callback",
  );
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "520px calendar has no horizontal overflow",
  );
  await page.screenshot({ path: `${OUT}/calendar-520-en.png` });

  for (const width of [521, 1000, 1001]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
      `${width}px calendar has no horizontal overflow`,
    );
  }
  await page.setViewportSize({ width: 375, height: 900 });
  const phoneButtons = await buttons.evaluateAll((nodes) =>
    nodes.map((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    })),
  );
  check(
    phoneButtons.every((box) => box.width >= 44 && box.height >= 44),
    "375px date buttons retain at least 44px hit areas",
    phoneButtons,
  );
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "375px calendar has no horizontal overflow",
  );
  await page.screenshot({ path: `${OUT}/calendar-375-en.png` });

  const chinese = await browser.newContext({
    viewport: { width: 375, height: 900 },
    reducedMotion: "reduce",
    locale: "zh-CN",
  });
  const zhPage = await chinese.newPage();
  zhPage.on("pageerror", (error) => errors.push(String(error)));
  zhPage.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await zhPage.goto(`http://127.0.0.1:${address.port}`);
  await zhPage.locator(".trip-home-calendar").waitFor();
  check(
    (await zhPage.getByRole("button", { name: /2030年11月29日/ }).count()) === 1,
    "Chinese dates are localized",
  );
  check(
    (await zhPage.locator('[data-category="stay"] .flow-icon').count()) > 0 &&
      (await zhPage.locator('[data-category="flight"] .flow-icon').count()) > 0,
    "Chinese activity categories keep recognizable icons",
  );
  check(
    (await zhPage.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0,
    "375px Chinese calendar has no horizontal overflow",
  );
  await zhPage.screenshot({ path: `${OUT}/calendar-375-zh.png` });
  await zhPage.evaluate(() => window.setCalendarTheme("dark"));
  await zhPage.screenshot({ path: `${OUT}/calendar-375-zh-dark.png` });
  check(errors.length === 0, "the browser journey has no page or console errors", errors);
  await context.close();
  await chinese.close();
} catch (error) {
  check(false, "calendar journey completes", { error: String(error) });
} finally {
  await browser?.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify({ fixture: "real exported component; no live providers", results }, null, 2),
  );
}

process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
