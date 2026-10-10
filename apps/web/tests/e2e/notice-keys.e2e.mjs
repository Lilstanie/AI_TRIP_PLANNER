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
      new RegExp(
        `^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`,
      ),
    shown: (name) =>
      new RegExp(
        `^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`,
      ),
  },
  zh: {
    locale: "zh-CN",
    tripTab: /^行程/,
    mineTab: /^我的/,
    openTrip: "打开你的行程",
    chatTab: /^聊天/,
    moveToDay: "移至其他一天",
    chatCopy: (name) =>
      new RegExp(
        `^Day 1: ${escapeRe(name)} needs at least \\d+ minutes after the previous activity\\.$`,
      ),
    shown: (name) => new RegExp(`^第 1 天：${escapeRe(name)} 需与上一项活动至少间隔 \\d+ 分钟。$`),
  },
};

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
        const times =
          li.querySelector(".timeline-stop__time")?.textContent.match(/\d{2}:\d{2}/g) ?? [];
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

    state.answer = {
      conflictsWith:
        body.plan?.sections.find((s) => s.id === "itinerary")?.proposal?.conflictsWith ?? [],
      conflicts: (body.plan?.conflicts ?? []).flatMap((conflict) =>
        conflict.reason.split("; ").map((part) => part.trim()),
      ),
      storedKeys: (body.plan?.editIssues ?? []).filter(
        (issue) => issue.code === "route_unavailable",
      ).length,
    };
    return route.fulfill({ response, json: body });
  });
}

async function walk(browser, { width, lang }) {
  const run = `${width}px ${lang}`;
  const tag = `${width}-${lang}`;
  const runSummary = { run, width, lang, phases: {} };
  summary.runs.push(runSummary);
  const { context, page, trip, errors, L, phone } = await plan(browser, { width, lang, run });
  const root = rootOf(page);
  const state = { legacy: false, answer: undefined };
  await answerEdits(page, state);

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
    await until(async () => (await readDay(page, root)).stops[1].start === hhmm(start), 15_000);
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
      const sentence = (state.answer?.conflictsWith ?? []).find((text) =>
        L.chatCopy(name).test(text),
      );
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
  for (const width of [1440, 390])
    for (const lang of ["en", "zh"]) await walk(browser, { width, lang });
} finally {
  await browser.close();
  summary.failures = failures;
  summary.finished = new Date().toISOString();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
}
console.log(`\n${summary.checks.length} checks, ${failures} failed`);
console.log(`artifact: ${OUT}/summary.json`);
process.exitCode = failures ? 1 : 0;
