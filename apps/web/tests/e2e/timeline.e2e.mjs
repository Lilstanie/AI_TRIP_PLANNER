import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";

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

  const upstream = new Set();
  page.on("response", (response) => {
    if (PLACES_DOWN.has(response.status())) upstream.add(new URL(response.url()).pathname);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();

    if (message.location().url === `${BASE}/favicon.ico` && text.includes("404")) return;
    if (PLACES_DOWN_LOG.test(text) && [...upstream].every((path) => path === "/api/places/search"))
      return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");

  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  await page.waitForLoadState("networkidle");

  await page
    .getByRole("button", { name: /^(Live|Mock) data/ })
    .or(page.getByRole("tab", { name: /^Mine/ }))
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => undefined);

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
    await noStatusLabels(page, `${tag} ${scheme}`);

    const stopTimes = await page.locator(".timeline-stop__time").evaluateAll((buttons) =>
      buttons.map((button) => {
        const doc = button.ownerDocument;
        const walker = doc.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        const boxes = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent.trim()) continue;
          const range = doc.createRange();
          range.selectNodeContents(node);
          boxes.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0));
        }
        const tops = new Set(boxes.map((rect) => Math.round(rect.top)));
        return { lines: tops.size, narrowest: Math.min(...boxes.map((rect) => rect.width)) };
      }),
    );
    check(
      stopTimes.length > 0 && stopTimes.every((time) => time.lines <= 2 && time.narrowest >= 18),
      `${tag} ${scheme}: each stop time sits on two lines and its digits do not stack (${JSON.stringify(stopTimes.slice(0, 3))})`,
    );
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

  const days = timeline.getByRole("tab");
  check((await days.count()) >= 2, `day strip lists every day (${await days.count()})`);
  await days.nth(1).click();
  await settle(page);
  check((await days.nth(1).getAttribute("aria-selected")) === "true", "a day tab selects its day");
  await days.nth(0).click();
  await settle(page);

  const text = await timeline.innerText();
  check(!/undefined|· ·/.test(text), "no raw undefined or empty separators");

  const stop = timeline.locator(".timeline-stop").first();
  check((await stop.count()) === 1, "day shows its stops");
  check(
    !(await timeline.locator(".stop-place-card").count()),
    "the place card stays closed until a stop is selected",
  );

  const mainButton = stop.locator(".timeline-stop__main");
  check(
    (await mainButton.getAttribute("aria-controls")) === null,
    "a closed place card is not named by its stop's button",
  );
  check(
    (await stop.locator(".timeline-stop__time").getAttribute("aria-controls")) === null,
    "a closed time form is not named by its time button",
  );
  await mainButton.click();
  await settle(page);
  check(
    await timeline.locator(".stop-place-card").isVisible(),
    "selecting a stop opens its place card",
  );
  const controlled = await mainButton.getAttribute("aria-controls");
  check(
    controlled !== null && (await page.evaluate((id) => !!document.getElementById(id), controlled)),
    `an open place card is named by its stop's button (${controlled})`,
  );
  await page.screenshot({ path: `${OUT}/interact-01-stop-open.png` });

  const stopBefore = await timeline.locator(".timeline-stop").first().innerText();

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

  check(
    (await timeline.locator(".timeline-stop").first().innerText()) === stopBefore,
    "undo restores the stop's earlier time",
  );

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
    await confirmDay(0);
    await confirmDay(1);
    await days.nth(1).click();
    await settle(page);

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

    await timeline.getByRole("button", { name: /Undo/ }).click();
    await settle(page, 800);
    check((await first.inputValue()) === before, `undo restores the leg to ${before}`);

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
    const [timed] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/trip/preview-edit") &&
          r.request().postDataJSON().operation.kind === "time",
      ),
      timeline.getByRole("button", { name: "Change time", exact: true }).click(),
    ]);

    const timedRoutes = (await timed.json()).routes;
    check(
      timedRoutes.length === legCount,
      `a time edit that changes the day routes its legs again (${timedRoutes.length} of ${legCount} legs)`,
    );
    await settle(page, 800);
    check(
      ops.filter((op) => op.kind === "verify").length === verifiesBefore,
      "the edited day is not verified a second time after a time edit",
    );
    check(
      (await modes.first().inputValue()) === target,
      `a chosen mode survives a later time edit (${target})`,
    );

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

    await timeline
      .getByRole("button", { name: /^Actions for / })
      .first()
      .click();
    await timeline.getByRole("menuitem", { name: "Move to ideas", exact: true }).click();
    await settle(page, 800);
    check(
      (await timeline.locator(".timeline-ideas .timeline-stop").count()) >= 1,
      "a stop moved to Ideas is listed there",
    );
    const remaining = timeline.locator(".timeline-day .timeline-stop").first();
    const timeBeforeEdit = await remaining.innerText();
    await remaining.locator(".timeline-stop__time").click();
    const ideaStart = timeline.getByLabel(/^Start/).first();
    const [ideaHour, ideaMinute] = (await ideaStart.inputValue()).split(":").map(Number);
    await ideaStart.fill(
      `${String(Math.min(ideaHour + 1, 20)).padStart(2, "0")}:${String(ideaMinute).padStart(2, "0")}`,
    );
    const ideaEnd = timeline.getByLabel(/^End/).first();
    const [ideaEndHour, ideaEndMinute] = (await ideaEnd.inputValue()).split(":").map(Number);
    await ideaEnd.fill(
      `${String(Math.min(ideaEndHour + 1, 22)).padStart(2, "0")}:${String(ideaEndMinute).padStart(2, "0")}`,
    );
    await timeline.getByRole("button", { name: "Change time", exact: true }).click();
    await settle(page, 800);
    check(
      !(await timeline.locator(".timeline-status--error").count()),
      "a time edit with an Idea in the plan is applied without an error",
    );
    await timeline.getByRole("button", { name: "Undo last change" }).click();
    await settle(page, 800);
    check(
      !(await timeline.locator(".timeline-status--error").count()),
      "Undo with an Idea in the plan shows no error",
    );
    check(
      (await timeline.locator(".timeline-day .timeline-stop").first().innerText()) ===
        timeBeforeEdit,
      "Undo restores the time with an Idea in the plan",
    );
    check(
      (await timeline.locator(".timeline-ideas .timeline-stop").count()) >= 1,
      "the Idea is still in Ideas after Undo",
    );
  }

  await page.waitForLoadState("networkidle");

  check(
    !errors.length,
    `interactions: no console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`,
  );
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
}

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

  await timeline.locator(".timeline-stop__time").first().click();
  const end = timeline.getByLabel(/^End/).first();
  const [endHour, endMinute] = (await end.inputValue()).split(":").map(Number);
  await end.fill(
    `${String(Math.min(endHour + 1, 22)).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`,
  );

  const answered = page.waitForResponse((r) => r.url().includes("/api/trip/preview-edit"));
  await timeline.getByRole("button", { name: "Change time", exact: true }).click();
  await answered;
  await settle(page, 300);

  const jpy = (text) => text.match(/JPY [\d.]+/)?.[0];
  const legs = await timeline.locator(".timeline-connection--checked").allInnerTexts();
  const text = legs.join(" | ");
  check(legs.length === 3, `timeline: all three checked legs shown (${legs.length})`);
  check(/JPY 230(?![.\d])/.test(text), `timeline: JPY fare has no decimals (${jpy(text)})`);
  check(/AUD 12\.50(?!\d)/.test(text), "timeline: AUD fare keeps two decimals");
  check(/KRW 1,400(?![.\d])/.test(text), "timeline: KRW fare has no decimals");
  await timeline.locator(".timeline-connection--checked").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/fare-02-timeline.png` });

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

  await page.waitForLoadState("networkidle");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await context.close();
}

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

const dayStops = (timeline) =>
  timeline.getByRole("list", { name: /^Day \d+ timeline$/ }).locator(".timeline-stop");

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

    const drawer = page.locator(".workspace-drawer--trip");
    await drawer.screenshot({ path: `${OUT}/numbers-02-trip-list.png` });

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

    await page.getByRole("button", { name: "Open your trip" }).click();
    await settle(page, 700);

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

const STATUS_LABEL = /^(Needs review|Needs you|Draft|Review plan)$/;
async function noStatusLabels(page, where) {
  const found = await page.getByText(STATUS_LABEL).count();
  check(
    found === 0,
    `${where}: no review or draft label is shown${found ? ` (${found} found)` : ""}`,
  );
}

async function stubChat(page, change) {
  let turn = 0;
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    turn += 1;
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        if (frame.response?.plan) change(frame.response.plan, turn);
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

async function conflictsPlan(browser) {
  const { context, page, errors } = await openTimeline(browser, {
    width: 1440,
    height: 1000,
    scheme: "light",
    setup: (page) =>
      stubChat(page, (plan) => {
        const tripId = plan.tripId;
        const items = plan.sections.find((s) => s.id === "itinerary").proposal.items;

        const [first, second] = items
          .filter((i) => i.kind === "activity" && i.startTime)
          .slice(0, 2);
        first.day = 1;
        second.day = 1;
        second.startTime = first.startTime;
        second.endTime = first.endTime;
        plan.conflicts = [
          {
            tripId,
            targetAgent: "itinerary",
            reason: "plan is 12.00% (AUD 300.00) over budget",
            constraints: ["cut itinerary cost by AUD 300.00"],
            targetSaving: 300,
          },
          {
            tripId,
            targetAgent: "itinerary",
            reason: `time overlap on day 1: ${first.startTime}-${first.endTime} conflicts with ${second.startTime}-${second.endTime}`,
            constraints: [`on day 1 keep clear of ${first.startTime}-${first.endTime}`],
          },
        ];
      }),
  });
  const drawer = page.locator(".workspace-drawer--trip");
  const budgetConflicts = drawer.locator(".trip-panel__budget-summary .trip-panel__conflicts");
  check(
    (await budgetConflicts.count()) === 1 &&
      /over the budget/.test(await budgetConflicts.innerText()),
    "an over-budget conflict is listed under the budget bar",
  );
  const barBox = await drawer.locator(".trip-panel__budget-summary .bar").boundingBox();
  const listBox = await budgetConflicts.boundingBox();
  check(
    !!barBox && !!listBox && listBox.y > barBox.y,
    "the over-budget conflict sits below the budget bar",
  );
  const marked = drawer.locator(".timeline-stop__conflicts");
  check(
    (await marked.count()) === 2 &&
      (await marked.allInnerTexts()).every((text) => /Overlaps .+ on this day\./.test(text)),
    "the overlapping Day 1 stops each show the overlap",
  );
  check(
    (await drawer.locator(".timeline-day__conflicts").count()) === 0,
    "an overlap between stops is marked on the stops, not under the day",
  );
  await noStatusLabels(page, "conflicts plan");

  await page.keyboard.press("Escape");
  await settle(page, 400);
  await page
    .getByRole("button", { name: /^Trips\b/ })
    .first()
    .click();
  await settle(page, 600);
  check((await page.getByText(/Trip to /).count()) >= 1, "the trip list shows the planned trip");
  await noStatusLabels(page, "trip list");
  const unexpected = errors.filter((text) => !PLACES_DOWN_LOG.test(text));
  check(
    !unexpected.length,
    `conflicts plan: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
  );
  await context.close();
}

