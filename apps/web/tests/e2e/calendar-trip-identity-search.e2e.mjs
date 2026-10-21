import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/calendar-trip-identity-search", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = "2026-10-01T00:00:00Z";
const makeTrip = ({ id, destination, dates, title = `Trip to ${destination}`, message }) => {
  const conversationId = `conversation:${id}`;
  const tripId = `trip:${id}`;
  const brief = {
    tripId: id,
    userId: "local",
    destination,
    dates,
    groupSize: 2,
    budgetTotal: 4500,
  };
  const draft = {
    destination,
    origin: "",
    start: dates[0],
    end: dates[1],
    groupSize: "2",
    budgetTotal: "4500",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  };
  const plan = {
    tripId: id,
    brief,
    round: 1,
    budgetTotal: 4500,
    estTotal: 200,
    overrunPct: -95,
    sections: [],
  };
  const snapshot = {
    version: 3,
    id,
    savedAt,
    plan,
    draft,
    messages: message ? [{ role: "user", text: message }] : [],
    input: "",
  };
  return {
    trip: {
      id: tripId,
      title,
      status: "draft",
      updatedAt: savedAt,
      conversationIds: [conversationId],
      snapshot,
    },
    conversation: {
      id: conversationId,
      title,
      updatedAt: savedAt,
      tripId,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
  };
};
const duplicateA = makeTrip({
  id: "sydney-one",
  destination: "Sydney",
  dates: ["2026-11-11", "2026-11-14"],
});
const duplicateB = makeTrip({
  id: "sydney-two",
  destination: "Sydney",
  dates: ["2026-11-11", "2026-11-14"],
  message: "Second itinerary marker",
});
const selected = makeTrip({
  id: "selected-december",
  destination: "Wollongong",
  dates: ["2026-12-20", "2026-12-24"],
});
const hobart = makeTrip({
  id: "hobart-2027",
  destination: "Hobart",
  title: "2027 getaway",
  dates: ["2027-03-01", "2027-03-04"],
  message: "Plan a Hobart getaway",
});
const entries = [duplicateA, duplicateB, selected, hobart];
const catalog = {
  version: 4,
  activeTripId: selected.trip.id,
  activeConversationId: selected.conversation.id,
  trips: entries.map(({ trip }) => trip),
  conversations: entries.map(({ conversation }) => conversation),
  layout: {
    sidebar: { collapsed: false },
    preferences: { open: false, width: 280 },
    trip: { open: false, width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [] },
  language: "en",
  dataMode: "mock",
  appearance: "system",
  updatedAt: savedAt,
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

try {
  for (const width of [1440, 390, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 520 ? 1000 : 844 },
      isMobile: width <= 520,
      hasTouch: width <= 520,
      reducedMotion: "reduce",
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
    });
    await context.addInitScript(
      ({ catalog, settings }) => {
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      },
      { catalog, settings },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.clock.install({ time: new Date("2026-10-21T12:00:00Z") });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();

    if (width > 520) {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await page.getByRole("button", { name: /Trip to Wollongong/ }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".fact-chip")[1]?.getAttribute("data-empty") !== "true",
      );
      await page.locator(".fact-chips button").nth(1).click();
      const calendar = page.locator(".fact-popover .trip-calendar");
      await calendar.waitFor();
      const calendarText = await calendar.innerText();
      check(/December 2026/i.test(calendarText), "#480 saved start month is visible", {
        calendarText,
        dateChip: await page.locator(".fact-chips button").nth(1).innerText(),
      });
      check(
        (await calendar.locator('[aria-selected="true"]').count()) === 5,
        "#480 saved 20–24 December range is selected",
        await calendar.locator('[aria-selected="true"]').count(),
      );
      await page.getByRole("button", { name: "Close when", exact: true }).click();

      await page.getByRole("button", { name: /^Trips/ }).click();
      await page
        .getByRole("button", { name: /Trip to Sydney/ })
        .first()
        .click();
      await page.waitForFunction(
        () => document.querySelectorAll(".fact-chip")[1]?.getAttribute("data-empty") !== "true",
      );
      await page.locator(".fact-chips button").nth(1).click();
      const reopenedCalendar = page.locator(".fact-popover .trip-calendar");
      await reopenedCalendar.waitFor();
      check(
        /November 2026/i.test(await reopenedCalendar.innerText()) &&
          (await reopenedCalendar.locator('[aria-selected="true"]').count()) === 4,
        "#480 switching trips reopens on the new saved month and range",
        {
          calendarText: await reopenedCalendar.innerText(),
          selectedDates: await reopenedCalendar.locator('[aria-selected="true"]').count(),
        },
      );
      await page.locator(".when-fields__clear").click();
      check(
        (await page.locator(".when-fields__summary span").innerText()) ===
          "Choose your travel dates." &&
          (await reopenedCalendar.locator('[aria-selected="true"]').count()) === 0,
        "#480 clearing the editable range removes its dates and selection",
        {
          summary: await page.locator(".when-fields__summary span").innerText(),
          selectedDates: await reopenedCalendar.locator('[aria-selected="true"]').count(),
        },
      );
      await page.getByRole("button", { name: "Close when", exact: true }).click();

      await page.getByRole("button", { name: /^Trips/ }).click();
      await page.getByRole("button", { name: "New trip", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".fact-chip")[1]?.getAttribute("data-empty") === "true",
      );
      const whereClose = page.getByRole("button", { name: "Close where", exact: true });
      if ((await whereClose.count()) > 0) await whereClose.click();
      await page.locator(".fact-popover-scrim").waitFor({ state: "detached" });
      const undatedCalendar = page.locator(".fact-popover .trip-calendar");
      await page.locator(".fact-chips button").nth(1).click();
      await undatedCalendar.waitFor();
      const undatedCalendarText = await undatedCalendar.innerText();
      check(
        /October 2026/i.test(undatedCalendarText),
        "#480 undated trip opens on the current month pair",
        undatedCalendarText,
      );
      check(
        (await undatedCalendar.locator('[aria-selected="true"]').count()) === 0,
        "#480 undated trip has no selected calendar dates",
        await undatedCalendar.locator('[aria-selected="true"]').count(),
      );
      await page.getByRole("button", { name: "Close when", exact: true }).click();
    }

    if (width <= 520) {
      await page.locator(".phone-tabbar [role=tab]").nth(3).click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
    }
    await page.getByRole("tab", { name: "Calendar", exact: true }).click();
    const duplicateBars = page.locator(
      '.trip-calendar__trip[data-start="true"][aria-label*="Sydney"]',
    );
    await duplicateBars.first().waitFor();
    const duplicateNames = await duplicateBars.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    );
    const duplicateLabels = await duplicateBars.allInnerTexts();
    check(
      new Set(duplicateNames).size === 2,
      `#482 ${width}px accessible trip names differ`,
      duplicateNames,
    );
    check(
      duplicateLabels.length === 2 && duplicateLabels.every((label) => /[·•] ?[12]/.test(label)),
      `#482 ${width}px visible labels distinguish duplicate trips`,
      duplicateLabels,
    );
    if (width <= 520) {
      const renderedLabels = await duplicateBars.evaluateAll((nodes) =>
        nodes.map((node) => ({
          text: node.textContent?.trim(),
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          visible: node.getBoundingClientRect().width > 0,
        })),
      );
      check(
        renderedLabels.length === 2 &&
          renderedLabels.every(
            (label, index) =>
              label.text === `· ${index + 1}` &&
              label.visible &&
              label.clientWidth > 0 &&
              label.scrollWidth <= label.clientWidth,
          ),
        `#482 ${width}px compact duplicate identities are fully visible without clipping`,
        renderedLabels,
      );
    }
    await page.screenshot({ path: `${OUT}/calendar-${width}.png`, fullPage: true });

    if (width <= 520) {
      const search = page.getByRole("searchbox", { name: "Search chats and trips" });
      const tripStatus = page.getByRole("status", { name: "Trip search results" });
      const chatStatus = page.getByRole("status", { name: "Chat search results" });
      check(
        (await tripStatus.innerText()) === "" && (await chatStatus.innerText()) === "",
        "#484 empty search stays silent",
        { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
      );
      await search.fill("Hobart");
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[role="status"]')].filter((node) =>
            node.textContent?.trim(),
          ).length >= 2,
      );
      check(
        (await tripStatus.innerText()) === "1 trip found" &&
          (await chatStatus.innerText()) === "1 chat found",
        "#484 single-word search still finds one trip and chat",
        { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
      );
      for (const query of ["Hobart 2027", "2027 Hobart"]) {
        await search.fill(query);
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('[role="status"]')].filter((node) =>
              node.textContent?.trim(),
            ).length >= 2,
        );
        check(
          (await tripStatus.innerText()) === "1 trip found" &&
            (await chatStatus.innerText()) === "1 chat found",
          `#484 ${JSON.stringify(query)} finds one trip and chat`,
          { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
        );
      }
      await search.fill("2027 Plan");
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[role="status"]')].filter((node) =>
            node.textContent?.trim(),
          ).length >= 2,
      );
      check(
        (await tripStatus.innerText()) === "No matching trips." &&
          (await chatStatus.innerText()) === "1 chat found",
        "#484 AND terms match across a chat title and its messages",
        { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
      );
      await search.fill("Hobart 2028");
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[role="status"]')].filter((node) =>
            node.textContent?.trim(),
          ).length >= 2,
      );
      check(
        (await tripStatus.innerText()) === "No matching trips." &&
          (await chatStatus.innerText()) === "No matching chats.",
        "#484 every term remains required",
        { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
      );
      await page.getByRole("button", { name: "Clear search", exact: true }).click();
      check(
        (await tripStatus.innerText()) === "" && (await chatStatus.innerText()) === "",
        "#484 clearing search restores silent empty-query state",
        { trips: await tripStatus.innerText(), chats: await chatStatus.innerText() },
      );
      await page.screenshot({ path: `${OUT}/search-${width}.png`, fullPage: true });

      await page.getByRole("tab", { name: "Calendar", exact: true }).click();
      const secondDuplicateBar = page
        .locator('.trip-calendar__trip[data-start="true"][aria-label*="Sydney"]')
        .nth(1);
      await secondDuplicateBar.click();
      await page.getByText("Second itinerary marker", { exact: true }).waitFor();
      check(
        (await page.getByText("Second itinerary marker", { exact: true }).count()) === 1,
        "#482 compact duplicate trip bar opens its matching saved snapshot",
      );
    }
    check(errors.length === 0, `${width}px browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
