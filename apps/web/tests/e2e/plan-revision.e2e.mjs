import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  installSeededItinerary,
  seededDayItems,
  openMockWorkspace,
  planSuggestedTrip,
  placeFor,
  settle,
  sleep,
  waitUntil,
  waitForQuiet,
} from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LABEL = process.env.LABEL ?? "after";
const OUT = resolve(process.cwd(), "output/playwright/plan-revision", LABEL);
mkdirSync(OUT, { recursive: true });

const DAY_ONE = [
  { name: "Sydney Opera House", start: "09:00", end: "10:00" },
  { name: "Royal Botanic Garden Sydney", start: "11:30", end: "12:30" },
  { name: "Bondi Beach", start: "14:00", end: "15:00" },
  { name: "The Rocks", start: "16:30", end: "17:30" },
  { name: "Darling Harbour", start: "19:00", end: "20:00" },
];

const SAVED_DAY_ONE = [
  { name: "Circular Quay", start: "09:00", end: "10:00", saved: true },
  { name: "The Rocks", start: "11:30", end: "12:30", saved: true },
  { name: "Manly Beach", start: "14:00", end: "15:00", saved: true, arriveBy: false },
];
const DAY_TWO = [
  { name: "Paddington Markets", start: "09:00", end: "10:00" },
  { name: "Balmain Wharf", start: "11:30", end: "12:30" },
  { name: "Glebe Point", start: "14:00", end: "15:00" },
  { name: "Newtown", start: "16:30", end: "17:30" },
  { name: "Surry Hills", start: "19:00", end: "20:00" },
];
const PLANNER_WALK_MIN = 37;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

function newStub() {
  return {
    saves: [],
    rejected: [],
    verifies: [],
    timeVersions: [],

    inFlight: 0,
    maxInFlight: 0,

    version: undefined,

    verifyDelay: 0,
    holdVerify: undefined,
    holdTime: undefined,

    holdPlace: undefined,
  };
}

async function installStubs(page, stub) {
  await page.route("**/api/places/search", async (route) => {
    const { text } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ places: [placeFor(text)] }),
    });
  });
  await page.route("**/api/places/details", async (route) => {
    const { placeId } = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ place: { ...placeFor(placeId), id: placeId } }),
    });
  });
  await page.route("**/api/trip/preview-edit", async (route) => {
    const body = route.request().postDataJSON();
    const kind = body.operation.kind;
    if (kind === "verify") {
      stub.inFlight += 1;
      stub.maxInFlight = Math.max(stub.maxInFlight, stub.inFlight);
      try {
        if (stub.verifyDelay) await sleep(stub.verifyDelay);
        if (stub.holdVerify) await stub.holdVerify;
        const response = await route.fetch();
        const json = await response.json();
        stub.version = json.plan?.editVersion ?? stub.version;
        stub.verifies.push({ day: body.operation.day, doneAt: Date.now() });
        return route.fulfill({ response, json });
      } catch {
        return undefined;
      } finally {
        stub.inFlight -= 1;
      }
    }
    if (kind === "time") {
      try {
        if (stub.holdTime) await stub.holdTime;
        const response = await route.fetch();
        const json = await response.json();
        stub.version = json.plan?.editVersion ?? stub.version;
        stub.timeVersions.push(json.plan?.editVersion ?? null);
        return route.fulfill({ response, json });
      } catch {
        return undefined;
      }
    }
    if (kind !== "place") {
      try {
        return await route.continue();
      } catch {
        return undefined;
      }
    }

    const item = (body.plan.sections.find((s) => s.id === "itinerary")?.proposal?.items ?? []).find(
      (i) => i.id === body.operation.id,
    );
    const name = item?.location ?? item?.detail;
    stub.inFlight += 1;
    stub.maxInFlight = Math.max(stub.maxInFlight, stub.inFlight);
    try {
      if (stub.holdPlace && stub.holdPlace.stop === name) await stub.holdPlace.promise;
      await sleep(250);
      const plan = body.plan;
      stub.version ??= body.baseVersion;
      const current = stub.version;
      if (body.baseVersion !== current) {
        stub.rejected.push({ stop: name, baseVersion: body.baseVersion, current });
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "The trip changed while this was being checked." }),
        });
      }
      if (!item) return route.fulfill({ status: 400, contentType: "application/json", body: "{}" });
      stub.saves.push({ stop: name, baseVersion: body.baseVersion, doneAt: Date.now() });
      item.placeId = body.operation.placeId;
      item.priceNeedsReview = true;
      plan.editVersion = current + 1;
      stub.version = plan.editVersion;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plan, routes: [], blockerNotices: [], blockers: [] }),
      });
    } catch {
      return undefined;
    } finally {
      stub.inFlight -= 1;
    }
  });
}

async function installSeed(page, days) {
  await installSeededItinerary(page, seededDayItems(days, PLANNER_WALK_MIN));
}