async function replanNotice(browser, width, height) {
  let base = 0;
  const { context, page, errors } = await openTimeline(browser, {
    width,
    height,
    scheme: "light",
    setup: (page) =>
      stubChat(page, (plan, turn) => {
        if (turn === 1) base = plan.estTotal;
        if (turn === 2) plan.estTotal = base + 120;
      }),
  });
  const tag = `replan ${width}px`;
  check(
    (await page.locator(".estimate-notice").count()) === 0,
    `${tag}: a first plan shows no estimate notice`,
  );

  if (width >= 520) {
    await page.keyboard.press("Escape");
    await settle(page, 400);
  }
  if (width < 520) {
    const chat = page.getByRole("tab", { name: /^Chat/ });
    if (await chat.count()) await chat.click();
    await settle(page, 300);
  }
  await page
    .getByRole("textbox", { name: "Message AI Trip Planner" })
    .fill("Plan Sydney, 2026-11-10 to 2026-11-13, 2 travellers.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.locator(".msg-item--agent .msg-item__body").nth(1).waitFor({ timeout: 180_000 });
  await settle(page, 800);
  const notice = page.locator(".estimate-notice");
  check((await notice.count()) === 1, `${tag}: a chat replan shows one estimate notice`);
  const text = ((await notice.count()) ? await notice.first().innerText() : "").replace(
    /\s+/g,
    " ",
  );
  check(
    /Estimate changed by \+AUD\s?120\.00 from the previous plan\./.test(text),
    `${tag}: the notice shows the signed change (${text})`,
  );
  check(
    (await page.getByText(/^Estimate changed by/).count()) === 1,
    `${tag}: the change is shown once`,
  );
  await page.screenshot({ path: `${OUT}/replan-${width}px-notice.png` });
  await notice.getByRole("button", { name: "Dismiss", exact: true }).click();
  await settle(page, 300);
  check(
    (await page.locator(".estimate-notice").count()) === 0,
    `${tag}: Dismiss removes the notice`,
  );
  const unexpected = errors.filter((message) => !PLACES_DOWN_LOG.test(message));
  check(
    !unexpected.length,
    `${tag}: no console errors${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
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
    await conflictsPlan(browser);
    await replanNotice(browser, 1440, 1000);
    await replanNotice(browser, 390, 844);
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots: ${OUT}`);
if (failures.length) {
  console.log(`${failures.length} check(s) failed`);
  process.exit(1);
}
