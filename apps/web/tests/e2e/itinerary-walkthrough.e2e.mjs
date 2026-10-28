import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { sleep, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/itinerary-walkthrough",
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

const TEXT = {
  en: {
    region: "Trip timeline",
    undo: /^Undo( last change)?$/,
    stop: [
      "Adjust schedule",
      "Edit details",
      "Add a comment",
      "Move to ideas",
      "Move to previous day",
      "Move to next day",
      "Add again",
      "Remove",
    ],
    secondary: ["Replace place", "Open in Maps"],
    dayMenu: (n) => `Day ${n} actions`,
    dayItems: ["Add day before", "Add day after", "Clear day", "Remove day"],
    dayText: ["Edit title", "Add note"],
    titleField: "Day title",
    noteField: "Day note",
    itineraryMenu: "Itinerary actions",
    bulk: ["Move all events to ideas", "Remove all scheduled events"],
    dayMap: (n) => `Day map, Day ${n}`,
    addDay: (n) => `Add to Day ${n}`,
    ideasChip: (n) => `${n} ${n === 1 ? "idea" : "ideas"}`,
    panel: "Add to trip",
    tabs: { search: "Search", ideas: "Ideas", saved: "Saved", custom: "Custom" },
    close: "Close",
    keep: "Keep open",
    search: "Search places",
    name: "Name",
    note: "Note",
    panelStart: "Start time",
    add: "Add",
    pop: {
      schedule: "Adjust schedule",
      details: "Edit details",
      comment: "Add a comment",
      day: "Schedule on a day",
      start: "Start",
      change: "Change time",
      what: "What you will do",
      place: "Place name",
      save: "Save",
      commentField: "Comment",
      dayField: "Day",
      scheduleButton: "Schedule",
    },
    directions: /Directions/,
    metres: (n) => `${n} m`,
    kilometres: (n) => `${n} km`,
    mine: /^Mine$/,
    trips: /^Trips/,
    tripTab: /^Trip$/,
    open: "Open your trip",
  },
  zh: {
    region: "行程时间线",
    undo: /^(撤销|撤销上次修改)$/,
    stop: [
      "调整时间安排",
      "编辑详情",
      "添加评论",
      "移至备选地点",
      "移至前一天",
      "移至后一天",
      "再次添加",
      "移除",
    ],
    secondary: [],
    dayMenu: (n) => `第 ${n} 天的操作`,
    dayItems: ["在前面加一天", "在后面加一天", "清空这一天", "删除这一天"],
    dayText: ["编辑标题", "添加备注"],
    titleField: "日标题",
    noteField: "日备注",
    itineraryMenu: "行程操作",
    bulk: ["全部活动移至备选地点", "移除所有已安排的活动"],
    dayMap: (n) => `当天地图，第 ${n} 天`,
    addDay: (n) => `添加到第 ${n} 天`,
    ideasChip: (n) => `${n} 个备选地点`,
    panel: "添加到行程",
    tabs: { search: "搜索", ideas: "备选地点", saved: "已保存", custom: "自定义" },
    close: "关闭",
    keep: "保持打开",
    search: "搜索地点",
    name: "名称",
    note: "备注",
    panelStart: "开始时间",
    add: "添加",
    pop: {
      schedule: "调整时间安排",
      details: "编辑详情",
      comment: "添加评论",
      day: "安排到某一天",
      start: "开始",
      change: "修改时间",
      what: "活动内容",
      place: "地点名称",
      save: "保存",
      commentField: "评论",
      dayField: "天",
      scheduleButton: "安排日期",
    },
    directions: /路线/,
    metres: (n) => `${n} 米`,
    kilometres: (n) => `${n} 公里`,
    mine: /^我的$/,
    trips: /^行程/,
    tripTab: /^行程$/,
    open: "打开你的行程",
  },
};

const COORDS = {
  "e2e:alder": { latitude: -33.8568, longitude: 151.2153 },
  "e2e:birch": { latitude: -33.8519, longitude: 151.2108 },
  "e2e:cedar": { latitude: -33.8642, longitude: 151.2166 },
  "e2e:dogwood": { latitude: -33.87, longitude: 151.2 },
  "e2e:elm": { latitude: -33.88, longitude: 151.22 },
  "e2e:night": { latitude: -33.89, longitude: 151.23 },
  "e2e:fir": { latitude: -33.845, longitude: 151.21 },
};
const FALLBACK = { latitude: -33.86, longitude: 151.21 };
const metresBetween = (from, to) => {
  const radius = 6371000;
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const a = COORDS[from];
  const b = COORDS[to];
  const half =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(half)));
};

const typed = (name, primaryType, coordinates = true) => ({
  id: `stub:${name}`,
  displayName: { text: name },
  formattedAddress: `${name}, Sydney NSW, Australia`,
  ...(coordinates ? { location: FALLBACK } : {}),
  primaryType,
});

