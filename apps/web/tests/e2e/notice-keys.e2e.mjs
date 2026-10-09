// Notices on a plan are keys, and the Trip drawer localises them (ticket #261, spec #259). The walk plans a trip,
// moves two stops onto Day 1, and then changes a stop's time so that its leg breaks the travel buffer. It runs
// two phases at each width, in English and in Chinese:
//   keyed   the server's answer as it is: the notice is a stored key on its destination stop (control);
//   legacy  the same answer with the stored key taken away, as a plan saved before notices were keyed looks:
//           only the English sentence remains in conflictsWith, and the drawer has to place and localise it.
// Each phase checks that the travel-buffer sentence sits under its destination stop only and never under the day
// title, that the Chinese drawer shows no English travel-buffer text, that the English wording is unchanged, and
// that the chat's English copy (conflictsWith and plan.conflicts in the answer) is still there.
//
// Failure inventory this walk was written from:
// - a travel-buffer sentence written in English under a day title in the Chinese interface (a legacy plan);
// - a travel-buffer sentence attached to every stop of its day, or to the stop before the leg;
// - a legacy sentence localised on one width and not the other;
// - the English wording of a notice changes when it is localised or placed;
// - the chat's English copy disappears from the answer, so the chat reads no conflict;
// - a page error or a failed request while the notice is placed.
//
//   DATA_MODE=mock pnpm --filter @trip/web e2e notice-keys
//   DATA_MODE=mock BASE_URL=http://localhost:3000 LABEL=run-1 node apps/web/tests/e2e/notice-keys.e2e.mjs
//
// Mock mode: the places are stubbed at the browser boundary and the server answers every edit with simulated legs.
// Artifact: output/playwright/notice-keys/<LABEL>/summary.json. LABEL defaults to the start time of the run.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STARTED = new Date().toISOString();
const LABEL = process.env.LABEL ?? STARTED.replace(/[:.]/g, "-");
const OUT = resolve(process.cwd(), "output/playwright/notice-keys", LABEL);
mkdirSync(OUT, { recursive: true });

// Stop names the chat's plan is given, in plan order (the mock plan has one stop on each of four days).
const STOP_NAMES = [
  "Sydney Opera House",
  "Royal Botanic Garden Sydney",
  "Circular Quay",
  "Art Gallery of New South Wales",
];

const LANGS = {
  en: {
    locale: "en-AU",
    tripTab: /^Trip/,
    mineTab: /^Mine/,
    openTrip: "Open your trip",
    chatTab: /^Chat/,
    moveToDay: "Move to another day",
    chatCopy: (name) =>
      new RegExp(`^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`),
    shown: (name) =>
      new RegExp(`^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`),
  },
  zh: {
    locale: "zh-CN",
    tripTab: /^行程/,
    mineTab: /^我的/,
    openTrip: "打开你的行程",
    chatTab: /^聊天/,
    moveToDay: "移至其他一天",
    chatCopy: (name) =>
      new RegExp(`^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`),
    shown: (name) => new RegExp(`^第 1 天：${escapeRe(name)} 需与上一项活动至少间隔 \\d+ 分钟。$`),
  },
};

// English travel-buffer text in any form the drawer could show it, in either language.
const ENGLISH_BUFFER = /needs at least \d+ minutes after the previous activity/;
const CHINESE_ENGLISH_TEXT = /needs at least|minutes after the previous activity|Day \d+:/;

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const summary = { started: STARTED, label: LABEL, baseUrl: BASE, runs: [], checks: [] };
let failures = 0;
const check = (ok, message) => {
  if (!ok) failures += 1;
  summary.checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
async function until(test, ms = 10_000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await test()) return true;
    await new Promise((done) => setTimeout(done, 200));
  }
  return test();
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

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

/** Gives the mock plan's day stops the names above, as a real plan from chat would have. */
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

const dayTab = (page, day) => page.locator(".day-strip [role=tab]").nth(day - 1);
const stopRows = (page) => page.locator(".timeline-day ol.timeline > li.timeline-stop");

/**
 * The stops of the chosen day in order: each stop's name, times and conflict lines, and the day title's own
 * conflict lines. The name is read without its screen-reader text, as the walkthrough reads it.
 */
