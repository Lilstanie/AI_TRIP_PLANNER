import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUN = process.env.LABEL ?? new Date().toISOString().replace(/[:.]/g, "-");
const OUT = resolve(process.cwd(), "output/e2e/leg-distances", RUN);
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const settle = (page, ms = 400) => page.waitForTimeout(ms);
async function until(test, ms = 10_000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await new Promise((done) => setTimeout(done, 200));
  }
  return test();
}

const COORDS = {
  "e2e:opera": { latitude: -33.8568, longitude: 151.2153 },
  "e2e:bridge": { latitude: -33.8519, longitude: 151.2108 },
  "e2e:garden": { latitude: -33.8642, longitude: 151.2166 },
};
const DISTANCES = {
  "e2e:opera>e2e:bridge": 850,
  "e2e:bridge>e2e:garden": 2400,
  "e2e:garden>e2e:garden": 0,
};
const STORAGE_KEY = "trip.show-distances.v1";
const BOOK_URL = "https://stays.example.com/harbour-hotel";

const stop = (id, day, name, start, end, extra = {}) => ({
  id,
  kind: "activity",
  day,
  detail: name,
  location: name,
  startTime: start,
  endTime: end,
  estCost: 0,
  ...extra,
});
const candidate = (id, name, detailsUrl) => ({
  id,
  name,
  area: "Sydney",
  pricePerNight: 200,
  rating: 8.6,
  ...(detailsUrl ? { detailsUrl } : {}),
});
const stay = (id, day, name, detailsUrl) => ({
  id,
  city: "Sydney",
  checkIn: `2026-11-0${day + 1}`,
  checkOut: `2026-11-0${day + 2}`,
  day,
  nights: 1,
  rooms: 1,
  selectedId: `${id}-c`,
  candidates: [candidate(`${id}-c`, name, detailsUrl)],
});

function seed() {
  const tripId = "leg-distances-trip";
  const plan = {
    tripId,
    brief: {
      tripId,
      userId: "local",
      destination: "Sydney",
      origin: "Honolulu",
      dates: ["2026-11-02", "2026-11-04"],
      groupSize: 1,
      budgetTotal: 4000,
    },
    round: 1,
    budgetTotal: 4000,
    estTotal: 400,
    overrunPct: 0,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        status: "draft",
        summary: "Sydney stops",
        estCost: 0,
        proposal: {
          agent: "itinerary",
          summary: "Sydney stops",
          items: [
            stop("s1", 1, "Opera House", "09:00", "10:00", { placeId: "e2e:opera" }),
            stop("s2", 1, "Harbour Bridge", "10:30", "11:30", { placeId: "e2e:bridge" }),
            stop("s3", 1, "Botanic Garden", "12:00", "13:00", { placeId: "e2e:garden" }),
            stop("s4", 1, "Botanic Garden", "14:00", "15:00", { placeId: "e2e:garden" }),
            stop("s5", 2, "Bondi Beach", "09:00", "10:00"),
            stop("s6", 2, "Manly Wharf", "11:00", "12:00", {
              arriveBy: { mode: "walk", durationMin: 12, from: "Bondi Beach" },
            }),
          ],
          assumptions: [],
          conflictsWith: [],
        },
      },
      {
        id: "accommodation",
        label: "Stay",
        status: "draft",
        summary: "Stays",
        estCost: 400,
        proposal: {
          agent: "accommodation",
          summary: "Stays",
          items: [],
          stays: [stay("stay-a", 1, "Harbour Hotel", BOOK_URL), stay("stay-b", 2, "Quiet Hostel")],
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
      destination: "Sydney",
      origin: "Honolulu",
      start: "2026-11-02",
      end: "2026-11-04",
      groupSize: "1",
      budgetTotal: "4000",
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
      trip: { open: true, width: 420 },
      view: "chat",
      editorView: "map",
    },
  };
  return { snapshot, catalog };
}

