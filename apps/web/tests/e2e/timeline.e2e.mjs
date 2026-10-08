// End-to-end walk through the Timeline & routes tab with mock data: day switching, the fixed
// transport and stay rows, selecting and editing a stop, confirming its place (a map match is saved
// on its stop by the workspace), checking the day's routes, applying an edit at once and undoing it,
// and provider transit fares keeping their own currency's decimal places (JPY 230, KRW 1,400, AUD 12.50). Screenshots at desktop and phone widths,
// light and dark, land under output/playwright/timeline/<label>/ as a repeatable artifact.
//
// Stop numbers and visiting order (#196): with a plan whose Day 2 start times disagree with plan
// order and whose Day 2 revisits Day 1's first place, the failures this checks are:
// - a view numbers each day from 1, or counts plan order instead of visiting order (#185, #186);
// - the revisited place gets a new number instead of keeping its first one;
// - the timeline, the Trip drawer list, the map (fallback list and popup) and the phone map sheet
//   disagree on a stop's number or on the order of a day's stops;
// - Move later on the first Day 2 stop does not swap it with the stop shown below it.
// The numbers each view showed are written to numbers-summary.json beside the screenshots.
//
//   pnpm --filter @trip/web dev            # in another terminal; a map key is optional (see the 503 note below)
//   [PLAYWRIGHT=<path to playwright>] [LABEL=after] [SHOTS_ONLY=1] node apps/web/tests/e2e/timeline.e2e.mjs
//
// SHOTS_ONLY=1 skips the interaction checks, for capturing a baseline of an older build.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
// Status codes of the place routes when Google Places is unavailable: 503 no key configured, 502 upstream failure.
const PLACES_DOWN = new Set([502, 503]);
const PLACES_DOWN_LOG = /status of 50[23]/;
const SHOTS_ONLY = process.env.SHOTS_ONLY === "1";
const OUT = resolve(process.cwd(), "output/playwright/timeline", LABEL);
mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

async function openTimeline(browser, { width, height, scheme, setup }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await setup?.(page);
  const errors = [];
  // Without a map key the place routes answer 503 (no key configured; they answered 502 before commit 2ca5570), and
  // the browser logs that as a console error with no URL. That one case is expected; any other failed
  // request is still an error.
  const upstream = new Set();
  page.on("response", (response) => {
    if (PLACES_DOWN.has(response.status())) upstream.add(new URL(response.url()).pathname);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Chrome probes the legacy favicon even though the application exposes icon.svg.
    if (message.location().url === `${BASE}/favicon.ico` && text.includes("404")) return;
    if (PLACES_DOWN_LOG.test(text) && [...upstream].every((path) => path === "/api/places/search"))
      return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  // The dev-mode indicator sits over the phone tab bar and would take the tab clicks.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // Mock data: no provider requests. The toggle only works once the page has hydrated, so retry
  // until it reports mock rather than clicking once and planning with live providers.
  await page.waitForLoadState("networkidle");
  // A cold dev server can settle the network before the data-mode toggle has rendered.
  await page
    .getByRole("button", { name: /^(Live|Mock) data/ })
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);
  // On phones the data mode toggle lives on the Mine tab.
  const mineTab = page.getByRole("tab", { name: /^Mine/ });
  if (await mineTab.count()) {
    await mineTab.click();
    await settle(page, 500);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    await live.click();
    await settle(page, 400);
  }
  check(
    (await page.getByRole("button", { name: /^Mock data/ }).count()) === 1,
    `${width}px ${scheme}: planning with mock data`,
  );
  const chatTab = page.getByRole("tab", { name: /^Chat/ });
  if (await chatTab.count()) {
    await chatTab.click();
    await settle(page, 500);
  }
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  // Phones show Your Trip on the Trip tab; wider screens open it as a drawer.
  const tripTab = page.getByRole("tab", { name: /^Trip/ });
  if (await tripTab.count()) await tripTab.click();
  else await page.getByRole("button", { name: "Open your trip" }).click();
  await settle(page, 700);
  await page.getByRole("tab", { name: /Timeline/ }).click();
  await settle(page, 700);
  return { context, page, errors, upstream };
}

async function shots(browser, width, height, tag) {
  for (const scheme of ["light", "dark"]) {
    const { context, page, errors } = await openTimeline(browser, { width, height, scheme });
    await page.screenshot({ path: `${OUT}/${tag}-${scheme}-01-timeline.png` });
    const drawer = page.locator(
      ".workspace-drawer--trip .drawer__body, .workspace-drawer--trip, #phone-panel-trip",
    );
    await drawer.first().screenshot({ path: `${OUT}/${tag}-${scheme}-02-drawer.png` });
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${tag} ${scheme}: no horizontal page scroll`,
    );
    check(
      !errors.length,
      `${tag} ${scheme}: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
    );
    await context.close();
  }
}

