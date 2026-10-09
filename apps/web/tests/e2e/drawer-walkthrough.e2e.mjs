// End-to-end walk through the finished Trip drawer as a traveller uses it, with simulated data (ticket #241,
// parent #233). The walk plans a trip, then checks that nothing asks for confirmation, that each leg shows its
// mode and duration, that changing one leg re-times the stops after it, that a time edit applies at once and
// Undo restores it, that an overlapping edit is marked on its stop, that a stay alternative can be taken, that
// the travel tips fold and stay folded after a reload on desktop, and that a restaurant from Ideas can be
// scheduled and undone. It runs at 1440 x 1000 and at 390 x 844, in English and in Chinese.
//
// Failure inventory this walk was written from:
// - a confirm badge, a "Use this place" box or a "Check routes" button comes back on a stop or a leg;
// - a status label (Needs review, Draft, Needs you, Review plan, Confirm) comes back in the drawer or the trip list;
// - a leg change routes more than its own leg, or leaves the stops after it at their old times;
// - a time edit waits for a preview, or Undo leaves the stop at its edited time;
// - an overlapping time edit is refused with a banner instead of being marked on the stop it concerns;
// - a stay alternative is taken but neither the total nor the stay's cost changes;
// - the travel tips fold is not remembered after a reload on desktop;
// - a restaurant scheduled from Ideas cannot be undone;
// - a stop time breaks into one-character lines, or a page scrolls sideways;
// - the Chinese drawer shows an English label that is not plan content (model or provider text), or a known
//   open item (see KNOWN_EXCEPTIONS, which lists exact strings and is never a pattern);
// - a console error or a failed request is logged during the walk.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e drawer-walkthrough
//   DATA_MODE=mock BASE_URL=http://localhost:3000 LABEL=run-1 node apps/web/tests/e2e/drawer-walkthrough.e2e.mjs
//
// The walk runs in mock mode: the places it needs are stubbed at the browser boundary, and the server answers
// every edit with simulated legs. Nothing here calls Google, so no MAPS_API_KEY is needed and no check is skipped.
// Artifact: output/playwright/drawer-walkthrough/<LABEL>/summary.json, with screenshots beside it. LABEL defaults
// to the start time of the run, so two runs in a row keep two folders.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STARTED = new Date().toISOString();
const LABEL = process.env.LABEL ?? STARTED.replace(/[:.]/g, "-");
const OUT = resolve(process.cwd(), "output/playwright/drawer-walkthrough", LABEL);
mkdirSync(OUT, { recursive: true });

// Stop names the chat's plan is given, in plan order: the mock plan has one stop on each of four days.
const STOP_NAMES = [
  "Sydney Opera House",
  "Royal Botanic Garden Sydney",
  "Circular Quay",
  "Art Gallery of New South Wales",
];

// Exact English strings the Chinese drawer is known to show. Each is listed in full, so a changed sentence fails
// the walk. Model replies and provider text (the plan's own words) are excluded by content, not listed here.
const KNOWN_EXCEPTIONS = {
  zh: [
    // Brand name inside a Chinese label ("open in Google Maps"), not an English label.
    "在 Google 地图打开",
  ],
};

// The labels the walk clicks, in each interface language. Controls are found by class where the class is
// stable across languages; these names are used only where a control has no class of its own.
const LANGS = {
  en: {
    locale: "en-AU",
    chatTab: /^Chat/,
    tripTab: /^Trip/,
    mineTab: /^Mine/,
    openTrip: "Open your trip",
    trips: /^Trips\b/,
    changeTime: "Change time",
    moveToDay: "Move to another day",
    scheduleOnDay: "Schedule on a day",
    schedule: "Schedule",
    restaurant: "Restaurant suggestion",
  },
  zh: {
    locale: "zh-CN",
    chatTab: /^聊天/,
    tripTab: /^行程/,
    mineTab: /^我的/,
    openTrip: "打开你的行程",
    trips: /^行程/,
    changeTime: "修改时间",
    moveToDay: "移至其他一天",
    scheduleOnDay: "安排到某一天",
    schedule: "安排日期",
    restaurant: "餐厅建议",
  },
};

// Lines of the drawer or the page that name a status, a review or a confirmation. None may appear in either language.
const FORBIDDEN_LINE =
  /^(Needs review|Needs you|Draft|Review plan|Confirm|Use this place|Check routes|Not confirmed|Map match|Apply changes|Edit preview)$/i;
// A stop's tag that asks for a decision. "Place confirmed" is a saved-place status, not a request, and is counted in the summary.
const CONFIRM_TAG = /not confirmed|map match|use this place|^confirm$/i;
const CURRENCY = /\b(AUD|USD|JPY|KRW|EUR|GBP|NZD|CNY|SGD|HKD)\b/g;