async function openTrip(browser, { days, stub }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/status of 50[23]/.test(message.text())) return;
    if (message.location().url === `${BASE}/favicon.ico`) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await installStubs(page, stub);
  await installSeed(page, days);
  await openMockWorkspace(page, BASE);
  await planSuggestedTrip(page);
  return { context, page, errors };
}

const trip = (page) => page.getByRole("region", { name: "Trip timeline" });

async function stopRow(page, day, position) {
  await trip(page)
    .getByRole("tab")
    .nth(day - 1)
    .click();
  await settle(page, 400);
  return trip(page)
    .locator(".timeline-day .timeline-stop")
    .nth(position - 1);
}

async function changeTime(page, day, position, start, end) {
  const row = await stopRow(page, day, position);
  await row.locator(".timeline-stop__time").click();
  await trip(page)
    .getByLabel(/^Start/)
    .first()
    .fill(start);
  await trip(page).getByLabel(/^End/).first().fill(end);
  await trip(page).getByRole("button", { name: "Change time", exact: true }).click();
}

async function firstStopTime(page) {
  await trip(page).getByRole("tab").nth(0).click();
  await settle(page, 400);
  return (
    await trip(page)
      .locator(".timeline-day .timeline-stop")
      .nth(0)
      .locator(".timeline-stop__time")
      .innerText()
  ).replace(/\s+/g, " ");
}