// An accepted edit applies at once. A refused one leaves the plan unchanged and shows its blockers
// as an alert in the timeline, which this helper reports as a failure.
async function applyEdit(page, label) {
  await settle(page, 800);
  const alert = page.locator(".timeline-status--error");
  if (await alert.count()) {
    const text = (await alert.first().innerText()).replace(/\s+/g, " ").slice(0, 300);
    await page.screenshot({ path: `${OUT}/blocked-${label}.png` });
    check(false, `${label}: edit refused — ${text}`);
    return false;
  }
  return true;
}

async function interactions(browser) {
  const { context, page, errors, upstream } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
  });
  const timeline = page.getByRole("region", { name: "Trip timeline" });

  // Days are tabs, not a dropdown of ISO dates.
  const days = timeline.getByRole("tab");
  check((await days.count()) >= 2, `day strip lists every day (${await days.count()})`);
  await days.nth(1).click();
  await settle(page);
  check((await days.nth(1).getAttribute("aria-selected")) === "true", "a day tab selects its day");
  await days.nth(0).click();
  await settle(page);

  // Fixed transport and stays read as rows with no raw "undefined" or empty separators.
  const text = await timeline.innerText();
  check(!/undefined|· ·/.test(text), "no raw undefined or empty separators");

  // A stop is compact until selected; selecting it opens its editor.
  const stop = timeline.locator(".timeline-stop").first();
  check((await stop.count()) === 1, "day shows its stops");
  check(
    !(await timeline.getByRole("button", { name: /Change time/ }).count()),
    "editors stay closed until a stop is selected",
  );
  await stop.locator(".timeline-stop__main").click();
  await settle(page);
  check(
    await timeline.getByRole("button", { name: /Change time/ }).isVisible(),
    "selecting a stop opens its editor",
  );
  await page.screenshot({ path: `${OUT}/interact-01-stop-open.png` });

  // A time edit applies at once and can be undone; there is no review step.
  const stopBefore = await timeline.locator(".timeline-stop").first().innerText();
  const start = timeline.getByLabel(/^Start/).first();
  const [hour, minute] = (await start.inputValue()).split(":").map(Number);
  await start.fill(
    `${String(Math.min(hour + 1, 20)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  );
  const end = timeline.getByLabel(/^End/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(
    `${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
  );
  await timeline.getByRole("button", { name: /Change time/ }).click();
  await settle(page);
  check(
    !(await page.getByRole("region", { name: "Edit preview" }).count()) &&
      !(await page.getByRole("button", { name: "Apply changes" }).count()),
    "a time edit has no review step or Apply button",
  );
  // The stop the edit changed flashes once, and only while motion is allowed.
  const flashed = timeline.locator(".timeline-stop.is-changed");
  check((await flashed.count()) >= 1, "an applied edit marks the changed stop");
  check(
    (await flashed
      .first()
      .locator(".timeline-stop__main")
      .evaluate((el) => getComputedStyle(el).animationName)) === "stop-changed",
    "the changed stop plays its highlight",
  );
  const undo = timeline.getByRole("button", { name: /Undo/ });
  check(await undo.isVisible(), "an applied edit can be undone");
  await page.screenshot({ path: `${OUT}/interact-03-applied.png` });
  await undo.click();
  await settle(page, 800);
  // Undo replays the earlier activities, so the stop reads as it did before the edit.
  check(
    (await timeline.locator(".timeline-stop").first().innerText()) === stopBefore,
    "undo restores the stop's earlier time",
  );

  // The whole route check: pick a day with two or more stops, confirm each stop's map match, then
  // check the day's routes and see checked journeys between the stops.
  // Confirming a stop's map match needs real place results. Without a map key the search answers 503, so
  // from here this reports a skip, never a pass; everything above still ran.
  if (upstream.has("/api/places/search")) {
    console.log(
      "skip  route check: the place search needs a map key (it answered 503 or 502), so stops cannot be matched",
    );
    check(
      !errors.length,
      `interactions: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
    );
    await context.close();
    return;
  }
  const dayTabs = await days.count();
  let routeDay = -1;
  for (let index = 0; index < dayTabs; index += 1) {
    if (/([2-9]|\d{2}) stops/.test(await days.nth(index).innerText())) {
      routeDay = index;
      break;
    }
  }
  const LANDMARKS = [
    "Sydney Opera House",
    "Royal Botanic Garden Sydney",
    "Art Gallery of New South Wales",
  ];
  let searches = 0;
  // Confirm every stop's place on a day: a map match is saved on its stop by the workspace, so the
  // stop is confirmed once that save lands; a stop with no map match is found with its search.
  async function confirmDay(index) {
    await days.nth(index).click();
    await settle(page);
    const stops = timeline.locator(".timeline-stop");
    for (let stop = 0; stop < (await stops.count()); stop += 1) {
      const row = stops.nth(stop);
      if (await row.locator(".timeline-tag--ok").count()) continue;
      if (!(await row.locator(".stop-editor").count()))
        await row.locator(".timeline-stop__main").click();
      const saved = row.locator(".timeline-tag--ok");
      await saved
        .first()
        .waitFor({ timeout: 8_000 })
        .catch(() => undefined);
      if (!(await saved.count())) {
        // No map match (mock names are not real places): find a real one with the stop's search.
        await row.getByRole("searchbox").fill(LANDMARKS[searches++ % LANDMARKS.length]);
        await row.getByRole("button", { name: "Search", exact: true }).click();
        const result = row.getByRole("button", { name: /^Use / }).first();
        await result.waitFor({ timeout: 20_000 });
        await result.click();
      }
      await applyEdit(page, `confirm day ${index + 1} stop ${stop + 1}`);
    }
  }
  if (routeDay < 0) {
    // Mock data plans one stop a day: move day 2's stop onto day 1 so there is a journey.
    await confirmDay(0);
    await confirmDay(1);
    await days.nth(1).click();
    await settle(page);
    if (!(await timeline.locator(".stop-editor").count()))
      await timeline.locator(".timeline-stop__main").first().click();
    await timeline.getByLabel("Move to").selectOption("1");
    await applyEdit(page, "move to day 1");
    check(/2 stops/.test(await days.nth(0).innerText()), "moving a stop to another day");
    routeDay = /2 stops/.test(await days.nth(0).innerText()) ? 0 : -1;
  }
  check(routeDay >= 0, "a day has at least two stops to route between");
  if (routeDay >= 0) {
    await confirmDay(routeDay);
    const stops = timeline.locator(".timeline-stop");
    const confirmed = await timeline.locator(".timeline-stop .timeline-tag--ok").count();
    check(
      confirmed === (await stops.count()),
      `every stop on the day is confirmed (${confirmed}/${await stops.count()})`,
    );
    const checkRoutes = timeline.getByRole("button", { name: /Check routes for Day/ });
    check(await checkRoutes.isEnabled(), "route check is enabled once places are confirmed");
    await checkRoutes.click();
    await settle(page, 800);
    await page.screenshot({ path: `${OUT}/interact-04-route-check.png` });
    check(
      (await timeline.locator(".timeline-connection--checked").count()) > 0,
      "the route check applies its journeys between the stops",
    );
    check(
      (await timeline
        .locator(".timeline-connection--checked .timeline-connection__rail")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName)) === "rail-draw",
      "a checked journey draws itself down the line",
    );
    await page.screenshot({ path: `${OUT}/interact-05-routes-checked.png` });
  }

  check(
    !errors.length,
    `interactions: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await context.close();
}

// Provider transit fares stay in their own currency with that currency's decimal places: yen has
// and won have no minor unit. The route provider is a system boundary, so the preview response is
// given three checked transit legs (JPY, AUD, KRW) between four stops moved onto the first day.
async function fareDecimals(browser) {
  const { context, page, errors, upstream } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
  });
  await page.route("**/api/trip/preview-edit", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const items = body.plan.sections.find((s) => s.id === "itinerary").proposal.items;
    const stops = items.filter((i) => i.kind === "activity" && i.day !== undefined).slice(0, 4);
    stops.forEach((stop, index) => {
      stop.day = stops[0].day;
      stop.placeId = `e2e-fare-${index}`;
      stop.startTime = `${String(9 + index * 2).padStart(2, "0")}:00`;
      stop.endTime = `${String(10 + index * 2).padStart(2, "0")}:00`;
    });
    const leg = (from, to, fare) => ({
      from: `e2e-fare-${from}`,
      to: `e2e-fare-${to}`,
      mode: "TRANSIT",
      status: "ok",
      durationMin: 25,
      fare,
    });
    body.routes = [
      leg(0, 1, { amount: 230, currency: "JPY" }),
      leg(1, 2, { amount: 12.5, currency: "AUD" }),
      leg(2, 3, { amount: 1400, currency: "KRW" }),
    ];
    body.blockers = [];
    body.blockerNotices = [];
    await route.fulfill({ response, json: body });
  });
  const timeline = page.getByRole("region", { name: "Trip timeline" });
  await timeline.locator(".timeline-stop .timeline-stop__main").first().click();
  await settle(page);
  // Any edit will do: move the end time so the change button is enabled.
  const end = timeline.getByLabel(/^End/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(
    `${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
  );
  await timeline.getByRole("button", { name: /Change time/ }).click();
  await settle(page, 800);
  // The fares arrive with the applied edit and show on the checked legs, as the checks below read.
  const jpy = (text) => text.match(/JPY [\d.]+/)?.[0];
  const legs = await timeline.locator(".timeline-connection--checked").allInnerTexts();
  const text = legs.join(" | ");
  check(legs.length === 3, `timeline: all three checked legs shown (${legs.length})`);
  check(/JPY 230(?![.\d])/.test(text), `timeline: JPY fare has no decimals (${jpy(text)})`);
  check(/AUD 12\.50(?!\d)/.test(text), "timeline: AUD fare keeps two decimals");
  check(/KRW 1,400(?![.\d])/.test(text), "timeline: KRW fare has no decimals");
  await timeline.locator(".timeline-connection--checked").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/fare-02-timeline.png` });
  // The stand-in place ids have no place details, so those lookups answer 503 (or 502) like the search.
  const unexpected = errors.filter(
    (text) =>
      !(
        PLACES_DOWN_LOG.test(text) && [...upstream].every((path) => path.startsWith("/api/places/"))
      ),
  );
  check(
    !unexpected.length,
    `fare decimals: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
  );
  await context.close();
}

// ---- Stop numbers and visiting order (#196) ----
// Day 1: Alpha 12:00, Bravo 15:00 (after the mock arrival). Day 2 in plan order: Charlie 15:00, Alpha 09:00 (a revisit),
// Delta 11:00. Visiting order puts Day 2 as Alpha, Delta, Charlie; trip-wide numbers are one per
// place in visiting order, and the revisit keeps Alpha's 1.
const NUMBERED = [
  { id: "e2e-alpha-1", place: "Alpha Museum", day: 1, start: "12:00", end: "13:00" },
  { id: "e2e-bravo", place: "Bravo Gardens", day: 1, start: "15:00", end: "16:00" },
  { id: "e2e-charlie", place: "Charlie Gallery", day: 2, start: "15:00", end: "16:00" },
  { id: "e2e-alpha-2", place: "Alpha Museum", day: 2, start: "09:00", end: "10:00" },
  { id: "e2e-delta", place: "Delta Market", day: 2, start: "11:00", end: "12:00" },
];
const NUMBER = { "Alpha Museum": 1, "Bravo Gardens": 2, "Delta Market": 3, "Charlie Gallery": 4 };
const DAY_2 = ["Alpha Museum", "Delta Market", "Charlie Gallery"];
const placeIdOf = (name) => `e2e-place-${name.split(" ")[0].toLowerCase()}`;
const shown = (rows) => rows.map(({ number, name }) => `${number} ${name}`).join(", ");
const expectedDay2 = shown(DAY_2.map((name) => ({ number: NUMBER[name], name })));

/** Real planning, then this file's itinerary; place lookups answer from fixed fixtures. */
async function numberedPlan(page) {
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    const index = Object.keys(NUMBER).findIndex((name) => placeIdOf(name) === placeId);
    const name = Object.keys(NUMBER)[index] ?? placeId;
    await route.fulfill({
      json: {
        place: {
          id: placeId,
          displayName: { text: name },
          formattedAddress: `${name}, Sydney`,
          location: { latitude: -33.86 + index * 0.004, longitude: 151.2 + index * 0.004 },
        },
      },
    });
  });
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        const items = section.proposal.items;
        const template = items.find((item) => item.kind === "activity");
        const activities = NUMBERED.map(({ id, place, day, start, end }) => {
          const item = { ...structuredClone(template), id, day, startTime: start, endTime: end };
          for (const key of ["arriveBy", "note", "booked", "conflictsWith"]) delete item[key];
          return { ...item, detail: place, location: place, placeId: placeIdOf(place) };
        });
        section.proposal.items = [
          ...items.filter((item) => item.kind !== "activity"),
          ...activities,
        ];
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

/** Number and name of each row, with screen-reader-only text removed. */
const readRows = (rows, numberSelector, nameSelector) =>
  rows.evaluateAll(
    (nodes, [numberSel, nameSel]) =>
      nodes.map((node) => {
        const name = node.querySelector(nameSel)?.cloneNode(true);
        name?.querySelectorAll(".sr-only, small").forEach((hidden) => hidden.remove());
        return {
          number: node.querySelector(numberSel)?.textContent.trim() ?? "",
          name: name?.textContent.trim() ?? "",
        };
      }),
    [numberSelector, nameSelector],
  );

async function stopNumbers(browser) {
  const summary = {};
  // Desktop: the timeline, the Trip drawer list and the map agree on Day 2.
  {
    const { context, page, errors } = await openTimeline(browser, {
      width: 1440,
      height: 1000,
      scheme: "light",
      setup: numberedPlan,
    });
    const timeline = page.getByRole("region", { name: "Trip timeline" });
    const days = timeline.getByRole("tab");
    const timelineDay = async (index) => {
      await days.nth(index).click();
      await settle(page);
      return readRows(
        timeline.locator(".timeline-stop"),
        ".timeline-stop__node",
        ".timeline-stop__name",
      );
    };
    // Place lookups finish after the first render; wait until every stop has its number.
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll(".timeline-stop__node")].every((node) =>
            node.textContent.trim(),
          ),
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    const day1 = await timelineDay(0);
    summary.desktopTimelineDay1 = shown(day1);
    check(
      shown(day1) === "1 Alpha Museum, 2 Bravo Gardens",
      `numbers: timeline Day 1 reads ${shown(day1)}`,
    );
    const day2 = await timelineDay(1);
    summary.desktopTimelineDay2 = shown(day2);
    check(
      shown(day2) === expectedDay2,
      `numbers: timeline Day 2 is in visiting order with trip-wide numbers and the revisit keeps 1 (${shown(day2)})`,
    );
    await page.screenshot({ path: `${OUT}/numbers-01-timeline-day2.png` });

    // The Trip drawer's Itinerary list.
    const drawer = page.locator(".workspace-drawer--trip");
    await drawer.getByRole("tab", { name: "Itinerary" }).click();
    await settle(page, 500);
    const listDay = (day) =>
      readRows(
        drawer
          .getByRole("list", { name: new RegExp(`^Stops, Day ${day}\\b`) })
          .locator(".trip-places__item"),
        ".trip-places__order",
        ".trip-places__name",
      );
    const list2 = await listDay(2);
    summary.desktopTripListDay2 = shown(list2);
    check(
      shown(list2) === expectedDay2,
      `numbers: Trip drawer Day 2 matches the timeline (${shown(list2)})`,
    );
    summary.desktopTripListDay1 = shown(await listDay(1));
    check(
      summary.desktopTripListDay1 === "1 Alpha Museum, 2 Bravo Gardens",
      `numbers: Trip drawer Day 1 matches the timeline (${summary.desktopTripListDay1})`,
    );
    await drawer.screenshot({ path: `${OUT}/numbers-02-trip-list.png` });

    // The map: without a map key its fallback lists the markers in order, and each place's popup
    // names its stop number. With a key the markers are drawn on a canvas this script cannot read.
    // The Trip drawer is modal at this width, so it closes while the map is read.
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    await settle(page, 400);
    const fallback = page.locator(".trip-map-fallback ol button");
    if (await fallback.count()) {
      const names = (await fallback.allInnerTexts()).map((text) => text.trim());
      const orders = {
        4: ["Alpha Museum", "Bravo Gardens", "Delta Market", "Charlie Gallery"],
        3: DAY_2,
        2: ["Alpha Museum", "Bravo Gardens"],
      };
      check(
        names.join(",") === (orders[names.length] ?? []).join(","),
        `numbers: map markers are in visiting order (${names.join(", ")})`,
      );
      const metas = [];
      for (let index = 0; index < names.length; index += 1) {
        await fallback.nth(index).click();
        const popup = page.locator(".trip-map-popup");
        await popup.waitFor({ timeout: 5_000 });
        metas.push(`${await popup.locator(".place-preview__meta").innerText()} ${names[index]}`);
        await page.keyboard.press("Escape");
        await settle(page, 200);
      }
      summary.desktopMapPopups = metas;
      check(
        metas.every((meta, index) => meta.startsWith(`Stop ${NUMBER[names[index]]} `)),
        `numbers: each map marker carries its trip-wide stop number (${metas.join(" | ")})`,
      );
    } else console.log("skip  map marker numbers: the map drew real markers (a map key is set)");

    // Move later on the first Day 2 stop (Alpha) moves it past the stop shown below it (Delta).
    // From the timeline, the preview endpoint re-times the day from real routes, which the fixture
    // places do not have, so this checks the position the timeline asks for: just after Delta in
    // plan order (Charlie, Delta), not after the second stop of the plan's day.
    let moveRequest;
    await page.route("**/api/trip/preview-edit", async (route) => {
      moveRequest = route.request().postDataJSON().operation;
      await route.continue();
    });
    await page.getByRole("button", { name: "Open your trip" }).click();
    await settle(page, 700);
    await drawer.getByRole("tab", { name: /Timeline/ }).click();
    await settle(page, 500);
    await days.nth(1).click();
    await settle(page);
    await timeline.locator(".timeline-stop").first().locator(".timeline-stop__main").click();
    await settle(page);
    await timeline.getByRole("button", { name: "Move later", exact: true }).click();
    await settle(page, 800);
    summary.desktopTimelineMoveLater = moveRequest;
    check(
      moveRequest?.id === "e2e-alpha-2" && moveRequest.day === 2 && moveRequest.index === 2,
      `numbers: timeline Move later asks for the place after Delta (${JSON.stringify(moveRequest)})`,
    );
    await settle(page, 400);

    // From the Trip list the swap is applied in the browser: every view then shows Delta first,
    // and each place keeps its number.
    await drawer.getByRole("tab", { name: "Itinerary" }).click();
    await settle(page, 500);
    const day2List = drawer
      .getByRole("list", { name: /^Stops, Day 2\b/ })
      .locator(".trip-places__item");
    await day2List
      .first()
      .getByRole("button", { name: /^Actions for / })
      .click();
    await drawer.getByRole("menuitem", { name: "Move later", exact: true }).click();
    await settle(page, 600);
    const swapped = "3 Delta Market, 1 Alpha Museum, 4 Charlie Gallery";
    summary.desktopTripListDay2AfterMoveLater = shown(await listDay(2));
    check(
      summary.desktopTripListDay2AfterMoveLater === swapped,
      `numbers: Trip list Move later swaps Alpha with Delta below it (${summary.desktopTripListDay2AfterMoveLater})`,
    );
    await drawer.getByRole("tab", { name: /Timeline/ }).click();
    await settle(page, 500);
    const afterMove = await timelineDay(1);
    summary.desktopTimelineDay2AfterMoveLater = shown(afterMove);
    check(
      shown(afterMove) === swapped,
      `numbers: the timeline follows the swap (${shown(afterMove)})`,
    );
    await page.screenshot({ path: `${OUT}/numbers-03-move-later.png` });
    const unexpected = errors.filter((text) => !PLACES_DOWN_LOG.test(text));
    check(
      !unexpected.length,
      `numbers desktop: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
    );
    await context.close();
  }

  // Phone: the timeline and the Map tab's stops sheet agree on Day 2.
  {
    const { context, page, errors } = await openTimeline(browser, {
      width: 390,
      height: 844,
      scheme: "light",
      setup: numberedPlan,
    });
    const timeline = page.getByRole("region", { name: "Trip timeline" });
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll(".timeline-stop__node")].every((node) =>
            node.textContent.trim(),
          ),
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    await timeline.getByRole("tab").nth(1).click();
    await settle(page);
    const day2 = await readRows(
      timeline.locator(".timeline-stop"),
      ".timeline-stop__node",
      ".timeline-stop__name",
    );
    summary.phoneTimelineDay2 = shown(day2);
    check(shown(day2) === expectedDay2, `numbers phone: timeline Day 2 (${shown(day2)})`);
    await page.getByRole("tab", { name: /^Map/ }).click();
    await settle(page, 700);
    const sheet = page.locator(".phone-map-sheet");
    await sheet.getByRole("button", { name: "Resize day stops" }).press("End");
    await sheet.locator(".phone-map-sheet__days button").nth(1).click();
    await settle(page);
    const stops = await readRows(
      sheet.locator(".phone-map-sheet__stops button"),
      ".phone-map-sheet__number",
      ".phone-map-sheet__number + span",
    );
    summary.phoneMapSheetDay2 = shown(stops);
    check(
      shown(stops) === expectedDay2,
      `numbers phone: map sheet Day 2 matches the timeline (${shown(stops)})`,
    );
    await page.screenshot({ path: `${OUT}/numbers-04-phone-map-day2.png` });
    const unexpected = errors.filter((text) => !PLACES_DOWN_LOG.test(text));
    check(
      !unexpected.length,
      `numbers phone: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
    );
    await context.close();
  }
  writeFileSync(`${OUT}/numbers-summary.json`, JSON.stringify(summary, null, 2));
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await shots(browser, 1440, 1000, "desktop");
  await shots(browser, 390, 844, "phone");
  if (!SHOTS_ONLY) {
    await stopNumbers(browser);
    await fareDecimals(browser);
    await interactions(browser);
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