const summary = {
  started: STARTED,
  label: LABEL,
  baseUrl: BASE,
  runs: [],
  knownExceptions: [],
  checks: [],
};
let failures = 0;
const check = (ok, message) => {
  if (!ok) failures += 1;
  summary.checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
/** Polls a test until it passes or the time runs out; resolves to whether it passed. */
async function until(page, test, ms = 10_000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await settle(page, 200);
  }
  return test();
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
/** Minutes a leg label reads, in English ("2 h 20 min", "9 min") or Chinese ("2 小时 20 分钟", "9 分钟"). */
function minutesIn(text) {
  const hours = /(\d+)\s*(?:h|小时)(?:\s*(\d+)\s*(?:min|分钟))?/.exec(text);
  if (hours) return Number(hours[1]) * 60 + Number(hours[2] ?? 0);
  const minutes = /(\d+)\s*(?:min|分钟)/.exec(text);
  return minutes ? Number(minutes[1]) : undefined;
}

// Text the stubbed places carry (names and addresses from the map provider). The English scan treats it as plan content.
const providerText = new Set();

function placeFor(text) {
  const offset = text.length * 0.001;
  const place = {
    id: `e2e-place-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    displayName: { text },
    formattedAddress: `${text}, Sydney NSW, Australia`,
    location: { latitude: -33.8568 + offset, longitude: 151.2153 + offset },
    googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(text)}`,
  };
  providerText.add(text);
  providerText.add(place.formattedAddress);
  return place;
}

/** Place lookups answer from fixed places, so every stop the map finds is saved without a map key. */
async function installPlaces(page) {
  const found = new Map();
  await page.route("**/api/places/search", (route) => {
    const { text } = route.request().postDataJSON();
    const place = placeFor(text);
    found.set(place.id, place);
    return route.fulfill({ json: { places: [place] } });
  });
  await page.route("**/api/places/details", (route) => {
    const { placeId } = route.request().postDataJSON();
    const place = found.get(placeId) ?? placeFor(placeId);
    return route.fulfill({ json: { place: { ...place, id: placeId } } });
  });
}

/** Gives the mock plan's day stops the names above, without a place, as a real plan from chat would have. */
async function installStopNames(page) {
  await page.route("**/api/chat", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        const frame = JSON.parse(line);
        const section = frame.response?.plan?.sections.find((s) => s.id === "itinerary");
        if (!section?.proposal) return line;
        let index = 0;
        for (const item of section.proposal.items) {
          if (item.kind !== "activity" || item.day === undefined) continue;
          const name = STOP_NAMES[index % STOP_NAMES.length];
          index += 1;
          item.location = name;
          item.detail = name;
          delete item.placeId;
        }
        return JSON.stringify(frame);
      })
      .join("\n");
    await route.fulfill({ response, body });
  });
}

/** The plan as the workspace stores it in this browser. */
const storedPlan = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan ?? null;
    } catch {
      return null;
    }
  });

const waitEdit = (page, kind) =>
  page.waitForResponse(
    (r) => {
      if (!r.url().endsWith("/api/trip/preview-edit")) return false;
      try {
        return r.request().postDataJSON().operation.kind === kind;
      } catch {
        return false;
      }
    },
    { timeout: 30_000 },
  );

/**
 * The rows of the chosen day, in the order shown: stops with their times and tags, legs with their mode and
 * label, and the flight and stay rows, which are read as text only.
 */
const readDay = (page) =>
  page.evaluate(() => {
    const list = document.querySelector(".timeline-day ol.timeline");
    if (!list) return [];
    return [...list.children].map((li) => {
      if (li.classList.contains("timeline-connection")) {
        const select = li.querySelector(".timeline-connection__mode");
        return {
          kind: "leg",
          mode: select ? select.value : null,
          label: li.querySelector(".timeline-connection__label")?.textContent.trim() ?? "",
          buttons: li.querySelectorAll("button").length,
          failed: li.classList.contains("timeline-connection--failed"),
        };
      }
      if (li.classList.contains("timeline-stop")) {
        const times =
          li.querySelector(".timeline-stop__time")?.textContent.match(/\d{2}:\d{2}/g) ?? [];
        const nameNode = li.querySelector(".timeline-stop__name");
        const name = [...(nameNode?.childNodes ?? [])]
          .filter((node) => !(node.nodeType === 1 && node.classList.contains("sr-only")))
          .map((node) => node.textContent)
          .join("")
          .trim();
        return {
          kind: "stop",
          name,
          start: times[0] ?? null,
          end: times[1] ?? null,
          tags: [...li.querySelectorAll(".timeline-tag")].map((tag) => tag.textContent.trim()),
          conflicts: [...li.querySelectorAll(".timeline-stop__conflicts li")].map((item) =>
            item.textContent.trim(),
          ),
        };
      }
      return { kind: "fixed", className: li.className, text: li.innerText.trim() };
    });
  });

