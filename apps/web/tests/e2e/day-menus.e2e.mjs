import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, sleep, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/day-menus",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const savedAt = "2026-10-27T00:00:00Z";
const BASE = process.env.BASE_URL ?? "http://localhost:3115";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let currentPage;

try {
  for (const viewport of [
    { width: 1440, height: 1500 },
    { width: 390, height: 844 },
    { width: 1440, height: 1500, oneDay: true },
  ]) {
    const phone = viewport.width <= 520;
    const tag = `${viewport.width}px${viewport.oneDay ? " one-day" : ""}`;
    const context = await browser.newContext({
      viewport,
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const dialogs = [];
    const editRequests = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.accept();
    });
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit"))
        editRequests.push(request.postDataJSON());
    });
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));

    const tripId = `menus-trip-${viewport.width}${viewport.oneDay ? "-one" : ""}`;
    const activity = (name, day, startTime, endTime) => ({
      id: `${name.toLowerCase()}-${viewport.width}`,
      kind: "activity",
      ...(day === undefined ? {} : { day, startTime, endTime }),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
    });
    const candidate = {
      id: "room-1",
      name: "Harbour Inn",
      area: "Circular Quay",
      pricePerNight: 100,
      rating: 8,
    };
    const plan = {
      tripId,
      brief: {
        tripId,
        userId: "local",
        destination: "Sydney",
        dates: ["2030-10-01", "2030-10-04"],
        groupSize: 2,
        budgetTotal: 2000,
      },
      round: 1,
      budgetTotal: 2000,
      estTotal: 300,
      overrunPct: -85,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 0,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items: [
              activity("Alder", 1, "09:00", "10:00"),
              activity("Birch", 1, "11:00", "12:00"),
              activity("Elm", 2, "11:00", "12:00"),
              activity("Gum", 3, "10:00", "11:00"),
              activity("Fir", undefined, undefined, undefined),
            ],
            assumptions: [],
            conflictsWith: [],
          },
        },
        {
          id: "accommodation",
          label: "Stay",
          status: "draft",
          summary: "Harbour Inn",
          estCost: 300,
          proposal: {
            agent: "accommodation",
            summary: "Harbour Inn",
            items: [
              {
                id: "stay-item",
                kind: "stay",
                day: 1,
                selectionId: "stay-1",
                detail:
                  "Harbour Inn — Circular Quay; 2030-10-01 to 2030-10-04; 1 room × 3 nights × A$100.00 per room/night = A$300.00; rating 4.0/5; cancellation terms unknown.",
                estCost: 300,
              },
            ],
            assumptions: [],
            conflictsWith: [],
            stays: [
              {
                id: "stay-1",
                city: "Sydney",
                checkIn: "2030-10-01",
                checkOut: "2030-10-04",
                day: 1,
                nights: 3,
                rooms: 1,
                selectedId: "room-1",
                candidates: [candidate],
              },
            ],
          },
        },
      ],
    };
    if (viewport.oneDay) {
      plan.brief.dates = ["2030-10-01", "2030-10-01"];
      plan.brief.noAccommodation = true;
      plan.sections = plan.sections.filter((part) => part.id === "itinerary");
      plan.sections[0].proposal.items = plan.sections[0].proposal.items.filter(
        (item) => item.day === 1 || item.day === undefined,
      );
    }
    const conversationId = `menus-conversation-${viewport.width}${viewport.oneDay ? "-one" : ""}`;
    const snapshot = {
      version: 4,
      id: conversationId,
      savedAt,
      plan,
      draft: {
        destination: "Sydney",
        origin: "",
        start: "2030-10-01",
        end: "2030-10-04",
        groupSize: "2",
        budgetTotal: "2000",
        preferences: [],
        nationality: "",
        roomAllocation: "shared",
        minRating: "0",
        freeCancellation: false,
      },
      messages: [],
      input: "",
    };
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney menus",
          updatedAt: savedAt,
          tripId,
          messages: [],
          input: "",
          snapshot,
        },
      ],
      trips: [
        {
          id: tripId,
          title: "Sydney menus",
          status: "draft",
          updatedAt: savedAt,
          conversationIds: [conversationId],
          snapshot,
        },
      ],
      layout: {
        sidebar: { collapsed: false },
        preferences: { width: 280 },
        trip: { width: 340 },
        view: "chat",
        editorView: "timeline",
      },
    };
    await page.addInitScript(
      ({ catalog, savedAt }) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        }
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language: sessionStorage.getItem("lang") ?? "en",
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt },
    );
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    if (phone) {
      await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await page.locator(".phone-mine .trip-card").filter({ hasText: "Sydney" }).first().click();
      const tripTab = page.getByRole("tab", { name: "Trip", exact: true });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^Trips/ }).click();
      await page.locator(".trips-page .trip-card").filter({ hasText: "Sydney" }).first().click();
      const toggle = page.getByRole("button", { name: "Open your trip", exact: true });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    }
    const timeline = page.getByRole("region", { name: "Trip timeline" });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${viewport.width}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, { errors: pageErrors });
      await context.close();
      continue;
    }

    const savedPlan = () =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        return stored?.trips?.find((trip) => trip.id === stored.activeTripId)?.snapshot?.plan;
      });
    const itemsOf = (p, id) => p?.sections?.find((s) => s.id === id)?.proposal?.items ?? [];
    const placement = (p) =>
      Object.fromEntries(
        itemsOf(p, "itinerary").map((item) => [item.location, item.day ?? "idea"]),
      );
    const stayOf = (p) => p?.sections?.find((s) => s.id === "accommodation")?.proposal?.stays?.[0];
    const dayTabs = () => page.locator(".day-strip__day");
    const selectedDay = () =>
      page.locator('.day-strip__day[aria-selected="true"]').getAttribute("data-day");
    const undoButton = () => page.locator(".item-undo").getByRole("button", { name: "Undo" });
    const menuOf = (name) => page.getByRole("button", { name, exact: true });
    const choose = async (menu, item) => {
      await menuOf(menu).first().click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    };
    const waitPlan = (test) =>
      waitUntil(async () => {
        const current = await savedPlan();
        return current ? test(current) : false;
      }, 10_000);
    const selectDay = async (day) => {
      await page.locator(`.day-strip__day[data-day="${day}"]`).click();
      await waitUntil(async () => (await selectedDay()) === String(day), 4000);
    };
    const normalised = (p) => JSON.stringify(p);

    const original = await savedPlan();
    if (viewport.oneDay) {
      await menuOf("Day 1 actions").click();
      check(
        await page.getByRole("menuitem", { name: "Remove day", exact: true }).isDisabled(),
        `Remove day is disabled on the only day at ${tag}`,
      );
      await page.keyboard.press("Escape");
      await choose("Day 1 actions", "Add day after");
      await waitPlan((p) => p.brief.dates[1] === "2030-10-02");
      const grown = await savedPlan();
      check(
        grown.brief.noAccommodation === true && (await dayTabs().count()) === 2,
        `a one-day trip can grow to two days at ${tag}`,
        grown.brief.dates,
      );
      check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
      await context.close();
      continue;
    }
    check(
      (await dayTabs().count()) === 4 && (await selectedDay()) === "1",
      `the fixture trip shows four days with Day 1 selected at ${tag}`,
    );

    await menuOf("Day 1 actions").click();
    const dayItems = await page.getByRole("menuitem").allTextContents();
    check(
      ["Add day before", "Add day after", "Clear day", "Remove day"].every((label) =>
        dayItems.includes(label),
      ),
      `the day menu lists Add day before, Add day after, Clear day and Remove day at ${tag}`,
      dayItems,
    );
    check(
      !dayItems.includes("Edit title") && !dayItems.includes("Add note"),
      `Edit title and Add note stay out until the plan can store them at ${tag}`,
      dayItems,
    );
    await page.keyboard.press("Escape");
    await menuOf("Itinerary actions").click();
    const bulkItems = await page.getByRole("menuitem").allTextContents();
    check(
      bulkItems.includes("Move all events to ideas") &&
        bulkItems.includes("Remove all scheduled events"),
      `the itinerary menu lists both bulk actions at ${tag}`,
      bulkItems,
    );
    await page.keyboard.press("Escape");
    await page.screenshot({ path: resolve(out, `menus-${viewport.width}.png`), fullPage: true });

    const undoRestores = async (label) => {
      await undoButton().click();
      const restored = await waitPlan((p) => normalised(p) === normalised(original));
      check(restored, `Undo after ${label} restores the exact saved plan at ${tag}`);
    };

    await choose("Day 1 actions", "Add day after");
    let ok = await waitPlan((p) => p.brief.dates[1] === "2030-10-05");
    let now = await savedPlan();
    check(
      ok &&
        now.brief.dates[0] === "2030-10-01" &&
        placement(now).Alder === 1 &&
        placement(now).Elm === 3 &&
        placement(now).Gum === 4 &&
        placement(now).Fir === "idea" &&
        (await dayTabs().count()) === 5,
      `Add day after Day 1 adds an empty Day 2 and pushes later stops one day on at ${tag}`,
      { dates: now.brief.dates, placement: placement(now) },
    );
    check(
      stayOf(now).checkOut === "2030-10-05" &&
        stayOf(now).nights === 4 &&
        itemsOf(now, "accommodation")[0].estCost === 400 &&
        now.editVersion === (original.editVersion ?? 0) + 1,
      `the stay gains a night, its cost follows and the edit is one revision at ${tag}`,
      { stay: stayOf(now), version: now.editVersion },
    );
    check(
      (await page.locator(".day-strip__day").nth(1).textContent()).includes("Free day"),
      `the new day reads as a free day at ${tag}`,
    );
    await undoRestores("Add day after");

    await choose("Day 1 actions", "Add day before");
    ok = await waitPlan((p) => p.brief.dates[0] === "2030-09-30");
    now = await savedPlan();
    check(
      ok &&
        now.brief.dates[1] === "2030-10-04" &&
        placement(now).Alder === 2 &&
        placement(now).Gum === 4 &&
        stayOf(now).checkIn === "2030-10-01" &&
        stayOf(now).day === 2 &&
        (await dayTabs().count()) === 5,
      `Add day before Day 1 starts the trip a day earlier and keeps booked dates at ${tag}`,
      { dates: now.brief.dates, placement: placement(now), stay: stayOf(now) },
    );
    await undoRestores("Add day before");

    await selectDay(2);
    await choose("Day 2 actions", "Add day before");
    ok = await waitPlan((p) => p.brief.dates[1] === "2030-10-05");
    now = await savedPlan();
    check(
      ok && placement(now).Alder === 1 && placement(now).Elm === 3 && stayOf(now).nights === 4,
      `Add day before Day 2 inserts an empty day between Day 1 and the rest at ${tag}`,
      placement(now),
    );
    await undoRestores("Add day before Day 2");

    await selectDay(1);
    await choose("Day 1 actions", "Clear day");
    ok = await waitPlan((p) => placement(p).Alder === undefined);
    now = await savedPlan();
    check(
      ok &&
        placement(now).Birch === undefined &&
        placement(now).Elm === 2 &&
        placement(now).Fir === "idea" &&
        stayOf(now).nights === 3 &&
        now.brief.dates.join() === original.brief.dates.join() &&
        (await dayTabs().count()) === 4,
      `Clear day removes only that day's stops at ${tag}`,
      placement(now),
    );
    await undoRestores("Clear day");

    await selectDay(4);
    await menuOf("Day 4 actions").click();
    check(
      await page.getByRole("menuitem", { name: "Clear day", exact: true }).isDisabled(),
      `Clear day is disabled on an empty day at ${tag}`,
    );
    await page.keyboard.press("Escape");

    await selectDay(2);
    await choose("Day 2 actions", "Remove day");
    ok = await waitPlan((p) => p.brief.dates[1] === "2030-10-03");
    now = await savedPlan();
    check(
      ok &&
        placement(now).Elm === undefined &&
        placement(now).Gum === 2 &&
        placement(now).Alder === 1 &&
        stayOf(now).checkOut === "2030-10-03" &&
        stayOf(now).nights === 2 &&
        itemsOf(now, "accommodation")[0].estCost === 200 &&
        (await dayTabs().count()) === 3,
      `Remove day drops the day, its stops and one night, and renumbers later days at ${tag}`,
      { dates: now.brief.dates, placement: placement(now), stay: stayOf(now) },
    );
    check(
      Number(await selectedDay()) <= 3,
      `the selected day stays inside the shorter trip at ${tag}`,
      await selectedDay(),
    );
    await undoRestores("Remove day");

    await selectDay(3);
    await choose("Itinerary actions", "Move all events to ideas");
    ok = await waitPlan((p) => Object.values(placement(p)).every((value) => value === "idea"));
    now = await savedPlan();
    const parked = itemsOf(now, "itinerary");
    check(
      ok &&
        parked.length === 5 &&
        parked.every((item) => item.startTime === undefined && item.endTime === undefined) &&
        now.brief.dates.join() === original.brief.dates.join() &&
        stayOf(now).nights === 3,
      `Move all events to ideas keeps every place as an Idea and leaves the stay at ${tag}`,
      placement(now),
    );
    await undoRestores("Move all events to ideas");

    await choose("Itinerary actions", "Remove all scheduled events");
    ok = await waitPlan((p) => itemsOf(p, "itinerary").length === 1);
    now = await savedPlan();
    check(
      ok &&
        placement(now).Fir === "idea" &&
        stayOf(now).nights === 3 &&
        itemsOf(now, "accommodation").length === 1,
      `Remove all scheduled events keeps Ideas and the stay at ${tag}`,
      placement(now),
    );
    check(dialogs.length === 0, `no action asked for confirmation at ${tag}`, dialogs);
    await undoRestores("Remove all scheduled events");

    for (const target of [4, 3]) {
      await selectDay(target);
      await choose(`Day ${target} actions`, "Remove day");
      await waitPlan((p) => p.brief.dates[1] === `2030-10-0${target - 1}`);
    }
    now = await savedPlan();
    check(
      now.brief.dates.join() === "2030-10-01,2030-10-02" &&
        stayOf(now).checkOut === "2030-10-02" &&
        stayOf(now).nights === 1,
      `removing the last days trims the stay with them at ${tag}`,
      { dates: now.brief.dates, stay: stayOf(now) },
    );
    await selectDay(2);
    await choose("Day 2 actions", "Remove day");
    await sleep(600);
    const refused = await savedPlan();
    check(
      refused.brief.dates.join() === "2030-10-01,2030-10-02" &&
        (await page.getByRole("alert").filter({ hasText: /night/i }).count()) > 0,
      `Remove day is refused with a notice when the stay would lose its last night at ${tag}`,
      refused.brief.dates,
    );
    await selectDay(1);
    await page.getByRole("button", { name: "Show Day 2 on the map", exact: true }).click();
    if (phone) {
      const mapShown = await waitUntil(
        async () => await page.locator(".workspace-panel--map").isVisible(),
        4000,
      );
      check(mapShown, `Day map brings the map forward on a phone at ${tag}`);
    } else {
      const focused = await waitUntil(
        async () => (await page.locator(".trip-workspace").getAttribute("data-day")) === "2",
        4000,
      );
      check(focused, `Day map focuses the map on that day at ${tag}`);
    }
    await page.screenshot({ path: resolve(out, `day-map-${viewport.width}.png`), fullPage: true });

    await choose("Day 1 actions", "Add day after");
    await waitPlan((p) => p.brief.dates[1] === "2030-10-05");
    const beforeReload = normalised(await savedPlan());
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    check(
      normalised(await savedPlan()) === beforeReload,
      `a day action survives a reload at ${tag}`,
    );

    await page.evaluate(() => sessionStorage.setItem("lang", "zh"));
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const zhEditor = page.locator("section.trip-editor");
    if (!(await zhEditor.count())) {
      if (phone) {
        await page.locator('[role="tab"]').nth(3).click();
        await page.locator(".phone-mine .trip-card").first().click();
        await page.locator('[role="tab"]').nth(2).click();
      } else {
        await page
          .locator("button.sidebar-nav__trips, [data-nav='trips']")
          .first()
          .click()
          .catch(() => undefined);
        await page
          .locator(".trips-page .trip-card")
          .first()
          .click()
          .catch(() => undefined);
        const toggle = page.locator("button[aria-controls][aria-expanded]").first();
        if (await toggle.count()) await toggle.click().catch(() => undefined);
      }
    }
    await zhEditor
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => undefined);
    const labels = await page
      .locator('section.trip-editor button[aria-haspopup="menu"]')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    check(
      labels.includes("第 1 天的操作") && labels.includes("行程操作"),
      `the day and itinerary menus carry Chinese accessible names at ${tag}`,
      labels,
    );
    if (labels.includes("第 1 天的操作")) {
      await page.getByRole("button", { name: "第 1 天的操作", exact: true }).click();
      const zhItems = await page.getByRole("menuitem").allTextContents();
      check(
        ["在前面加一天", "在后面加一天", "清空这一天", "删除这一天"].every((label) =>
          zhItems.includes(label),
        ),
        `the day menu items read in Chinese at ${tag}`,
        zhItems,
      );
      await page.keyboard.press("Escape");
      check(
        (await page.getByRole("button", { name: "在地图上查看第 2 天", exact: true }).count()) ===
          1,
        `the Day map button has a Chinese accessible name at ${tag}`,
      );
      await page.getByRole("button", { name: "行程操作", exact: true }).click();
      const zhBulk = await page.getByRole("menuitem").allTextContents();
      check(
        zhBulk.includes("全部活动移到想法") && zhBulk.includes("移除所有已安排的活动"),
        `the itinerary menu items read in Chinese at ${tag}`,
        zhBulk,
      );
      await page.keyboard.press("Escape");
    }
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "day menu workflow completed without an exception", String(error));
  if (currentPage)
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