const COPY = {
  en: {
    mine: /^Mine/,
    trip: /^Trip/,
    day: (n) => new RegExp(`^Day ${n}\\b`),
    list: (n) => new RegExp(`^Day ${n} timeline$`),
    directions: /Directions/,
    book: /^Book/,
    near: "850 m",
    far: "2.4 km",
  },
  zh: {
    mine: /^我的/,
    trip: /^行程/,
    day: (n) => new RegExp(`^第 ?${n} ?天`),
    list: (n) => new RegExp(`第 ?${n} ?天`),
    directions: /路线/,
    book: /^预订/,
    near: "850 米",
    far: "2.4 公里",
  },
};

async function openTrip(browser, { name, width, height, language }) {
  const phone = width < 700;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
    deviceScaleFactor: 2,
    locale: language === "zh" ? "zh-CN" : "en-AU",
  });
  const { snapshot, catalog } = seed();
  await context.addInitScript(
    ({ snapshot, catalog, language, key }) => {
      if (!sessionStorage.getItem("e2e-seeded")) {
        sessionStorage.setItem("e2e-seeded", "1");
        localStorage.setItem(key, "0");
        localStorage.setItem("trip-workspace-v1", JSON.stringify(snapshot));
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            travel: { homeCity: "", preferences: [] },
            language,
            dataMode: "mock",
            appearance: "light",
            updatedAt: "2026-10-27T00:00:00Z",
          }),
        );
      }
      window.__preferenceCalls = 0;
      for (const method of ["getItem", "setItem", "removeItem"]) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (name, ...rest) {
          if (name === key) window.__preferenceCalls += 1;
          return original.call(this, name, ...rest);
        };
      }
    },
    { snapshot, catalog, language, key: STORAGE_KEY },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/status of 40[34]|favicon/.test(message.text()))
      errors.push(message.text());
  });
  await page.route("**/api/places/details", (route) => {
    const { placeId } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        place: {
          id: placeId,
          displayName: { text: placeId },
          formattedAddress: "Sydney NSW, Australia",
          location: COORDS[placeId] ?? { latitude: -33.87, longitude: 151.2 },
        },
      },
    });
  });
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await page.route("**/api/trip/preview-edit", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (Array.isArray(body.routes))
      body.routes = body.routes.map((leg) => {
        const meters = DISTANCES[`${leg.from}>${leg.to}`];
        return meters === undefined ? leg : { ...leg, distanceMeters: meters };
      });
    return route.fulfill({ response, json: body });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".workspace-app");
  const copy = COPY[language];
  if (phone) {
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.mine }).click();
    await page.locator(".phone-mine .trip-card").first().click();
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
  }
  const panel = page.locator(".trip-workspace, .workspace-drawer--trip, #phone-panel-trip").first();
  if (!phone) await openDesktopTrip(page, language);
  await panel.waitFor({ timeout: 30_000 });
  return { context, page, errors, panel, copy, name };
}

async function openDesktopTrip(page, language) {
  const open = page.getByRole("button", {
    name: language === "zh" ? "打开你的行程" : "Open your trip",
  });
  const panel = page.locator(".trip-workspace, .workspace-drawer--trip").first();
  if (!(await open.count())) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name: language === "zh" ? /^行程/ : /^Trips/ })
      .first()
      .click();
    await openTripWorkspace(page, page.locator(".trips-page .trip-card").first());
  }
  await open.waitFor({ timeout: 30_000 });
  if ((await open.getAttribute("aria-expanded")) !== "true") await open.click();
  await panel.waitFor({ timeout: 30_000 });
}

async function showDay(session, day) {
  const { panel, copy, page } = session;
  const tab = panel.getByRole("tab", { name: copy.day(day) });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await settle(page, 300);
}

const legs = (session) => session.panel.locator(".timeline-connection");
const distances = (session) => session.panel.locator(".timeline-connection__distance");
const links = (session) =>
  session.panel
    .locator(".timeline-connection")
    .getByRole("link", { name: session.copy.directions });