const stopsOf = (rows) => rows.filter((row) => row.kind === "stop");
const legsOf = (rows) => rows.filter((row) => row.kind === "leg");

/** Every visible line of the drawer that names a status or a confirmation, in English. */
async function forbiddenLines(page, where) {
  const lines = (await page.locator(TRIP_SELECTOR(page)).innerText())
    .split("\n")
    .map((line) => line.trim());
  return lines.filter((line) => FORBIDDEN_LINE.test(line));
}

// The drawer's root: the desktop Trip drawer, or the phone's Trip panel.
function TRIP_SELECTOR(page) {
  return page.__phone ? "#phone-panel-trip" : ".workspace-drawer--trip";
}

/** Text that the plan itself carries: stop names, notes, tips, stay and flight text. Conflicts and notices are not included. */
const NOT_CONTENT = new Set([
  "conflicts",
  "conflictsWith",
  "editIssues",
  "reason",
  "message",
  "constraints",
  "blockers",
  "blockerNotices",
  "summary",
]);
function planContent(value, out = []) {
  if (typeof value === "string") {
    const text = value.trim();
    // Short words and single lower-case tokens are enum values or ids, not text the plan wrote for a reader.
    if (text.length >= 6 && (/\s/.test(text) || /^[A-Z]/.test(text))) out.push(text);
  } else if (Array.isArray(value)) value.forEach((item) => planContent(item, out));
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value))
      if (!NOT_CONTENT.has(key)) planContent(item, out);
  return out;
}

/**
 * Every visible line of the drawer in Chinese that still reads in English after the plan's own text, the
 * destination, and currency codes are removed. A line that equals a KNOWN_EXCEPTIONS string is reported
 * as a known exception with its text, never as a pass.
 */
async function englishLabels(page, plan, stage, run) {
  const content = [...planContent(plan), ...providerText];
  const lines = (await page.locator(TRIP_SELECTOR(page)).innerText())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const unknown = [];
  for (const line of lines) {
    if (KNOWN_EXCEPTIONS.zh.includes(line)) {
      summary.knownExceptions.push({ run, stage, text: line });
      continue;
    }
    let rest = line;
    for (const text of [...content].sort((a, b) => b.length - a.length))
      if (rest.includes(text)) rest = rest.split(text).join(" ");
    rest = rest.replace(CURRENCY, " ");
    const words = rest.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
    if (words.length) unknown.push({ line, words });
  }
  check(
    unknown.length === 0,
    `${run} ${stage}: no English label is visible in the Chinese drawer${
      unknown.length ? ` (${unknown.map((item) => `"${item.line}"`).join(", ")})` : ""
    }`,
  );
  return unknown;
}

/** The time each stop's time button reads: two lines at most, and no digit broken into a column of single characters. */
async function stopTimeLayout(page) {
  return page.locator(".timeline-day .timeline-stop__time").evaluateAll((buttons) =>
    buttons
      .filter((button) => /\d{2}:\d{2}/.test(button.textContent))
      .map((button) => {
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
        return {
          text: button.textContent.trim(),
          lines: tops.size,
          narrowest: Math.min(...boxes.map((rect) => rect.width)),
          whiteSpace: getComputedStyle(button).whiteSpace,
        };
      }),
  );
}