const readDay = (page, rootSelector) =>
  page.evaluate((root) => {
    const scope = document.querySelector(root) ?? document;
    const stops = [...scope.querySelectorAll(".timeline-day ol.timeline > li.timeline-stop")].map(
      (li) => {
        const nameNode = li.querySelector(".timeline-stop__name");
        const name = [...(nameNode?.childNodes ?? [])]
          .filter((node) => !(node.nodeType === 1 && node.classList.contains("sr-only")))
          .map((node) => node.textContent)
          .join("")
          .trim();
        const times = li.querySelector(".timeline-stop__time")?.textContent.match(/\d{2}:\d{2}/g) ?? [];
        return {
          name,
          start: times[0] ?? null,
          end: times[1] ?? null,
          conflicts: [...li.querySelectorAll(".timeline-stop__conflicts li")].map((item) =>
            item.textContent.trim(),
          ),
        };
      },
    );
    const dayTitle = [...scope.querySelectorAll(".timeline-day__conflicts li")].map((item) =>
      item.textContent.trim(),
    );
    const lines = (scope.innerText ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return { stops, dayTitle, lines };
  }, rootSelector);

const rootOf = (page) => (page.__phone ? "#phone-panel-trip" : ".workspace-drawer--trip");

/** Changes a stop's time through its time button and waits for the server's answer. */
async function editTime(page, row, startMinutes, endMinutes) {
  await row.locator(".timeline-stop__time").click();
  const form = row.locator("form.stop-editor__time");
  await form.locator("input[type=time]").nth(0).fill(hhmm(startMinutes));
  await form.locator("input[type=time]").nth(1).fill(hhmm(endMinutes));
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => {
        if (!r.url().endsWith("/api/trip/preview-edit")) return false;
        try {
          return r.request().postDataJSON().operation.kind === "time";
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    ),
    form.locator("button[type=submit]").click(),
  ]);
  await settle(page, 800);
  return response;
}