async function walkthrough(browser, scenario) {
  const session = await openTrip(browser, scenario);
  const { page, panel, copy, name, errors } = session;
  const tag = (text) => `${name}: ${text}`;

  await showDay(session, 1);
  await until(async () => (await distances(session).count()) >= 2);
  const first = distances(session);
  check(
    (await first.count()) === 2,
    tag("two routed legs show a distance, the same-place leg does not"),
    await first.allInnerTexts(),
  );
  check((await first.nth(0).innerText()).includes(copy.near), tag(`short leg reads ${copy.near}`));
  check((await first.nth(1).innerText()).includes(copy.far), tag(`long leg reads ${copy.far}`));
  const hrefs = await links(session).evaluateAll((nodes) => nodes.map((node) => node.href));
  check(hrefs.length === 2, tag("the same-place leg has no Directions link"), hrefs);
  const params = hrefs.map((href) => new URL(href).searchParams);
  check(
    params[0]?.get("origin") === "-33.8568,151.2153" &&
      params[0]?.get("destination") === "-33.8519,151.2108",
    tag("first link goes from the Opera House to Harbour Bridge"),
    hrefs[0],
  );
  check(
    params[1]?.get("origin") === "-33.8519,151.2108" &&
      params[1]?.get("destination") === "-33.8642,151.2166",
    tag("second link goes from Harbour Bridge to the Botanic Garden"),
    hrefs[1],
  );
  check(
    (await links(session).first().getAttribute("target")) === "_blank",
    tag("Directions opens in a new tab"),
  );
  check(!hrefs.some((href) => /undefined|NaN/.test(href)), tag("no link carries undefined or NaN"));

  const stayBooks = panel.getByRole("link", { name: copy.book });
  check((await stayBooks.count()) === 1, tag("one Book button on day 1 (the stay with a link)"));
  check(
    (await stayBooks.first().getAttribute("href")) === BOOK_URL,
    tag("Book opens the known link"),
  );
  check(
    (await panel.locator(".timeline-stop").getByRole("link", { name: copy.book }).count()) === 0,
    tag("no stop shows Book"),
  );
  await page.screenshot({ path: `${OUT}/${name}-day1.png` });

  await showDay(session, 2);
  check(
    (await panel.getByRole("link", { name: copy.book }).count()) === 0,
    tag("the stay without a link shows no Book"),
  );
  const named = await links(session).evaluateAll((nodes) => nodes.map((node) => node.href));
  const byName = named[0] ? new URL(named[0]).searchParams : undefined;
  check(
    named.length === 1 &&
      byName.get("origin") === "Bondi Beach" &&
      byName.get("destination") === "Manly Wharf",
    tag("a leg between stops without coordinates links by name"),
    named,
  );
  check(
    (await distances(session).count()) === 0,
    tag("a leg with no route result shows no distance"),
  );
  await showDay(session, 1);

  check(
    (await panel.getByRole("switch").count()) === 0 &&
      (await panel.getByText(/Show distances|显示距离/).count()) === 0,
    tag("no Show distances switch renders"),
  );
  check(
    (await distances(session).count()) === 2 && (await links(session).count()) === 2,
    tag("distances and Directions links show although the old preference is stored as off"),
  );
  await page.screenshot({ path: `${OUT}/${name}-legs.png` });

  await page.reload({ waitUntil: "domcontentloaded" });
  if (width(scenario) < 700) {
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.mine }).click();
    await page.locator(".phone-mine .trip-card").first().click();
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.trip }).click();
  }
  if (width(scenario) >= 700) await openDesktopTrip(page, scenario.language);
  await panel.waitFor({ timeout: 30_000 });
  await showDay(session, 1);
  await until(async () => (await distances(session).count()) === 2);
  check((await distances(session).count()) === 2, tag("distances still show after a reload"));
  check(
    (await page.evaluate(() => window.__preferenceCalls)) === 0,
    tag("the old preference is never read or written"),
  );
  check(errors.length === 0, tag("no console or page errors"), errors);
  await session.context.close();
}

const width = (scenario) => scenario.width;

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  const viewports = [
    { width: 1440, height: 900, label: "desktop" },
    { width: 390, height: 844, label: "phone" },
  ];
  for (const language of ["en", "zh"])
    for (const viewport of viewports)
      await walkthrough(browser, {
        ...viewport,
        language,
        name: `${viewport.label}-${language}`,
      }).catch((error) =>
        check(false, `${viewport.label}-${language}: walkthrough completes`, String(error)),
      );
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