/** Opens a stop's ⋯ menu and takes one of its items by its name. */
async function stopMenu(page, row, name) {
  await row.locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

/**
 * Applies a start and end time through the stop's time button. The time edit goes to the server, with no
 * preview. A stop already at those times has no change to send: its Change time button is disabled, so
 * nothing is sent and the stop is left as it is.
 */
async function editTime(page, row, startMinutes, endMinutes, L) {
  const shown =
    (await row.locator(".timeline-stop__time").textContent()).match(/\d{2}:\d{2}/g) ?? [];
  if (shown[0] === hhmm(startMinutes) && shown[1] === hhmm(endMinutes)) return undefined;
  await row.locator(".timeline-stop__time").click();
  const form = row.locator("form.stop-editor__time");
  await form.locator("input[type=time]").nth(0).fill(hhmm(startMinutes));
  await form.locator("input[type=time]").nth(1).fill(hhmm(endMinutes));
  const [response] = await Promise.all([
    waitEdit(page, "time"),
    form.locator("button[type=submit]").click(),
  ]);
  await settle(page, 800);
  return response;
}

/** Changes one leg's mode with its select. Resolves to the number of legs the server routed for that change. */
async function chooseLeg(page, index, mode) {
  const select = page.locator(".timeline-day .timeline-connection__mode").nth(index);
  const [response] = await Promise.all([waitEdit(page, "leg"), select.selectOption(mode)]);
  const body = await response.json();
  await until(page, async () => (await select.inputValue()) === mode);
  await settle(page, 800);
  return body.routes?.length ?? -1;
}

async function clickUndo(page) {
  const undo = page.locator(".item-undo button, .timeline-undo button").first();
  check((await undo.count()) > 0, "an applied change offers Undo");
  await undo.click();
  await settle(page, 900);
}

const dayTab = (page, day) => page.locator(".day-strip [role=tab]").nth(day - 1);

/** Plans the simulated trip and opens the drawer at this width and language. */
async function plan(browser, { width, lang, run }) {
  const L = LANGS[lang];
  const phone = width < 700;
  const context = await browser.newContext({
    viewport: { width, height: phone ? 844 : 1000 },
    deviceScaleFactor: 1,
    locale: L.locale,
  });
  const page = await context.newPage();
  page.__phone = phone;
  const errors = [];
  const saves = new Set();
  // Chrome probes the legacy favicon; the application serves icon.svg, so that one 404 is not an error.
  const isFavicon = (url) => new URL(url).pathname === "/favicon.ico";
  page.on("console", (message) => {
    if (message.type() !== "error" || isFavicon(message.location().url)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("requestfailed", (request) => {
    // Next cancels its own route prefetch (an RSC request) when the walk navigates on; that is not a failure.
    const cancelled =
      request.failure()?.errorText === "net::ERR_ABORTED" && /[?&]_rsc=/.test(request.url());
    if (!isFavicon(request.url()) && !cancelled) errors.push(`request failed: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !isFavicon(response.url()))
      errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/trip/preview-edit")) return;
    try {
      const { operation } = request.postDataJSON();
      if (operation.kind === "place") saves.add(operation.id);
    } catch {}
  });
  await installPlaces(page);
  await installStopNames(page);
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  const mode = await (await context.request.get(`${BASE}/api/data-mode`)).json();
  check(mode.configured === "mock", `${run}: the server plans with mock data`);
  if (phone) {
    const chat = page.getByRole("tab", { name: L.chatTab });
    if (await chat.count()) await chat.click();
  }
  const suggestion = page.locator(".chat-empty__suggestions button").first();
  await suggestion.waitFor({ state: "visible", timeout: 60_000 });
  await suggestion.click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1200);
  if (phone) await page.getByRole("tab", { name: L.tripTab }).first().click();
  else await page.locator(".workspace-app").getByRole("button", { name: L.openTrip }).click();
  const trip = page.locator(TRIP_SELECTOR(page));
  await trip.locator(".trip-editor").waitFor({ timeout: 30_000 });
  // Each of the four stops is saved as its place is found, on its own day.
  await until(page, async () => saves.size >= 4, 60_000);
  check(saves.size === 4, `${run}: every stop the map finds is saved (${saves.size} saves)`);
  return { context, page, trip, errors, L, phone };
}

/** The walk itself, after planning. */
async function walk(browser, { width, lang }) {
  const run = `${width}px ${lang}`;
  const tag = `${width}-${lang}`;
  const runSummary = { run, width, lang, stages: {}, measures: {}, consoleErrors: [] };
  summary.runs.push(runSummary);
  const { context, page, trip, errors, L, phone } = await plan(browser, { width, lang, run });
  const shot = (stage) => trip.screenshot({ path: `${OUT}/${tag}-${stage}.png` });
  const knownBefore = summary.knownExceptions.length;

  // 1. The planned trip: no status label, no confirm badge or box on any stop.
  check(
    (await forbiddenLines(page, run)).length === 0,
    `${run}: no "Needs review", "Draft", "Needs you", "Review plan" or "Confirm" text in the drawer`,
  );
  const planned = await storedPlan(page);
  runSummary.stages.planned = {
    estTotal: planned?.estTotal,
    stops: planned?.sections
      .find((s) => s.id === "itinerary")
      ?.proposal?.items.filter((i) => i.kind === "activity").length,
  };
  const tagsFor = async () => {
    const found = [];
    for (let day = 1; day <= 4; day += 1) {
      await dayTab(page, day).click();
      await settle(page, 300);
      for (const row of stopsOf(await readDay(page))) found.push({ day, ...row });
    }
    return found;
  };
  const allStops = await tagsFor();
  const confirmTags = allStops.flatMap((stop) => stop.tags.filter((tag) => CONFIRM_TAG.test(tag)));
  check(allStops.length === 4, `${run}: the plan has four stops on four days (${allStops.length})`);
  check(
    confirmTags.length === 0,
    `${run}: no stop shows a confirm badge (${confirmTags.join(", ") || "none"})`,
  );
  check(
    (await page.getByRole("button", { name: /Use this place|^Confirm/ }).count()) === 0,
    `${run}: no stop shows a "Use this place" or "Confirm" box`,
  );
  // Counted in English only; the Chinese label is not matched, so the Chinese run records null.
  runSummary.measures.placeConfirmedTags =
    lang === "en" ? allStops.filter((stop) => stop.tags.includes("Place confirmed")).length : null;
  await dayTab(page, 1).click();
  await settle(page, 400);
  await shot("01-planned");

  // 2. Two more stops move onto Day 1, so the day has three stops and two legs between them.
  for (const fromDay of [2, 3]) {
    await dayTab(page, fromDay).click();
    await settle(page, 300);
    const row = page.locator(".timeline-day ol.timeline > li.timeline-stop").first();
    await stopMenu(page, row, L.moveToDay);
    await trip.locator(".stop-place-card select").selectOption("1");
    await settle(page, 900);
  }
  await dayTab(page, 1).click();
  await settle(page, 400);
  const legsReady = await until(
    page,
    async () => (await page.locator(".timeline-day .timeline-connection__mode").count()) === 2,
    30_000,
  );
  check(legsReady, `${run}: Day 1 shows a leg between each pair of its three stops`);
  let day = readDay(page);
  let rows = await day;
  let stops = stopsOf(rows);
  let legs = legsOf(rows);
  check(
    stops.length === 3 && legs.length === 2,
    `${run}: Day 1 has 3 stops and 2 legs (${stops.length}, ${legs.length})`,
  );

  // 3. Each leg shows its mode and its duration, and has no button.
  check(
    legs.every(
      (leg) =>
        ["walk", "transit", "drive"].includes(leg.mode) && minutesIn(leg.label) !== undefined,
    ),
    `${run}: each leg shows its mode and duration (${legs.map((leg) => leg.label.replace(/\s+/g, " ")).join(" | ")})`,
  );
  check(
    legs.every((leg) => leg.buttons === 0),
    `${run}: no leg has a button`,
  );
  check(
    (await page.getByRole("button", { name: /Check routes/ }).count()) === 0,
    `${run}: no "Check routes" button`,
  );
  await shot("02-legs");

  // 4. A time edit applies at once, with no preview, and Undo restores the stop's earlier time.
  const first = stopsOf(await readDay(page))[0];
  const firstRow = page.locator(".timeline-day ol.timeline > li.timeline-stop").nth(0);
  const rowBefore = await firstRow.innerText();
  const startBefore = toMinutes(first.start);
  const endBefore = toMinutes(first.end);
  await editTime(page, firstRow, startBefore + 60, endBefore + 60, L);
  const afterEdit = stopsOf(await readDay(page))[0];
  check(
    afterEdit.start === hhmm(startBefore + 60),
    `${run}: a time edit applies at once (${first.start} to ${afterEdit.start})`,
  );
  check(
    (await page.locator(".edit-preview").count()) === 0 &&
      (await page.getByRole("region", { name: "Edit preview" }).count()) === 0 &&
      (await page.getByRole("button", { name: /^Apply changes$/ }).count()) === 0,
    `${run}: a time edit has no preview and no Apply button`,
  );
  await clickUndo(page);
  check(
    (await firstRow.innerText()) === rowBefore,
    `${run}: Undo restores the stop's earlier time (${first.start}–${first.end})`,
  );

  // 5. A leg's mode changes that leg alone and re-times the stops after it. The planner starts a stop no
  // earlier than the stop before it ends, plus that leg's time and a 15 minute buffer. The test first sets the
  // second and third stops to exactly that earliest time, with each leg in drive, so that changing the leg
  // into the second stop to walk (a longer leg) pushes the second stop and then the third.
  const rowOf = (index) => page.locator(".timeline-day ol.timeline > li.timeline-stop").nth(index);
  const dayRows = async () => stopsOf(await readDay(page));
  const legAt = async (index) => legsOf(await readDay(page))[index];
  const ensureDrive = async (index) => {
    const current = await page
      .locator(".timeline-day .timeline-connection__mode")
      .nth(index)
      .inputValue();
    if (current !== "drive") await chooseLeg(page, index, "drive");
  };

  await ensureDrive(0);
  const legInto2Drive = await legAt(0);
  const stopsNow = await dayRows();
  const durationB = toMinutes(stopsNow[1].end) - toMinutes(stopsNow[1].start);
  const earliestB = toMinutes(stopsNow[0].end) + minutesIn(legInto2Drive.label) + 15;
  await editTime(page, rowOf(1), earliestB, earliestB + durationB, L);
  const afterPrepB = await dayRows();
  check(
    afterPrepB[1].start === hhmm(earliestB),
    `${run}: the second stop starts at the earliest time after its drive (${afterPrepB[1].start})`,
  );

  await ensureDrive(1);
  const legInto3Drive = await legAt(1);
  const durationC = toMinutes(afterPrepB[2].end) - toMinutes(afterPrepB[2].start);
  const earliestC = toMinutes(afterPrepB[1].end) + minutesIn(legInto3Drive.label) + 15;
  await editTime(page, rowOf(2), earliestC, earliestC + durationC, L);
  const beforeLegChange = await dayRows();
  const legs3Before = await legAt(1);
  check(
    beforeLegChange[2].start === hhmm(earliestC) && legs3Before.label === legInto3Drive.label,
    `${run}: the third stop starts at the earliest time after its drive (${beforeLegChange[2].start})`,
  );

  const legInto2Before = await legAt(0);
  const routed = await chooseLeg(page, 0, "walk");
  const afterLegChange = await dayRows();
  const legsAfterChange = await legsOf(await readDay(page));
  const walkMinutes = minutesIn(legsAfterChange[0].label);
  const driveMinutes = minutesIn(legInto2Before.label);
  check(
    walkMinutes > driveMinutes,
    `${run}: the walk into the second stop is longer than its drive (${walkMinutes} > ${driveMinutes} min)`,
  );
  check(routed === 1, `${run}: a leg change routes only that leg (${routed} routed)`);
  check(legsAfterChange[0].mode === "walk", `${run}: the leg into the second stop now walks`);
  check(
    legsAfterChange[1].label === legs3Before.label && legsAfterChange[1].mode === legs3Before.mode,
    `${run}: the other leg keeps its mode and duration (${legsAfterChange[1].label})`,
  );
  const expectedB = Math.max(
    toMinutes(beforeLegChange[1].start),
    toMinutes(beforeLegChange[0].end) + walkMinutes + 15,
  );
  const durationAfterB = toMinutes(beforeLegChange[1].end) - toMinutes(beforeLegChange[1].start);
  const expectedC = Math.max(
    toMinutes(beforeLegChange[2].start),
    expectedB + durationAfterB + minutesIn(legs3Before.label) + 15,
  );
  check(
    afterLegChange[1].start === hhmm(expectedB),
    `${run}: the stop after the changed leg is re-timed (${beforeLegChange[1].start} to ${afterLegChange[1].start}, expected ${hhmm(expectedB)})`,
  );
  check(
    toMinutes(afterLegChange[2].start) > toMinutes(beforeLegChange[2].start) &&
      afterLegChange[2].start === hhmm(expectedC),
    `${run}: the stop after that is re-timed too (${beforeLegChange[2].start} to ${afterLegChange[2].start}, expected ${hhmm(expectedC)})`,
  );
  check(
    afterLegChange[0].start === beforeLegChange[0].start,
    `${run}: the first stop keeps its time`,
  );
  runSummary.measures.legChange = {
    before: beforeLegChange.map((row) => ({ name: row.name, start: row.start, end: row.end })),
    after: afterLegChange.map((row) => ({ name: row.name, start: row.start, end: row.end })),
    legs: legsAfterChange.map((leg) => leg.label),
  };
  await shot("03-leg-retimed");
  await clickUndo(page);
  const afterUndo = await dayRows();
  check(
    (await legAt(0)).mode === "drive" && afterUndo[1].start === beforeLegChange[1].start,
    `${run}: Undo puts the leg back and restores the stops' times`,
  );

  // 6. An overlapping edit applies, and the stop it concerns is marked with its conflict. No banner appears.
  // The second stop is moved to start inside the first stop's time.
  const firstStart = toMinutes(afterUndo[0].start);
  const secondDuration = toMinutes(afterUndo[1].end) - toMinutes(afterUndo[1].start);
  await editTime(page, rowOf(1), firstStart + 30, firstStart + 30 + secondDuration, L);
  const overlapped = (await dayRows())[1];
  check(
    overlapped.start === hhmm(firstStart + 30),
    `${run}: the overlapping time applies (${overlapped.start})`,
  );
  check(
    (await page.locator(".timeline-status--error").count()) === 0,
    `${run}: the overlap is not shown as a banner`,
  );
  // The overlap marker names the stop it overlaps; the travel buffer message says what the stop needs. Both are on the stop.
  const markerText =
    lang === "zh"
      ? /^与 \d{2}:\d{2}–\d{2}:\d{2} 时段重叠。$/
      : /^Overlaps \d{2}:\d{2}–\d{2}:\d{2} on this day\.$/;
  const overlapMarker = overlapped.conflicts.find((text) => markerText.test(text));
  // A stored notice is shown in the traveller's language (keyed notice), so the Chinese page reads the Chinese sentence.
  const bufferPattern =
    lang === "zh"
      ? /需与上一项活动至少间隔 \d+ 分钟。$/
      : /needs at least \d+ minutes after the previous activity\.$/;
  const bufferMessage = overlapped.conflicts.find((text) => bufferPattern.test(text));
  check(
    Boolean(overlapMarker) && Boolean(bufferMessage),
    `${run}: the overlapping stop is marked with its conflicts (${JSON.stringify(overlapped.conflicts)})`,
  );
  runSummary.measures.overlapMarked = (await dayRows()).map((row) => ({
    name: row.name,
    conflicts: row.conflicts,
  }));
  await shot("04-overlap-marked");
  if (lang === "zh") await englishLabels(page, await storedPlan(page), "overlap", run);
  await clickUndo(page);
  const afterOverlapUndo = await dayRows();
  check(
    afterOverlapUndo[1].start === afterUndo[1].start &&
      afterOverlapUndo.every((row) => row.conflicts.length === 0),
    `${run}: Undo restores the second stop's time and clears its conflict`,
  );

  // 7. The night's stay opens its card, and an Alternative can be taken: the total and the stay's cost change.
  const stayRow = page.locator(".timeline-day li.timeline-fixed--stay").first();
  await stayRow.locator("button.timeline-booking__open").click();
  const alternative = stayRow.locator(".alternatives__pick").first();
  check((await alternative.count()) === 1, `${run}: the stay card offers an Alternative`);
  const costBefore = await stayRow.locator(".timeline-row__cost").innerText();
  const totalBefore = (await storedPlan(page))?.estTotal;
  const stayBefore = (await storedPlan(page))?.sections.find((s) => s.id === "accommodation")
    ?.proposal?.stays?.[0]?.selectedId;
  await alternative.click();
  await page.waitForFunction(
    (before) => {
      try {
        const plan = JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan;
        return (
          plan?.sections.find((s) => s.id === "accommodation")?.proposal?.stays?.[0]?.selectedId !==
          before
        );
      } catch {
        return false;
      }
    },
    stayBefore,
    { timeout: 20_000 },
  );
  await settle(page, 600);
  const totalAfter = (await storedPlan(page))?.estTotal;
  const costAfter = await stayRow.locator(".timeline-row__cost").innerText();
  check(
    totalAfter !== totalBefore,
    `${run}: taking the Alternative changes the total (${totalBefore} to ${totalAfter})`,
  );
  check(
    costAfter !== costBefore,
    `${run}: taking the Alternative changes the stay's cost (${costBefore} to ${costAfter})`,
  );
  runSummary.measures.stay = { costBefore, costAfter, totalBefore, totalAfter };
  await shot("05-stay-alternative");

  // 8. A restaurant from Ideas is scheduled on a day, and Undo puts it back in Ideas.
  const restaurantIdea = () =>
    page
      .locator(".timeline-ideas li.timeline-stop--idea")
      .filter({ hasText: L.restaurant })
      .first();
  const ideasBefore = await page.locator(".timeline-ideas li.timeline-stop--idea").count();
  const idea = restaurantIdea();
  const ideaName = await idea.locator(".timeline-stop__name").evaluate((node) =>
    [...node.childNodes]
      .filter((n) => !(n.nodeType === 1 && n.classList.contains("sr-only")))
      .map((n) => n.textContent)
      .join("")
      .trim(),
  );
  check(
    ideasBefore >= 1 && (await idea.count()) === 1,
    `${run}: Ideas list a restaurant suggestion (${ideaName})`,
  );
  await idea.locator(".action-menu__trigger").click();
  await page.getByRole("menuitem", { name: L.scheduleOnDay, exact: true }).click();
  await trip.locator(".stop-place-card select").selectOption("2");
  await trip.locator(".stop-place-card button[type=submit]").click();
  await settle(page, 700);
  check(
    (await page.locator(".timeline-ideas li.timeline-stop--idea").count()) === ideasBefore - 1,
    `${run}: scheduling takes the restaurant out of Ideas`,
  );
  await dayTab(page, 2).click();
  await settle(page, 400);
  const onDay2 = await readDay(page);
  check(
    stopsOf(onDay2).some((row) => row.name === ideaName),
    `${run}: the restaurant is on Day 2 (${ideaName})`,
  );
  await shot("06-idea-scheduled");
  await clickUndo(page);
  check(
    (await page.locator(".timeline-ideas li.timeline-stop--idea").count()) === ideasBefore,
    `${run}: Undo puts the restaurant back in Ideas`,
  );
  await dayTab(page, 2).click();
  await settle(page, 400);
  check(
    !stopsOf(await readDay(page)).some((row) => row.name === ideaName),
    `${run}: Undo takes it off Day 2`,
  );
  await dayTab(page, 1).click();
  await settle(page, 400);

  // 9. The travel tips fold, and the fold is remembered after a reload on desktop.
  const tips = page.locator("details.trip-tips");
  check((await tips.count()) === 1, `${run}: the travel tips block is shown`);
  const openAtStart = await tips.evaluate((el) => el.open);
  await tips.locator("summary").click();
  await settle(page, 300);
  const openAfterFold = await tips.evaluate((el) => el.open);
  check(
    openAfterFold === !openAtStart,
    `${run}: the travel tips fold on a click (open ${openAtStart} to ${openAfterFold})`,
  );
  if (!phone) {
    await page.reload();
    await page.waitForSelector(".workspace-app");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.waitForLoadState("networkidle");
    // A reload opens a blank chat; the saved trip stays in Trips until it is chosen there.
    const tipsShown = () =>
      page
        .locator("details.trip-tips")
        .first()
        .isVisible()
        .catch(() => false);
    if (!(await tipsShown())) {
      await page.getByRole("button", { name: L.trips }).first().click();
      await settle(page, 600);
      // The Trips page lists each trip as a card whose name ends with its budget, in either language.
      await page.getByRole("button", { name: /AUD/ }).first().click();
      await settle(page, 700);
    }
    // The trip drawer may still be closed after choosing the trip; its toggle opens it.
    if (!(await tipsShown()))
      await page.locator(".workspace-app").getByRole("button", { name: L.openTrip }).click();
    await page.locator("details.trip-tips").first().waitFor({ state: "visible", timeout: 20_000 });
    const remembered = await page.locator("details.trip-tips").evaluate((el) => el.open);
    check(
      remembered === openAfterFold,
      `${run}: the tips keep their fold after a reload (open ${remembered})`,
    );
    runSummary.measures.tipsAfterReload = remembered;
  }
  await shot("07-tips");

  // 10. Each stop time is one line of digits, the layout does not overflow, and no console error was logged.
  const timeLayout = await stopTimeLayout(page);
  runSummary.measures.stopTimes = timeLayout;
  check(
    timeLayout.length > 0 &&
      timeLayout.every(
        (time) => time.lines <= 2 && time.narrowest >= 18 && time.whiteSpace === "nowrap",
      ),
    `${run}: each stop time keeps its digits on two lines with nowrap (${JSON.stringify(timeLayout.slice(0, 2))})`,
  );
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `${run}: no horizontal page scroll`,
  );
  if (lang === "zh") await englishLabels(page, await storedPlan(page), "final", run);
  check(
    (await forbiddenLines(page, run)).length === 0,
    `${run}: still no status or confirm text after the walk`,
  );
  // The trip list: the same trip, with no status label.
  if (!phone) {
    await page.keyboard.press("Escape");
    await settle(page, 400);
    await page.getByRole("button", { name: L.trips }).first().click();
    await settle(page, 600);
  } else {
    await page.getByRole("tab", { name: L.mineTab }).click();
    await settle(page, 600);
  }
  const listLines = (await page.locator("body").innerText()).split("\n").map((line) => line.trim());
  check(
    !listLines.some((line) => FORBIDDEN_LINE.test(line)),
    `${run}: the trip list shows no status label`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-08-trip-list.png` });
  const unexpected = errors.filter((text) => !/favicon/.test(text));
  runSummary.consoleErrors = unexpected;
  check(
    !unexpected.length,
    `${run}: no console errors or failed requests${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
  );
  runSummary.knownExceptionsHere = summary.knownExceptions.length - knownBefore;
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390])
    for (const lang of ["en", "zh"]) await walk(browser, { width, lang });
} finally {
  await browser.close();
  summary.failures = failures;
  summary.finished = new Date().toISOString();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
}
console.log(
  `\n${summary.checks.length} checks, ${failures} failed, ${summary.knownExceptions.length} known exception(s)`,
);
console.log(`artifact: ${OUT}/summary.json`);
process.exitCode = failures ? 1 : 0;