/** Plans the simulated trip, moves two stops onto Day 1, and opens the drawer at this width and language. */
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
  const isFavicon = (url) => new URL(url).pathname === "/favicon.ico";
  page.on("console", (message) => {
    if (message.type() !== "error" || isFavicon(message.location().url)) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("requestfailed", (request) => {
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
  const trip = page.locator(phone ? "#phone-panel-trip" : ".workspace-drawer--trip");
  await trip.locator(".trip-editor").waitFor({ timeout: 30_000 });
  await until(async () => saves.size >= 4, 60_000);
  check(saves.size === 4, `${run}: every stop the map finds is saved (${saves.size} saves)`);

  // Two stops from Days 2 and 3 move onto Day 1, so Day 1 has three stops with a leg between each pair.
  for (const fromDay of [2, 3]) {
    await dayTab(page, fromDay).click();
    await settle(page, 300);
    const row = stopRows(page).first();
    await row.locator(".action-menu__trigger").click();
    await page.getByRole("menuitem", { name: L.moveToDay, exact: true }).click();
    await trip.locator(".stop-place-card select").selectOption("1");
    await settle(page, 900);
  }
  await dayTab(page, 1).click();
  await settle(page, 400);
  const ready = await until(async () => (await stopRows(page).count()) === 3, 30_000);
  check(ready, `${run}: Day 1 has three stops`);
  return { context, page, trip, errors, L, phone };
}

/**
 * Keeps the server's answer to a time edit as it is, or, for a legacy phase, takes away the stored key the answer
 * carries. The answer's conflictsWith and plan.conflicts (the English sentence the chat reads) are never changed.
 */
function answerEdits(page, state) {
  return page.route("**/api/trip/preview-edit", async (route) => {
    let operation;
    try {
      operation = route.request().postDataJSON().operation;
    } catch {}
    const response = await route.fetch();
    if (operation?.kind !== "time") return route.fulfill({ response });
    const body = await response.json();
    if (state.legacy && body.plan)
      body.plan.editIssues = (body.plan.editIssues ?? []).filter(
        (issue) => issue.code !== "route_unavailable",
      );
    // What the client is given: the English copy the chat reads, and the stored keys that remain.
    state.answer = {
      conflictsWith: body.plan?.sections.find((s) => s.id === "itinerary")?.proposal?.conflictsWith ?? [],
      conflicts: (body.plan?.conflicts ?? []).flatMap((conflict) =>
        conflict.reason.split("; ").map((part) => part.trim()),
      ),
      storedKeys: (body.plan?.editIssues ?? []).filter((issue) => issue.code === "route_unavailable")
        .length,
    };
    return route.fulfill({ response, json: body });
  });
}

/** One width and language: the phases, with their checks. */
async function walk(browser, { width, lang }) {
  const run = `${width}px ${lang}`;
  const tag = `${width}-${lang}`;
  const runSummary = { run, width, lang, phases: {} };
  summary.runs.push(runSummary);
  const { context, page, trip, errors, L, phone } = await plan(browser, { width, lang, run });
  const root = rootOf(page);
  const state = { legacy: false, answer: undefined };
  await answerEdits(page, state);

  // Both phases move the second stop of Day 1 to start inside the first stop's time, so the leg into it breaks
  // its travel buffer. The start differs between phases, so each edit is a real change.
  for (const [phase, offset, legacy] of [
    ["keyed", 30, false],
    ["legacy", 40, true],
  ]) {
    state.legacy = legacy;
    const before = await readDay(page, root);
    const first = before.stops[0];
    const second = before.stops[1];
    const duration = toMinutes(second.end) - toMinutes(second.start);
    const start = toMinutes(first.start) + offset;
    await editTime(page, stopRows(page).nth(1), start, start + duration);
    await until(
      async () => (await readDay(page, root)).stops[1].start === hhmm(start),
      15_000,
    );
    const day = await readDay(page, root);
    const name = second.name;
    const shown = L.shown(name);
    const stopsWithBuffer = day.stops
      .map((stop, index) => (stop.conflicts.some((text) => shown.test(text)) ? index : -1))
      .filter((index) => index >= 0);
    const dayTitleBuffer = day.dayTitle.filter(
      (text) => ENGLISH_BUFFER.test(text) || shown.test(text),
    );
    const phaseSummary = {
      phase,
      stopName: name,
      stopsWithBuffer,
      dayTitle: day.dayTitle,
      stopConflicts: day.stops.map((stop) => stop.conflicts),
      answer: state.answer,
    };
    runSummary.phases[phase] = phaseSummary;

    check(
      stopsWithBuffer.length === 1 && stopsWithBuffer[0] === 1,
      `${run} ${phase}: the travel-buffer notice is under its destination stop only (stops ${JSON.stringify(stopsWithBuffer)})`,
    );
    check(
      dayTitleBuffer.length === 0,
      `${run} ${phase}: no travel-buffer sentence is under the day title (${JSON.stringify(day.dayTitle)})`,
    );
    if (lang === "zh") {
      const english = day.lines.filter((line) => CHINESE_ENGLISH_TEXT.test(line));
      check(
        english.length === 0,
        `${run} ${phase}: the Chinese drawer shows no English travel-buffer text (${JSON.stringify(english)})`,
      );
    } else {
      const sentence = (state.answer?.conflictsWith ?? []).find((text) => L.chatCopy(name).test(text));
      check(
        Boolean(sentence) && day.stops[1].conflicts.includes(sentence),
        `${run} ${phase}: the English sentence keeps its wording under the stop (${day.stops[1].conflicts.join(" | ")})`,
      );
    }
    check(
      (state.answer?.conflictsWith ?? []).some((text) => L.chatCopy(name).test(text)),
      `${run} ${phase}: the chat's English copy of the notice is kept in the answer (conflictsWith)`,
    );
    check(
      (state.answer?.conflicts ?? []).some((reason) => L.chatCopy(name).test(reason)),
      `${run} ${phase}: the chat's English copy is kept in plan.conflicts`,
    );
    if (legacy)
      check(
        state.answer?.storedKeys === 0,
        `${run} ${phase}: the answer carries no stored key for the notice (the legacy shape)`,
      );
    else
      check(
        (state.answer?.storedKeys ?? 0) >= 1,
        `${run} ${phase}: the answer carries the stored key for the notice (control)`,
      );
    await page.screenshot({ path: `${OUT}/${tag}-${phase}.png` });
  }

  const unexpected = errors.filter((text) => !/favicon/.test(text));
  runSummary.consoleErrors = unexpected;
  check(
    !unexpected.length,
    `${run}: no console errors or failed requests${unexpected.length ? `: ${unexpected.join(" | ")}` : ""}`,
  );
  await context.close();
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) for (const lang of ["en", "zh"]) await walk(browser, { width, lang });
} finally {
  await browser.close();
  summary.failures = failures;
  summary.finished = new Date().toISOString();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
}
console.log(`\n${summary.checks.length} checks, ${failures} failed`);
console.log(`artifact: ${OUT}/summary.json`);
process.exitCode = failures ? 1 : 0;
