// End-to-end walk through the one day view in the Trip drawer with mock data: day switching, the fixed
// transport and stay rows, selecting and editing a stop, confirming its place (a map match is saved on
// its stop by the workspace, see auto-save-places), reading each leg between stops as checked on its own
// (no button), changing one leg's mode, applying an edit at once and undoing it, an unroutable leg read
// as "No route found", and provider transit fares keeping their own currency's decimal places (JPY 230,
// KRW 1,400, AUD 12.50). Screenshots at desktop and phone widths,
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

/** A fixed place for a search text; the lookups answer from these, so no map key is needed. */
function placeFor(text) {
  const offset = text.length * 0.001;
  return {
    id: `e2e-place-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW, Australia`,
    location: { latitude: -33.8568 + offset, longitude: 151.2153 + offset },
    googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(text)}`,
  };
}

/** Place search and lookup at the browser boundary: every stop finds a place and saves it. */
async function installPlaces(page) {
  await page.route("**/api/places/search", (route) => {
    const { text } = route.request().postDataJSON();
    return route.fulfill({ json: { places: [placeFor(text)] } });
  });
  await page.route("**/api/places/details", (route) => {
    const { placeId } = route.request().postDataJSON();
    return route.fulfill({ json: { place: { ...placeFor(placeId), id: placeId } } });
  });
}

/** Polls until the test passes or the time runs out; resolves to whether it passed. */
async function until(page, test, ms = 10_000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await settle(page, 200);
  }
  return test();
}

async function interactions(browser) {
  const { context, page, errors } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
    setup: installPlaces,
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

  // A stop is compact until selected; selecting it opens its place card.
  const stop = timeline.locator(".timeline-stop").first();
  check((await stop.count()) === 1, "day shows its stops");
  check(
    !(await timeline.locator(".stop-place-card").count()),
    "the place card stays closed until a stop is selected",
  );
  await stop.locator(".timeline-stop__main").click();
  await settle(page);
  check(
    await timeline.locator(".stop-place-card").isVisible(),
    "selecting a stop opens its place card",
  );
  await page.screenshot({ path: `${OUT}/interact-01-stop-open.png` });

  // A time edit applies at once and can be undone; there is no review step.
  const stopBefore = await timeline.locator(".timeline-stop").first().innerText();
  // Tapping the time opens its Start and End form.
  await timeline.locator(".timeline-stop__time").first().click();
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
  await timeline.getByRole("button", { name: "Change time", exact: true }).click();
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

  // Routes between stops. A day's legs are checked once its places are saved and again when the day's
  // stops or times change; each leg's mode can be changed on its own, with no button. Places are stubbed
  // at the browser boundary, so this runs without a map key. In mock mode the server answers with
  // simulated legs, which read as estimates, never as checked.
  const ops = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/trip/preview-edit"))
      ops.push(request.postDataJSON().operation);
  });
  const legRows = timeline.locator(".timeline-connection");
  const modes = timeline.locator(".timeline-connection__mode");
  const labels = timeline.locator(".timeline-connection__label");
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
    const stops = timeline.locator(".timeline-day .timeline-stop");
    for (let stop = 0; stop < (await stops.count()); stop += 1) {
      const row = stops.nth(stop);
      if (await row.locator(".timeline-tag--ok").count()) continue;
      if (!(await row.locator(".stop-place-card").count()))
        await row.locator(".timeline-stop__main").click();
      const saved = row.locator(".timeline-tag--ok");
      await saved
        .first()
        .waitFor({ timeout: 8_000 })
        .catch(() => undefined);
      if (!(await saved.count())) {
        // No map match: find a place with the stop's search.
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
    // Moves are in the stop's menu; the day picker opens in its place card.
    await timeline
      .getByRole("button", { name: /^Actions for / })
      .first()
      .click();
    await timeline.getByRole("menuitem", { name: "Move to another day", exact: true }).click();
    await timeline.locator(".stop-place-card select").selectOption("1");
    await applyEdit(page, "move to day 1");
    check(/2 stops/.test(await days.nth(0).innerText()), "moving a stop to another day");
    routeDay = /2 stops/.test(await days.nth(0).innerText()) ? 0 : -1;
  }
  check(routeDay >= 0, "a day has at least two stops to route between");
  if (routeDay >= 0) {
    await confirmDay(routeDay);
    const stops = timeline.locator(".timeline-day .timeline-stop");
    const confirmed = await timeline
      .locator(".timeline-day .timeline-stop .timeline-tag--ok")
      .count();
    check(
      confirmed === (await stops.count()),
      `every stop on the day is confirmed (${confirmed}/${await stops.count()})`,
    );
    // The day's legs appear once its places are saved: one verify for the day, no button.
    await until(
      page,
      async () => (await modes.count()) > 0 && ops.some((op) => op.kind === "verify"),
    );
    const legCount = await modes.count();
    check(
      legCount === (await stops.count()) - 1,
      `each journey between two stops is a leg (${legCount} legs, ${await stops.count()} stops)`,
    );
    check(
      !(await timeline.getByRole("button", { name: /Check routes/ }).count()),
      "no Check routes button: the legs are checked on their own",
    );
    const legTexts = await labels.allInnerTexts();
    check(
      legTexts.every((text) => /(Walk|Public transport|Drive) · \d+\s*(min|h)/.test(text)),
      `each leg shows its mode and duration (${legTexts.join(" | ")})`,
    );
    check(
      (await timeline.locator(".timeline-connection--planned").count()) === legCount,
      "simulated legs read as estimates, not as checked",
    );
    await page.screenshot({ path: `${OUT}/interact-04-route-check.png` });

    // Changing one leg's mode sends one leg operation, and only that leg is routed.
    const first = modes.first();
    const before = await first.inputValue();
    const target = before === "drive" ? "transit" : "drive";
    const legsBefore = await labels.allInnerTexts();
    const [changed] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/trip/preview-edit") &&
          r.request().postDataJSON().operation.kind === "leg",
      ),
      first.selectOption(target),
    ]);
    await settle(page, 800);
    const routed = (await changed.json()).routes;
    check(
      routed.length === 1,
      `a leg change routes only that leg (${routed.length} leg(s) routed)`,
    );
    check((await first.inputValue()) === target, `the leg now travels by ${target}`);
    const legsAfter = await labels.allInnerTexts();
    check(
      legsBefore.slice(1).every((text, index) => text === legsAfter[index + 1]),
      "the other legs keep their modes and times",
    );
    await page.screenshot({ path: `${OUT}/interact-05-routes-checked.png` });

    // Undo puts the leg back.
    await timeline.getByRole("button", { name: /Undo/ }).click();
    await settle(page, 800);
    check((await first.inputValue()) === before, `undo restores the leg to ${before}`);

    // A chosen mode survives a later time edit of the day's first stop, which re-times the day.
    await first.selectOption(target);
    await settle(page, 800);
    await timeline.locator(".timeline-stop__time").first().click();
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
    const verifiesBefore = ops.filter((op) => op.kind === "verify").length;
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/trip/preview-edit") &&
          r.request().postDataJSON().operation.kind === "time",
      ),
      timeline.getByRole("button", { name: "Change time", exact: true }).click(),
    ]);
    // The edit changed the day, so its legs are routed again (one verify), then the mode is read.
    check(
      await until(
        page,
        async () => ops.filter((op) => op.kind === "verify").length > verifiesBefore,
        10_000,
      ),
      "a time edit that changes the day routes its legs again",
    );
    await settle(page, 800);
    check(
      (await modes.first().inputValue()) === target,
      `a chosen mode survives a later time edit (${target})`,
    );

    // An unroutable leg: the server answers no route for it, which reads as "No route found".
    await page.route("**/api/trip/preview-edit", async (route) => {
      const request = route.request().postDataJSON();
      if (request.operation.kind !== "leg") return route.continue();
      const response = await route.fetch();
      const body = await response.json();
      const items = body.plan.sections.find((s) => s.id === "itinerary").proposal.items;
      delete items.find((item) => item.id === request.operation.id).arriveBy;
      body.routes = body.routes.map((r) => ({
        from: r.from,
        to: r.to,
        mode: r.mode,
        status: "no_route",
      }));
      return route.fulfill({ response, json: body });
    });
    const unroutable = (await modes.first().inputValue()) === "walk" ? "drive" : "walk";
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/trip/preview-edit")),
      modes.first().selectOption(unroutable),
    ]);
    await settle(page, 800);
    check(
      (await timeline.getByText("No route found").count()) > 0,
      "an unroutable leg shows No route found",
    );
    check(
      (await timeline.locator(".timeline-connection--failed").count()) === 1,
      "only the unroutable leg is marked failed",
    );
    await page.screenshot({ path: `${OUT}/interact-06-no-route.png` });
    await page.unroute("**/api/trip/preview-edit");
  }

  await page.waitForLoadState("networkidle");

  check(
    !errors.length,
    `interactions: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await page.unrouteAll({ behavior: "ignoreErrors" });
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
  // Any edit will do: tap the time, then move the end so the change button is enabled.
  await timeline.locator(".timeline-stop__time").first().click();
  const end = timeline.getByLabel(/^End/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(
    `${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
  );
  // The server answers the time edit before the legs can show: wait for that answer, not a delay.
  const answered = page.waitForResponse((r) => r.url().includes("/api/trip/preview-edit"));
  await timeline.getByRole("button", { name: "Change time", exact: true }).click();
  await answered;
  await settle(page, 300);
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
  // A routing request the time edit started may still be in flight: let it finish before the context closes.
  await page.waitForLoadState("networkidle");
  await page.unrouteAll({ behavior: "ignoreErrors" });
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

// The chosen day's stops only: Ideas (unscheduled stops and dining's restaurant picks) are a second list.
const dayStops = (timeline) =>
  timeline.getByRole("list", { name: /^Day \d+ timeline$/ }).locator(".timeline-stop");

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
      return readRows(dayStops(timeline), ".timeline-stop__node", ".timeline-stop__name");
    };
    // Place lookups finish after the first render; wait until every stop has its number.
    await page
      .waitForFunction(
        () =>
          [
            ...document.querySelectorAll(
              ".timeline-stop:not(.timeline-stop--idea) .timeline-stop__node",
            ),
          ].every((node) => node.textContent.trim()),
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

    // The Trip drawer is this same view, so its day was read above; its screenshot is kept.
    const drawer = page.locator(".workspace-drawer--trip");
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
    await page.getByRole("button", { name: "Open your trip" }).click();
    await settle(page, 700);
    // Move later on the first Day 2 stop (Alpha) swaps it with the stop shown below it (Delta). The
    // browser swaps their start times, so the day then shows Delta first and each place keeps its number.
    await days.nth(1).click();
    await settle(page);
    await dayStops(timeline)
      .first()
      .getByRole("button", { name: /^Actions for / })
      .click();
    await drawer.getByRole("menuitem", { name: "Move later", exact: true }).click();
    await settle(page, 800);
    const swapped = "3 Delta Market, 1 Alpha Museum, 4 Charlie Gallery";
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
          [
            ...document.querySelectorAll(
              ".timeline-stop:not(.timeline-stop--idea) .timeline-stop__node",
            ),
          ].every((node) => node.textContent.trim()),
        undefined,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    await timeline.getByRole("tab").nth(1).click();
    await settle(page);
    const day2 = await readRows(dayStops(timeline), ".timeline-stop__node", ".timeline-stop__name");
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

/**
 * A trip with no flight, no stay and no destination guide: the day view shows none of those rows or
 * blocks, and the day still renders its stops and Ideas (#239).
 */
async function bareTripView(browser) {
  const { context, page, errors } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
    setup: async (page) => {
      await page.route("**/api/chat", async (route) => {
        const response = await route.fetch();
        const body = (await response.text())
          .split("\n")
          .map((line) => {
            if (!line.trim()) return line;
            const frame = JSON.parse(line);
            const plan = frame.response?.plan;
            if (!plan) return line;
            plan.sections = plan.sections
              .filter(
                (section) => section.id !== "destination-guide" && section.id !== "accommodation",
              )
              .map((section) =>
                section.id === "transport" && section.proposal
                  ? {
                      ...section,
                      proposal: {
                        ...section.proposal,
                        flights: undefined,
                        items: section.proposal.items.filter((item) => item.startTime),
                      },
                    }
                  : section,
              );
            return JSON.stringify(frame);
          })
          .join("\n");
        await route.fulfill({ response, body });
      });
    },
  });
  const drawer = page.locator(".workspace-drawer--trip, #phone-panel-trip");
  check(
    (await drawer.locator("details.trip-tips").count()) === 0,
    "bare trip: no travel tips block when the plan has no destination guide",
  );
  check(
    (await drawer.locator(".timeline-fixed--stay, .timeline-fixed--flight").count()) === 0,
    "bare trip: no stay or flight row when the plan has neither",
  );
  check(
    (await drawer.locator(".timeline-stop").count()) >= 1,
    "bare trip: the day still shows its stops",
  );
  const unexpected = errors.filter((text) => !PLACES_DOWN_LOG.test(text));
  check(
    !unexpected.length,
    `bare trip: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
  );
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  await shots(browser, 1440, 1000, "desktop");
  await shots(browser, 390, 844, "phone");
  if (!SHOTS_ONLY) {
    await stopNumbers(browser);
    await fareDecimals(browser);
    await interactions(browser);
    await bareTripView(browser);
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