async function main() {
  const summary = {};
  const browser = await chromium.launch();
  try {
    {
      const stub = newStub();
      let release = () => {};
      stub.holdVerify = new Promise((done) => (release = done));
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      check(
        await waitUntil(
          async () => (await page.getByText("Checking travel times…").count()) > 0,
          60_000,
        ),
        "1: a route check for day 1 is held open",
      );
      await changeTime(page, 1, 1, "09:15", "10:15");
      const during = await waitUntil(
        async () => (await firstStopTime(page)).includes("09:15"),
        10_000,
      );
      check(during, "1: the time edit is applied while the check is held open");
      release();
      await settle(page, 2000);
      await waitForQuiet(page, stub);
      const after = await firstStopTime(page);
      check(
        after.includes("09:15"),
        `1: after the check is released the edited time stays (${after})`,
      );
      check(
        !(await trip(page).locator(".timeline-status--error").count()),
        "1: the edit shows no error",
      );
      check(
        (await trip(page).locator(".timeline-connection__label").count()) === DAY_ONE.length - 1,
        "1: the day's legs are still shown after the edit",
      );
      summary.routeCheckHeld = { after, verifies: stub.verifies.length, saves: stub.saves.length };
      await page.screenshot({ path: `${OUT}/01-route-check-held.png` });
      check(
        !run.errors.length,
        `1: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    {
      const stub = newStub();
      let releaseSave = () => {};
      stub.holdPlace = {
        stop: "Royal Botanic Garden Sydney",
        promise: new Promise((done) => (releaseSave = done)),
      };
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      const { page } = run;
      check(
        await waitUntil(async () => (await page.getByText("Saving place…").count()) > 0, 60_000),
        "2: a place save is held open",
      );
      await changeTime(page, 1, 1, "09:15", "10:15");
      const applied = await waitUntil(
        async () => (await firstStopTime(page)).includes("09:15"),
        10_000,
      );
      check(applied, "2: the time edit is applied while the save is held open");
      releaseSave();
      await settle(page, 1000);
      await waitForQuiet(page, stub);
      const editVersion = stub.timeVersions.at(-1);
      const resaved = stub.saves.find(
        (save) => save.stop === "Royal Botanic Garden Sydney" && save.baseVersion === editVersion,
      );
      check(
        Boolean(resaved),
        `2: the held stop is saved again for the edited plan (version ${editVersion ?? "?"}; saves ${JSON.stringify(stub.saves.map((s) => [s.stop, s.baseVersion]))})`,
      );
      check(
        (await trip(page)
          .locator(".timeline-tag")
          .filter({ hasText: "Place confirmed" })
          .count()) === DAY_ONE.length,
        "2: every stop of day 1 has its place saved at the end",
      );
      check(
        (await firstStopTime(page)).includes("09:15"),
        "2: the edited time stays after the save is released",
      );
      summary.autoSaveHeld = {
        saves: stub.saves,
        rejected: stub.rejected,
        timeVersions: stub.timeVersions,
      };
      await page.screenshot({ path: `${OUT}/02-auto-save-held.png` });
      check(
        !run.errors.length,
        `2: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    {
      const stub = newStub();
      stub.verifyDelay = 2500;
      const run = await openTrip(browser, { days: { 1: SAVED_DAY_ONE, 2: DAY_TWO }, stub });
      const { page } = run;
      const dayTwoDone = await waitUntil(
        () => stub.verifies.some((verify) => verify.day === 2),
        60_000,
      );
      await waitForQuiet(page, stub);
      const lastDayTwoSave = Math.max(
        0,
        ...stub.saves
          .filter((save) => DAY_TWO.some((stop) => stop.name === save.stop))
          .map((s) => s.doneAt),
      );
      const dayTwoVerify = stub.verifies.find((verify) => verify.day === 2);
      check(
        stub.saves.filter((save) => DAY_TWO.some((stop) => stop.name === save.stop)).length ===
          DAY_TWO.length,
        `3: day 2's five stops are saved (${stub.saves.length} saves in all)`,
      );
      check(
        dayTwoDone && dayTwoVerify && dayTwoVerify.doneAt >= lastDayTwoSave,
        `3: day 2 is checked once its places are saved (verifies: ${JSON.stringify(stub.verifies.map((v) => v.day))})`,
      );
      check(
        stub.verifies.some((verify) => verify.day === 1),
        "3: day 1 is checked on load, because one of its legs has no stored time",
      );
      check(
        stub.maxInFlight <= 1,
        `3: at most one background request in flight at a time (saw ${stub.maxInFlight})`,
      );
      summary.dayChecked = {
        saves: stub.saves,
        verifies: stub.verifies,
        maxInFlight: stub.maxInFlight,
      };
      await page.screenshot({ path: `${OUT}/03-day-checked-after-saves.png` });
      check(
        !run.errors.length,
        `3: no console errors${run.errors.length ? `: ${run.errors.join(" | ")}` : ""}`,
      );
      await run.context.close();
    }

    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      await waitForQuiet(run.page, stub);
      const stale = await run.context.newPage();
      await installStubs(stale, stub);
      let staleTimeRequests = 0;
      await stale.route("**/api/trip/preview-edit", async (route) => {
        if (route.request().postDataJSON().operation.kind === "time") staleTimeRequests++;
        await route.abort();
      });
      await stale.goto(BASE);
      await stale
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await stale.locator(".trips-page .trip-card").first().click();
      await stale.getByRole("button", { name: "Open your trip" }).click();
      await trip(stale).waitFor();
      const oldTime = await firstStopTime(stale);
      await changeTime(run.page, 1, 1, "09:20", "10:20");
      await waitUntil(async () => (await firstStopTime(run.page)).includes("09:20"));
      const canonical = await run.page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("trip.revision:"))
          .map((k) => localStorage.getItem(k)),
      );
      await changeTime(stale, 1, 1, "09:40", "10:40");
      await settle(stale, 1200);
      check(staleTimeRequests === 0, "4: stale tab refuses the edit before sending it");
      check(
        (await firstStopTime(stale)) === oldTime,
        "4: refused stale edit leaves the old tab's plan unchanged",
      );
      const after = await stale.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("trip.revision:"))
          .map((k) => localStorage.getItem(k)),
      );
      check(
        JSON.stringify(canonical) === JSON.stringify(after),
        "4: stale tab cannot overwrite the published plan fingerprint",
      );
      summary.crossTab = {
        staleTimeRequests,
        unchanged: JSON.stringify(canonical) === JSON.stringify(after),
      };
      await stale.screenshot({ path: `${OUT}/04-stale-tab.png` });
      await run.context.close();
    }

    {
      const stub = newStub();
      const run = await openTrip(browser, { days: { 1: DAY_ONE }, stub });
      await waitForQuiet(run.page, stub);
      let release;
      stub.holdTime = new Promise((done) => {
        release = done;
      });
      await changeTime(run.page, 1, 1, "09:20", "10:20");
      const stale = await run.context.newPage();
      await stale.addInitScript(() => {
        const request = navigator.locks.request.bind(navigator.locks);
        window.lockAttempts = 0;
        navigator.locks.request = (...args) => {
          window.lockAttempts++;
          return request(...args);
        };
      });
      await installStubs(stale, stub);
      await stale.goto(BASE);
      await stale
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Trips/ })
        .click();
      await stale.locator(".trips-page .trip-card").first().click();
      await stale.getByRole("button", { name: "Open your trip" }).click();
      await trip(stale).waitFor();
      await waitUntil(async () => await stale.evaluate(() => window.lockAttempts > 0));
      release();
      await waitUntil(async () => (await firstStopTime(run.page)).includes("09:20"));
      await settle(stale, 800);
      const before = await stale.evaluate(() => window.lockAttempts);
      await settle(stale, 500);
      const after = await stale.evaluate(() => window.lockAttempts);
      check(after === before, `5: stale background work stops retrying (${before} → ${after})`);
      const notice = await stale
        .getByText("This edit is stale. Start from the current plan.", { exact: true })
        .count();
      check(notice > 0, "5: stale background check shows a current-plan notice");
      summary.staleBackground = { before, after, notice: notice > 0 };
      await stale.screenshot({ path: `${OUT}/05-stale-background.png` });
      await run.context.close();
    }
  } finally {
    await browser.close();
  }
  summary.failures = failures;
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${failures.length ? `${failures.length} check(s) failed` : "all checks passed"}`);
  console.log(`artifact: ${OUT}/summary.json`);
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