const core = (items) =>
  items
    .filter((item) => item.kind === "activity")
    .map(({ id, day, startTime, endTime, location, detail, note, placeId }) => ({
      id,
      day,
      startTime,
      endTime,
      location,
      detail,
      note,
      placeId,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

const RUNS = [
  { name: "desktop", width: 1440, height: 1500, language: "en" },
  { name: "phone", width: 390, height: 844, language: "en" },
  { name: "chinese", width: 1440, height: 1500, language: "zh" },
];

try {
  for (const run of RUNS) {
    const { width, height, language } = run;
    const T = TEXT[language];
    const phone = width <= 520;
    const tag = `${run.name} ${width}px ${language}`;
    const slug = `${run.name}`;
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
      locale: language === "zh" ? "zh-CN" : "en-AU",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const dialogs = [];
    const editRequests = [];
    let offline = false;
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error" && !/status of 40[34]|favicon/.test(message.text()))
        pageErrors.push(message.text());
    });
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
      return route.fulfill({
        json: {
          place: {
            id: placeId,
            displayName: {
              text: placeId
                .replace(/^(stub|e2e):/, "")
                .replace(/^./, (c) => (placeId.startsWith("e2e:") ? c.toUpperCase() : c)),
            },
            formattedAddress: "Sydney NSW, Australia",
            location: COORDS[placeId] ?? FALLBACK,
          },
        },
      });
    });
    await page.route("**/api/places/search", (route) => {
      const body = route.request().postDataJSON();
      if (offline) return route.abort();
      if (/nothing/i.test(body.text)) return route.fulfill({ json: { places: [] } });
      if (/^walk$/i.test(body.text.trim()))
        return route.fulfill({
          json: {
            places: [
              typed("Walk Cafe", "cafe"),
              typed("Walk Hotel", "hotel"),
              typed("Walk Museum", "museum"),
            ],
          },
        });
      return route.fulfill({ json: { places: [typed(body.text, "tourist_attraction")] } });
    });
    await page.route("**/api/trip/preview-edit", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (Array.isArray(json.routes))
        json.routes = json.routes.map((leg) =>
          COORDS[leg.from] && COORDS[leg.to] && leg.from !== leg.to
            ? { ...leg, distanceMeters: metresBetween(leg.from, leg.to) }
            : leg,
        );
      return route.fulfill({ response, json });
    });

    const tripId = `walk-trip-${slug}`;
    const otherId = `walk-other-${slug}`;
    const activity = (name, day, startTime, endTime, extra = {}) => ({
      id: `${name.toLowerCase()}-${slug}`,
      kind: "activity",
      ...(day === undefined ? {} : { day, startTime, endTime }),
      location: name,
      detail: name,
      placeId: `e2e:${name.toLowerCase()}`,
      ...extra,
    });
    const planOf = (id, items, destination) => ({
      tripId: id,
      brief: {
        tripId: id,
        userId: "local",
        destination,
        dates: ["2030-10-01", "2030-10-04"],
        groupSize: 2,
        budgetTotal: 2000,
      },
      round: 1,
      budgetTotal: 2000,
      estTotal: 200,
      overrunPct: -90,
      sections: [
        {
          id: "itinerary",
          label: "Day plan",
          status: "draft",
          summary: "Sydney visit",
          estCost: 200,
          proposal: {
            agent: "itinerary",
            summary: "Sydney visit",
            items,
            assumptions: [],
            conflictsWith: [],
          },
        },
      ],
    });
    const savedFixture = {
      name: "Saved Opera House",
      address: "Bennelong Point, Sydney",
      location: { latitude: -33.8568, longitude: 151.2153 },
    };
    const plan = planOf(
      tripId,
      [
        activity("Alder", 1, "09:00", "10:00"),
        activity("Birch", 1, "11:00", "12:00"),
        activity("Cedar", 1, "13:00", "14:00"),
        activity("Dogwood", 1, "15:00", "16:00"),
        activity("Elm", 2, "11:00", "12:00"),
        activity("Night", 4, "21:00", "22:30"),
        activity("Fir"),
      ],
      "Sydney",
    );
    const otherPlan = planOf(
      otherId,
      [
        {
          ...activity("Saved Opera House", 1, "09:00", "10:00"),
          placeId: "stub:Saved Opera House",
          savedPlace: savedFixture,
        },
      ],
      "Zzzland",
    );
    const snapshotOf = (conversationId, p) => ({
      version: 4,
      id: conversationId,
      savedAt,
      plan: p,
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
    });
    const conversationId = `walk-conversation-${slug}`;
    const otherConversationId = `walk-other-conversation-${slug}`;
    const snapshot = snapshotOf(conversationId, plan);
    const otherSnapshot = snapshotOf(otherConversationId, otherPlan);
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney walkthrough",
          updatedAt: savedAt,
          tripId,
          messages: [],
          input: "",
          snapshot,
        },
        {
          id: otherConversationId,
          title: "Sydney earlier",
          updatedAt: "2026-10-26T00:00:00Z",
          tripId: otherId,
          messages: [],
          input: "",
          snapshot: otherSnapshot,
        },
      ],
      trips: [
        {
          id: tripId,
          title: "Sydney walkthrough",
          status: "draft",
          updatedAt: savedAt,
          conversationIds: [conversationId],
          snapshot,
        },
        {
          id: otherId,
          title: "Sydney earlier",
          status: "draft",
          updatedAt: "2026-10-26T00:00:00Z",
          conversationIds: [otherConversationId],
          snapshot: otherSnapshot,
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
      ({ catalog, savedAt, language }) => {
        if (!sessionStorage.getItem("walkthrough-seeded")) {
          sessionStorage.setItem("walkthrough-seeded", "1");
          localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        }
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({
            version: 1,
            language,
            dataMode: "mock",
            travel: { homeCity: "", preferences: [] },
            appearance: "system",
            updatedAt: savedAt,
          }),
        );
      },
      { catalog, savedAt, language },
    );

    const openWorkspace = async () => {
      await page.goto(BASE);
      await page.locator(".workspace-app").waitFor();
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    };
    const openTrip = async (again = false) => {
      const pick = (cards) => (again ? cards.last() : cards.first());
      if (phone) {
        await page.getByRole("tab", { name: T.mine }).click();
        await pick(
          page.locator(".phone-mine .trip-card").filter({ hasNotText: "Zzzland" }),
        ).click();
        const tripTab = page.getByRole("tab", { name: T.tripTab });
        if (await tripTab.count()) await tripTab.click();
      } else {
        await page.getByRole("button", { name: T.trips }).click();
        await pick(
          page.locator(".trips-page .trip-card").filter({ hasNotText: "Zzzland" }),
        ).click();
        const toggle = page.getByRole("button", { name: T.open, exact: true });
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      }
    };
    await openWorkspace();
    await openTrip();
    const timeline = page.getByRole("region", { name: T.region });
    await timeline.waitFor({ timeout: 10_000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({ path: resolve(out, `setup-${run.name}.png`), fullPage: true });
      check(false, `saved Trip fixture opens at ${tag}`, {
        body: (await page.locator("body").innerText()).slice(0, 600),
        errors: pageErrors,
      });
      await context.close();
      continue;
    }
    const shot = (name) =>
      page.screenshot({ path: resolve(out, `${run.name}-${name}.png`), fullPage: true });

    const savedPlan = () =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        return stored?.trips?.find((trip) => trip.id === stored.activeTripId)?.snapshot?.plan;
      });
    const saved = async () =>
      (await savedPlan())?.sections?.find((part) => part.id === "itinerary")?.proposal?.items ?? [];
    const snap = async () =>
      JSON.stringify({ dates: (await savedPlan())?.brief?.dates, items: core(await saved()) });
    const stable = async () => {
      let last = await snap();
      for (let waited = 0; waited < 8000; waited += 700) {
        await sleep(700);
        const current = await snap();
        if (current === last) return current;
        last = current;
      }
      return last;
    };
    const itemOf = async (name) =>
      (await saved()).find((item) => item.kind === "activity" && item.location === name);
    const dayOf = async (name) => (await itemOf(name))?.day;
    const waitSaved = (test) =>
      waitUntil(async () => {
        const plan = await savedPlan();
        return plan ? test(plan, await saved()) : false;
      }, 10_000);
    const waitDay = (name, day) => waitUntil(async () => (await dayOf(name)) === day, 10_000);

    const strip = timeline.locator(".day-strip");
    const chip = (day) => strip.locator(`[data-day="${day}"]`);
    const dayPanel = timeline.locator(".timeline-day");
    const rows = dayPanel.locator(".timeline-stop");
    const ideasChip = timeline.locator("button.timeline-ideas-chip");
    const ideaNames = async () =>
      (await saved())
        .filter((item) => item.kind === "activity" && item.day === undefined)
        .map((item) => item.location)
        .sort();
    const line = timeline.locator(".timeline-drop-line");
    const rowIn = (scope, name) =>
      scope.filter({ has: page.locator(".timeline-stop__name", { hasText: name }) }).first();
    const row = (name) => rowIn(rows, name);
    const names = async (scope) =>
      (await scope.locator(".timeline-stop__name").allTextContents()).map((text) =>
        text.replace(/^(Stop|停靠点) \d+[:：]\s*/, "").trim(),
      );
    const shownNames = () => names(rows);
    const shownNumbers = async () =>
      (await rows.locator(".timeline-stop__node").allTextContents()).map((text) => text.trim());
    const expectNames = (expected) =>
      waitUntil(async () => (await shownNames()).join() === expected.join(), 6000);
    const selectedDay = () =>
      page.locator('.day-strip__day[aria-selected="true"]').getAttribute("data-day");
    const showDay = async (day) => {
      if ((await selectedDay()) !== String(day)) await chip(day).click();
      await waitUntil(async () => (await selectedDay()) === String(day), 4000);
    };
    const undoButton = page.getByRole("button", { name: T.undo });
    const undone = async (label, before) => {
      await undoButton.first().click();
      const restored = await waitUntil(async () => (await snap()) === before, 10_000);
      if (!restored)
        writeFileSync(
          resolve(out, `undo-diff-${run.name}-${label.replaceAll(" ", "-")}.json`),
          JSON.stringify({ before: JSON.parse(before), saved: JSON.parse(await snap()) }, null, 2),
        );
      check(restored, `Undo restores the saved plan after ${label} at ${tag}`);
      return restored;
    };
    const requests = (kind) => editRequests.filter((request) => request.operation.kind === kind);
    const noPrompt = async () =>
      (await page.getByRole("dialog", { name: /Discard|放弃/ }).count()) === 0 &&
      (await page.getByLabel(/Unfinished trip edits|未完成的行程编辑/).count()) === 0;

    const cdp = phone ? await context.newCDPSession(page) : undefined;
    const touchSend = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    let pos = { x: 0, y: 0 };
    const frame = async (...targets) => {
      for (const target of targets) await target.scrollIntoViewIfNeeded();
      const boxes = [];
      for (const target of targets) boxes.push(await target.boundingBox());
      const top = Math.min(...boxes.map((box) => box.y));
      const bottom = Math.max(...boxes.map((box) => box.y + box.height));
      const shift = (top + bottom) / 2 - height / 2;
      if (Math.abs(shift) > 1)
        await targets[0].evaluate((el, delta) => {
          for (let n = el.parentElement; n; n = n.parentElement) {
            const o = getComputedStyle(n).overflowY;
            if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) {
              n.scrollTop += delta;
              return;
            }
          }
          document.scrollingElement.scrollTop += delta;
        }, shift);
    };
    const begin = async (scope, name) => {
      await scope.locator(".timeline-stop__name").first().waitFor();
      const handle = rowIn(scope, name).locator(".timeline-stop__name").first();
      await handle.scrollIntoViewIfNeeded();
      const box = await handle.boundingBox();
      pos = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (phone) {
        await touchSend("touchStart", pos.x, pos.y);
        await sleep(700);
      } else {
        await page.mouse.move(pos.x, pos.y);
        await page.mouse.down();
        await page.mouse.move(pos.x, pos.y + 12);
        pos.y += 12;
      }
    };
    const go = async (x, y) => {
      const from = pos;
      for (let step = 1; step <= 8; step += 1) {
        const px = from.x + ((x - from.x) * step) / 8;
        const py = from.y + ((y - from.y) * step) / 8;
        if (phone) await touchSend("touchMove", px, py);
        else await page.mouse.move(px, py);
      }
      pos = { x, y };
    };
    const centre = async (locator, scroll = false) => {
      if (scroll) await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
    };
    const release = async () => {
      if (phone) await touchSend("touchEnd", 0, 0);
      else await page.mouse.up();
      await sleep(300);
    };

    const rowMenu = async (name, item, scope = rows) => {
      await rowIn(scope, name).locator(".action-menu__trigger").click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    };
    const menuEntries = async (name, scope = rows) => {
      await rowIn(scope, name).locator(".action-menu__trigger").click();
      const entries = await page.getByRole("menuitem").evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: node.textContent.trim(),
          disabled: node.disabled || node.getAttribute("aria-disabled") === "true",
        })),
      );
      await page.keyboard.press("Escape");
      return entries;
    };
    const popover = (dialogName) => timeline.getByRole("dialog", { name: dialogName, exact: true });
    const unnamed = (scope) =>
      scope.locator("input, textarea, select, button").evaluateAll((nodes) =>
        nodes
          .filter((node) => {
            const labelled = [...(node.labels ?? [])].map((l) => l.textContent.trim()).join("");
            return !(
              node.getAttribute("aria-label") ||
              node.getAttribute("aria-labelledby") ||
              labelled ||
              node.textContent.trim()
            );
          })
          .map((node) => node.outerHTML.slice(0, 80)),
      );
    const viaMenu = async (name, item, dialogName, scope = rows) => {
      await rowMenu(name, item, scope);
      await popover(dialogName).waitFor({ timeout: 5000 });
      return popover(dialogName);
    };
    const field = (pop, label) =>
      label === T.pop.start
        ? pop.getByLabel(label, { exact: true })
        : pop.getByRole(label === T.pop.dayField ? "combobox" : "textbox", {
            name: label,
            exact: true,
          });
    const onRow = async (pop, scope, name) => {
      const box = await pop.boundingBox();
      const rowBox = await rowIn(scope, name).boundingBox();
      return (
        !!box &&
        !!rowBox &&
        box.x >= -1 &&
        box.x + box.width <= width + 1 &&
        (await rowIn(scope, name).locator(".stop-popover").count()) === 1 &&
        (await page
          .locator(".fact-popover-scrim, .fact-popover--modal, .drawer--sheet")
          .count()) === 0
      );
    };

    const dayMenuButton = (day) =>
      page.getByRole("button", { name: T.dayMenu(day), exact: true }).first();
    const itineraryMenuButton = () =>
      page.getByRole("button", { name: T.itineraryMenu, exact: true }).first();
    const chooseDay = async (day, item) => {
      await showDay(day);
      await dayMenuButton(day).click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    };
    const chooseItinerary = async (item) => {
      await itineraryMenuButton().click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    };
    const dayTabs = () => page.locator(".day-strip__day");

    const panel = page.getByRole("region", { name: T.panel });
    const panelTab = (name) => panel.getByRole("tab", { name, exact: true });
    const openFromDay = async (day) => {
      await showDay(day);
      await timeline.getByRole("button", { name: T.addDay(day), exact: true }).click();
      await panel.waitFor();
    };
    const openFromIdeas = async () => {
      await ideasChip.click();
      await panel.waitFor();
    };
    const searchFor = async (text) => {
      const box = panel.getByRole("searchbox", { name: T.search });
      await box.fill(text);
      await box.press("Enter");
    };
    const pickResult = async (text) => {
      await searchFor(text);
      await panel
        .getByRole("button", { name: new RegExp(text) })
        .first()
        .click();
    };

    const legs = () => timeline.locator(".timeline-connection");
    const distanceTexts = async () =>
      (await timeline.locator(".timeline-connection__distance").allInnerTexts()).map((text) =>
        text.replace(/^·\s*/, "").trim(),
      );
    const directionLinks = () =>
      timeline.locator(".timeline-connection").getByRole("link", { name: T.directions });
    const hrefs = () => directionLinks().evaluateAll((nodes) => nodes.map((node) => node.href));
    const distanceLabel = (from, to) => {
      const meters = metresBetween(from, to);
      return meters < 1000
        ? T.metres(meters)
        : T.kilometres(meters < 10_000 ? (meters / 1000).toFixed(1) : Math.round(meters / 1000));
    };
    const coordinate = (placeId) => `${COORDS[placeId].latitude},${COORDS[placeId].longitude}`;
    const idOf = (name) => `e2e:${name.toLowerCase()}`;
    const legsMatch = async (order) => {
      const expected = order
        .slice(1)
        .map((name, index) => distanceLabel(idOf(order[index]), idOf(name)));
      const settled = await waitUntil(
        async () => (await distanceTexts()).join("|") === expected.join("|"),
        8000,
      );
      const links = await hrefs();
      const linksMatch =
        links.length === expected.length &&
        links.every((href, index) => {
          const params = new URL(href).searchParams;
          return (
            params.get("origin") === coordinate(idOf(order[index])) &&
            params.get("destination") === coordinate(idOf(order[index + 1]))
          );
        });
      return { settled, linksMatch, shown: await distanceTexts(), links };
    };

    await showDay(1);
    const original = await snap();
    const chipBox = await ideasChip.boundingBox();
    const stripBox = await strip.boundingBox();
    check(!!chipBox && chipBox.y < stripBox.y, `the ideas chip sits above Day 1 at ${tag}`, {
      chip: chipBox?.y,
      strip: stripBox.y,
    });
    check(
      (await timeline.getByRole("heading", { name: /^(Ideas|备选地点)$/ }).count()) === 0 &&
        (await timeline.getByRole("switch").count()) === 0,
      `no Ideas section and no Show distances switch render at ${tag}`,
    );
    check(
      (await ideasChip.innerText()) === T.ideasChip(1) &&
        (await shownNames()).join() === "Alder,Birch,Cedar,Dogwood" &&
        (await dayTabs().count()) === 4,
      `the fixture has one idea and four stops on Day 1 of four days at ${tag}`,
      { chip: await ideasChip.innerText(), day: await shownNames() },
    );
    await shot("start");

    const initialLegs = await legsMatch(["Alder", "Birch", "Cedar", "Dogwood"]);
    check(
      initialLegs.settled && initialLegs.linksMatch,
      `each Leg of Day 1 shows its distance and a Directions link between its two stops at ${tag}`,
      initialLegs,
    );
    let before = await stable();
    let editsBefore = requests("move").length;
    await frame(row("Alder"), row("Cedar"));
    await begin(rows, "Alder");
    const cedarBox = await centre(row("Cedar"));
    await go(cedarBox.x, cedarBox.box.y + cedarBox.box.height * 0.75);
    check(
      (await line.count()) === 1,
      `one insertion line shows while dragging a stop within its day at ${tag}`,
      await line.count(),
    );
    await shot("drag-in-day");
    await release();
    check(
      await expectNames(["Birch", "Cedar", "Alder", "Dogwood"]),
      `a drop after Cedar reorders the day at ${tag}`,
      await shownNames(),
    );
    check(
      (await shownNumbers()).join() === "1,2,3,4" &&
        (await line.count()) === 0 &&
        requests("move").length === editsBefore + 1,
      `the drop is one move edit, the numbers refresh and the line clears at ${tag}`,
      { numbers: await shownNumbers(), edits: requests("move").length - editsBefore },
    );
    check(
      (await dayOf("Alder")) === 1 && !!(await itemOf("Alder")).startTime,
      `the dropped stop keeps a time on its day at ${tag}`,
    );
    const afterDrag = await legsMatch(["Birch", "Cedar", "Alder", "Dogwood"]);
    check(
      afterDrag.settled && afterDrag.linksMatch,
      `the Legs and Directions links follow the new neighbours after the drop at ${tag}`,
      afterDrag,
    );
    await undone("a drag within a day", before);
    check(
      await expectNames(["Alder", "Birch", "Cedar", "Dogwood"]),
      `the list returns to its first order after Undo at ${tag}`,
    );

    before = await stable();
    editsBefore = requests("move").length;
    await row("Cedar").locator(".timeline-stop__main").focus();
    await page.keyboard.press("Alt+ArrowUp");
    check(
      await expectNames(["Alder", "Cedar", "Birch", "Dogwood"]),
      `Alt+ArrowUp moves the focused stop up one place at ${tag}`,
      await shownNames(),
    );
    await undone("a keyboard move", before);

    before = await stable();
    await begin(rows, "Dogwood");
    const target = await centre(chip(2), true);
    await go(target.x, target.y);
    check(
      (await chip(2).getAttribute("data-drop-target")) === "true",
      `a day chip is marked as the target while dragging a stop at ${tag}`,
    );
    await sleep(1100);
    check(
      (await chip(2).getAttribute("aria-selected")) === "true",
      `holding a dragged stop over a day opens that day at ${tag}`,
    );
    const elm = await centre(row("Elm"));
    await go(elm.x, elm.box.y + elm.box.height * 0.25);
    check((await line.count()) === 1, `the insertion line shows in the opened day at ${tag}`);
    await shot("drag-across-days");
    await release();
    check(await waitDay("Dogwood", 2), `a drop inside another day moves the stop there at ${tag}`);
    const placed = requests("move").at(-1)?.operation;
    check(
      placed?.day === 2 && placed?.index === 0,
      `the cross-day drop is one move edit at the chosen position at ${tag}`,
      placed,
    );
    check(
      (await expectNames(["Dogwood", "Elm"])) && (await shownNumbers()).join() === "4,5",
      `the opened day shows the new order and trip-wide numbers at ${tag}`,
      { names: await shownNames(), numbers: await shownNumbers() },
    );
    await undone("a drop on another day", before);
    await showDay(1);

    before = await stable();
    await begin(rows, "Alder");
    const emptyChip = await centre(chip(3), true);
    await go(emptyChip.x, emptyChip.y);
    await release();
    check(await waitDay("Alder", 3), `a drop on an empty day chip moves the stop there at ${tag}`);
    await undone("a drop on an empty day", before);
    await showDay(1);

    before = await stable();
    await begin(rows, "Birch");
    const zone = await centre(ideasChip, true);
    await go(zone.x, zone.y);
    check(
      (await ideasChip.getAttribute("data-drop-target")) === "true",
      `the ideas chip is marked as the target while dragging a stop at ${tag}`,
    );
    await shot("drag-to-ideas");
    await release();
    check(
      await waitUntil(async () => (await dayOf("Birch")) === undefined, 10_000),
      `a drop on Ideas unschedules the stop at ${tag}`,
    );
    const parked = await itemOf("Birch");
    check(
      requests("idea").at(-1)?.operation.id === parked.id && !parked.startTime && !parked.endTime,
      `the drop on Ideas is one idea edit that clears the times at ${tag}`,
    );
    check(
      (await waitUntil(async () => (await ideasChip.innerText()) === T.ideasChip(2), 5000)) &&
        (await shownNames()).join() === "Alder,Cedar,Dogwood" &&
        (await shownNumbers()).join() === "1,2,3",
      `the chip counts the stop and Day 1 renumbers at ${tag}`,
    );
    await undone("a drop on Ideas", before);
    check(
      (await ideasChip.innerText()) === T.ideasChip(1) && (await shownNames()).length === 4,
      `Undo returns the stop to its day at ${tag}`,
    );

    await showDay(1);
    check(await noPrompt(), `no drag asked to keep or discard anything at ${tag}`);

    const baseline = await stable();
    const stopEntries = await menuEntries("Alder");
    const stopNames = stopEntries.map((entry) => entry.name);
    const order = T.stop.map((label) => stopNames.indexOf(label));
    check(
      order.every((p, index) => p >= 0 && (index === 0 || p > order[index - 1])),
      `the Stop menu lists the eight actions in order at ${tag}`,
      stopNames,
    );
    check(
      T.secondary.every((label) => stopNames.includes(label)),
      `the secondary Stop menu items stay at ${tag}`,
      stopNames,
    );
    check(
      stopEntries.find((entry) => entry.name === T.stop[4])?.disabled === true &&
        stopEntries.find((entry) => entry.name === T.stop[5])?.disabled === false &&
        stopEntries.every((entry) => entry.name.length > 0),
      `Move to previous day is disabled on Day 1 and every item is named at ${tag}`,
    );
    await showDay(4);
    const lastEntries = await menuEntries("Night");
    check(
      lastEntries.find((entry) => entry.name === T.stop[5])?.disabled === true &&
        lastEntries.find((entry) => entry.name === T.stop[4])?.disabled === false,
      `Move to next day is disabled on the last day at ${tag}`,
    );
    await showDay(1);
    await shot("stop-menu");
    await rowIn(rows, "Alder").locator(".action-menu__trigger").click();
    await shot("stop-menu-open");
    await page.keyboard.press("Escape");

    before = await stable();
    let pop = await viaMenu("Alder", T.stop[0], T.pop.schedule);
    check(
      (await onRow(pop, rows, "Alder")) && (await unnamed(pop)).length === 0,
      `Adjust schedule opens a named popover on the row at ${tag}`,
    );
    await shot("adjust-schedule");
    await field(pop, T.pop.start).fill("08:30");
    await pop.getByRole("button", { name: T.pop.change, exact: true }).click();
    await waitSaved(
      (_, items) => items.find((item) => item.location === "Alder")?.startTime === "08:30",
    );
    check(
      (await popover(T.pop.schedule).count()) === 0 && (await undoButton.count()) > 0,
      `Adjust schedule takes effect at once with an Undo at ${tag}`,
    );
    await undone("Adjust schedule", before);

    await row("Alder").locator(".timeline-stop__time").click();
    await popover(T.pop.schedule).waitFor({ timeout: 5000 });
    check(
      await onRow(popover(T.pop.schedule), rows, "Alder"),
      `tapping the time opens the same popover on the row at ${tag}`,
    );
    await page.keyboard.press("Escape");
    check(
      (await popover(T.pop.schedule).count()) === 0 && (await snap()) === before,
      `Escape closes the time popover and saves nothing at ${tag}`,
    );

    pop = await viaMenu("Alder", T.stop[1], T.pop.details);
    check(
      (await onRow(pop, rows, "Alder")) && (await unnamed(pop)).length === 0,
      `Edit details opens a named popover on the row at ${tag}`,
    );
    await field(pop, T.pop.what).fill("Guided tour");
    await field(pop, T.pop.place).fill("Alder");
    await pop.getByRole("button", { name: T.pop.save, exact: true }).click();
    await waitSaved((_, items) => items.some((item) => item.detail === "Guided tour"));
    await undone("Edit details", before);

    pop = await viaMenu("Alder", T.stop[2], T.pop.comment);
    check(
      (await onRow(pop, rows, "Alder")) && (await unnamed(pop)).length === 0,
      `Add a comment opens a named popover on the row at ${tag}`,
    );
    await field(pop, T.pop.commentField).fill("Bring a hat");
    await pop.getByRole("button", { name: T.pop.save, exact: true }).click();
    await waitSaved((_, items) => items.some((item) => item.note === "Bring a hat"));
    await undone("Add a comment", before);

    await rowMenu("Birch", T.stop[3]);
    await waitSaved(
      (_, items) => items.find((item) => item.location === "Birch")?.day === undefined,
    );
    check(
      (await ideaNames()).includes("Birch") && (await ideasChip.innerText()) === T.ideasChip(2),
      `Move to ideas parks the stop and the chip counts it at once at ${tag}`,
    );
    await undone("Move to ideas", before);

    await rowMenu("Birch", T.stop[5]);
    await waitSaved((_, items) => items.find((item) => item.location === "Birch")?.day === 2);
    check(
      (await row("Birch").count()) === 0,
      `Move to next day takes the stop off this day at once at ${tag}`,
    );
    await undone("Move to next day", before);

    await showDay(2);
    await rowMenu("Elm", T.stop[4]);
    await waitSaved((_, items) => items.find((item) => item.location === "Elm")?.day === 1);
    await undone("Move to previous day", before);

    await showDay(1);
    await rowMenu("Alder", T.stop[6]);
    await waitSaved((_, items) => items.filter((item) => item.location === "Alder").length === 2);
    check(
      (await rows.filter({ hasText: "Alder" }).count()) === 2,
      `Add again puts the place on the day a second time at ${tag}`,
    );
    await undone("Add again", before);

    await rowMenu("Birch", T.stop[7]);
    await waitSaved((_, items) => !items.some((item) => item.location === "Birch"));
    check((await row("Birch").count()) === 0, `Remove takes effect at once at ${tag}`);
    await undone("Remove", before);

    await row("Alder").locator(".timeline-stop__main").click();
    check(
      (await row("Alder").locator(".stop-place-card").count()) === 1 &&
        (await popover(T.pop.schedule).count()) === 0,
      `tapping a stop row opens its place details at ${tag}`,
    );
    await row("Alder").locator(".timeline-stop__main").click();
    check(
      (await snap()) === baseline && (await noPrompt()),
      `every Stop and Idea menu action was undone and nothing asked to discard at ${tag}`,
    );

    await dayMenuButton(1).click();
    const dayItems = await page.getByRole("menuitem").allTextContents();
    check(
      [...T.dayText, ...T.dayItems].every((label) => dayItems.includes(label)),
      `the Day menu lists Edit title, Add note, Add day before, Add day after, Clear day and Remove day at ${tag}`,
      dayItems,
    );
    await shot("day-menu");
    await page.keyboard.press("Escape");
    await itineraryMenuButton().click();
    const bulkItems = await page.getByRole("menuitem").allTextContents();
    check(
      T.bulk.every((label) => bulkItems.includes(label)),
      `the Itinerary menu lists both bulk actions at ${tag}`,
      bulkItems,
    );
    await page.keyboard.press("Escape");

    before = await stable();
    await chooseDay(1, T.dayItems[1]);
    await waitSaved((plan) => plan.brief.dates[1] === "2030-10-05");
    let items = await saved();
    check(
      (await dayOf("Elm")) === 3 && (await dayOf("Night")) === 5 && (await dayTabs().count()) === 5,
      `Add day after Day 1 adds an empty Day 2 and pushes later stops on at ${tag}`,
      items.map((item) => [item.location, item.day]),
    );
    await undone("Add day after", before);

    await chooseDay(1, T.dayItems[0]);
    await waitSaved((plan) => plan.brief.dates[0] === "2030-09-30");
    check(
      (await dayOf("Alder")) === 2 && (await dayTabs().count()) === 5,
      `Add day before Day 1 starts the trip a day earlier at ${tag}`,
    );
    await undone("Add day before", before);

    await showDay(1);
    await chooseDay(1, T.dayItems[2]);
    await waitSaved((_, list) => !list.some((item) => item.location === "Alder"));
    check(
      (await dayOf("Elm")) === 2 && (await dayTabs().count()) === 4,
      `Clear day removes only that day's stops at ${tag}`,
    );
    await undone("Clear day", before);

    await showDay(3);
    await dayMenuButton(3).click();
    check(
      await page.getByRole("menuitem", { name: T.dayItems[2], exact: true }).isDisabled(),
      `Clear day is disabled on an empty day at ${tag}`,
    );
    await page.keyboard.press("Escape");

    await chooseDay(2, T.dayItems[3]);
    await waitSaved((plan) => plan.brief.dates[1] === "2030-10-03");
    check(
      (await dayOf("Elm")) === undefined &&
        !(await itemOf("Elm")) &&
        (await dayOf("Night")) === 3 &&
        (await dayTabs().count()) === 3,
      `Remove day drops the day and its stops and renumbers later days at ${tag}`,
    );
    await undone("Remove day", before);

    await chooseItinerary(T.bulk[0]);
    await waitSaved((_, list) => list.every((item) => item.day === undefined));
    check(
      (await ideaNames()).length === 7 &&
        (await saved()).length === 7 &&
        (await ideasChip.innerText()) === T.ideasChip(7),
      `Move all events to ideas keeps every place as an idea and the chip counts seven at ${tag}`,
      await ideaNames(),
    );
    await shot("all-in-ideas");
    await undone("Move all events to ideas", before);

    await chooseItinerary(T.bulk[1]);
    await waitSaved((_, list) => list.length === 1);
    check(
      (await ideaNames()).join() === "Fir" && (await ideasChip.innerText()) === T.ideasChip(1),
      `Remove all scheduled events keeps the ideas at ${tag}`,
    );
    await undone("Remove all scheduled events", before);

    await showDay(2);
    await page.getByRole("button", { name: T.dayMap(2), exact: true }).click();
    if (phone) {
      check(
        await waitUntil(async () => await page.locator(".workspace-panel--map").isVisible(), 4000),
        `Day map brings the map forward on a phone at ${tag}`,
      );
      await shot("day-map");
      await page.getByRole("tab", { name: T.tripTab }).click();
      await timeline.waitFor();
    } else {
      check(
        await waitUntil(
          async () => (await page.locator(".trip-workspace").getAttribute("data-day")) === "2",
          4000,
        ),
        `Day map focuses the map on that day at ${tag}`,
      );
      await shot("day-map");
    }
    await showDay(2);
    const dayNotes = async () => (await savedPlan()).dayNotes;
    const formField = (name) => page.getByRole("textbox", { name, exact: true });
    const saveForm = () => page.getByRole("button", { name: T.pop.save, exact: true }).click();
    await dayMenuButton(2).click();
    await page.getByRole("menuitem", { name: T.dayText[0], exact: true }).click();
    await formField(T.titleField).fill("Harbour day");
    await shot("day-title");
    await saveForm();
    check(
      (await waitUntil(async () => (await dayNotes())?.["2"]?.title === "Harbour day", 10_000)) &&
        (await dayPanel.innerText()).includes("Harbour day"),
      `Edit title saves at once and shows on the day at ${tag}`,
      await dayNotes(),
    );
    await undoButton.first().click();
    check(
      await waitUntil(async () => (await dayNotes())?.["2"] === undefined, 10_000),
      `Undo after Edit title removes the title at ${tag}`,
      await dayNotes(),
    );
    await dayMenuButton(2).click();
    await page.getByRole("menuitem", { name: T.dayText[1], exact: true }).click();
    await formField(T.noteField).fill("Bring sunscreen");
    await saveForm();
    check(
      (await waitUntil(
        async () => (await dayNotes())?.["2"]?.note === "Bring sunscreen",
        10_000,
      )) && (await dayPanel.innerText()).includes("Bring sunscreen"),
      `Add note saves at once and shows on the day at ${tag}`,
      await dayNotes(),
    );
    await undoButton.first().click();
    check(
      await waitUntil(async () => (await dayNotes())?.["2"] === undefined, 10_000),
      `Undo after Add note removes the note at ${tag}`,
      await dayNotes(),
    );
    await showDay(1);
    check(
      (await noPrompt()) && dialogs.length === 0,
      `no day or itinerary action asked for confirmation at ${tag}`,
      dialogs,
    );

    before = await stable();
    await openFromDay(1);
    check(
      (await panel.getByRole("tab").allInnerTexts()).join("|") ===
        [T.tabs.search, T.tabs.ideas, T.tabs.saved, T.tabs.custom].join("|"),
      `the Add to trip panel has Search, Ideas, Saved and Custom tabs at ${tag}`,
    );
    await shot("add-panel");
    await pickResult("Walk Brasserie");
    await waitSaved((_, list) => list.some((item) => item.location === "Walk Brasserie"));
    const brasserie = await itemOf("Walk Brasserie");
    check(
      brasserie?.day === 1 &&
        !!brasserie.startTime &&
        (await panel.count()) === 0 &&
        (await page.getByLabel(T.panelStart).count()) === 0,
      `choosing a search result puts the place on the day at once, with no preview at ${tag}`,
      brasserie,
    );
    await undone("a search add", before);

    await openFromDay(1);
    await searchFor("walk");
    await panel.getByRole("list", { name: /Place results|地点搜索结果/ }).waitFor();
    check(
      (await panel
        .getByRole("list", { name: /Place results|地点搜索结果/ })
        .locator("strong")
        .count()) === 3,
      `Search lists the results of the query at ${tag}`,
    );
    await panel
      .getByRole("button", { name: language === "zh" ? "餐厅" : "Restaurants", exact: true })
      .click();
    check(
      await waitUntil(
        async () =>
          (
            await panel
              .getByRole("list", { name: /Place results|地点搜索结果/ })
              .locator("strong")
              .allInnerTexts()
          ).join() === "Walk Cafe",
        6000,
      ),
      `the Restaurants filter narrows Search to restaurants at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();
    check(
      (await panel.count()) === 0 && (await snap()) === before,
      `Close shuts the panel and changes nothing at ${tag}`,
    );

    await openFromDay(1);
    await searchFor("nothing here");
    await panel
      .getByText(
        language === "zh" ? "未找到地点，请换个关键词。" : "No places found. Try different words.",
      )
      .waitFor();
    check((await snap()) === before, `a search with no results changes nothing at ${tag}`);
    await panel.getByRole("button", { name: T.close, exact: true }).click();

    await openFromDay(1);
    await panelTab(T.tabs.custom).click();
    await panel.getByRole("textbox", { name: T.name, exact: true }).fill("Meeting point");
    await panel.getByRole("textbox", { name: T.note, exact: true }).fill("Bring tickets");
    await panel.getByLabel(T.panelStart, { exact: true }).fill("19:30");
    await panel.getByRole("button", { name: T.add, exact: true }).click();
    await waitSaved((_, list) => list.some((item) => item.location === "Meeting point"));
    const meeting = await itemOf("Meeting point");
    check(
      meeting?.day === 1 && meeting.startTime === "19:30" && meeting.note === "Bring tickets",
      `Custom adds a named stop with its time and note at once at ${tag}`,
      meeting,
    );
    await undone("a custom add", before);

    await openFromDay(2);
    await panelTab(T.tabs.ideas).click();
    check(
      (await panel.getByRole("button", { name: /Fir/ }).count()) === 1 &&
        (await panel.getByRole("button", { name: /Elm/ }).count()) === 0,
      `the Ideas tab lists only unscheduled places at ${tag}`,
    );
    await panel.getByRole("button", { name: /Fir/ }).click();
    await waitSaved((_, list) => list.find((item) => item.location === "Fir")?.day === 2);
    await undone("scheduling an Idea from the panel", before);

    await openFromDay(2);
    await panelTab(T.tabs.saved).click();
    const savedButtons = panel.getByRole("button", { name: /Saved Opera House/ });
    check(
      (await savedButtons.count()) === 1,
      `the Saved tab lists the account's saved place once at ${tag}`,
      await panel.innerText(),
    );
    await savedButtons.click();
    await waitSaved((_, list) => list.some((item) => item.location === "Saved Opera House"));
    const opera = await itemOf("Saved Opera House");
    check(
      opera?.day === 2 && !!opera.placeId,
      `adding a Saved place puts it on the day at once at ${tag}`,
      opera,
    );
    await undone("adding a Saved place", before);

    await openFromIdeas();
    check(
      (await panelTab(T.tabs.ideas).getAttribute("aria-selected")) === "true",
      `the ideas chip opens the panel on its Ideas tab at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();

    await openFromDay(1);
    await panel.getByRole("checkbox", { name: T.keep }).check();
    await pickResult("Walk Keep One");
    await waitSaved((_, list) => list.some((item) => item.location === "Walk Keep One"));
    await pickResult("Walk Keep Two");
    await waitSaved((_, list) => list.some((item) => item.location === "Walk Keep Two"));
    check((await panel.count()) === 1, `with Keep open the panel stays for several adds at ${tag}`);
    await panel.getByRole("button", { name: T.close, exact: true }).click();
    await shot("after-adds");
    await undoButton.first().click();
    await waitSaved((_, list) => !list.some((item) => item.location === "Walk Keep Two"));
    check(
      !!(await itemOf("Walk Keep One")) && !(await itemOf("Walk Keep Two")),
      `Undo takes back the last of two adds in a row at ${tag}`,
    );
    await rowMenu("Walk Keep One", T.stop[7]);
    await waitSaved((_, list) => !list.some((item) => item.location === "Walk Keep One"));
    check((await snap()) === baseline, `every add and Undo left the original plan at ${tag}`);
    check(
      (await noPrompt()) && dialogs.length === 0,
      `no add asked for confirmation at ${tag}`,
      dialogs,
    );

    await shot("final");

    check(pageErrors.length === 0, `no page or console errors at ${tag}`, pageErrors);
    check(dialogs.length === 0, `no dialog opened during the whole journey at ${tag}`, dialogs);
    await context.close();
  }
} catch (error) {
  check(false, "itinerary walkthrough completed without an exception", String(error));
  if (currentPage)
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(
    resolve(out, "result.json"),
    JSON.stringify(
      {
        passed,
        runs: RUNS.map((run) => run.name),
        total: checks.length,
        failed: checks.filter((item) => !item.ok).length,
        checks,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
}
