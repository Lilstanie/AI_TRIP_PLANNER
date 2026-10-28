import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { placeFor, sleep, waitUntil } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/add-to-trip-panel",
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
    day: (n) => `Add to Day ${n}`,
    ideas: "1 idea",
    panel: "Add to trip",
    tabs: { search: "Search", ideas: "Ideas", saved: "Saved", custom: "Custom" },
    filters: {
      places: "Places",
      stays: "Stays",
      restaurants: "Restaurants",
      experiences: "Experiences",
      events: "Events",
    },
    close: "Close",
    keep: "Keep open",
    search: "Search places",
    name: "Name",
    note: "Note",
    start: "Start time",
    add: "Add",
    none: "No places found. Try different words.",
    results: "Place results",
    undo: /^Undo( last change)?$/,
  },
  zh: {
    day: (n) => `添加到第 ${n} 天`,
    ideas: "1 个备选地点",
    panel: "添加到行程",
    tabs: { search: "搜索", ideas: "备选地点", saved: "已保存", custom: "自定义" },
    filters: {
      places: "地点",
      stays: "住宿",
      restaurants: "餐厅",
      experiences: "体验",
      events: "活动",
    },
    close: "关闭",
    keep: "保持打开",
    search: "搜索地点",
    name: "名称",
    note: "备注",
    start: "开始时间",
    add: "添加",
    none: "未找到地点，请换个关键词。",
    results: "地点搜索结果",
    undo: /^(撤销|撤销上次修改)$/,
  },
};

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

const typed = (name, primaryType) => ({ ...placeFor(name), primaryType });
const CATALOG_OF = {
  "Panel Cafe": typed("Panel Cafe", "cafe"),
  "Panel Hotel": typed("Panel Hotel", "hotel"),
  "Panel Museum": typed("Panel Museum", "museum"),
  "Panel Theatre": typed("Panel Theatre", "performing_arts_theater"),
  "Panel Bridge": typed("Panel Bridge", "tourist_attraction"),
};

try {
  for (const run of [
    { width: 1440, height: 900, language: "en" },
    { width: 390, height: 844, language: "en" },
    { width: 1440, height: 900, language: "zh" },
  ]) {
    const { width, height, language } = run;
    const T = TEXT[language];
    const phone = width <= 520;
    const tag = `${width}px ${language}`;
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    currentPage = page;
    const pageErrors = [];
    const editRequests = [];
    const searchRequests = [];
    let offline = false;
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("dialog", (dialog) => void dialog.accept());
    page.on("request", (request) => {
      if (request.url().endsWith("/api/trip/preview-edit"))
        editRequests.push(request.postDataJSON());
    });
    await page.route("**/api/places/details", (route) => {
      const { placeId } = route.request().postDataJSON();
      return route.fulfill({ json: { place: placeFor(placeId.replace(/^stub:/, "")) } });
    });
    await page.route("**/api/places/search", (route) => {
      const body = route.request().postDataJSON();
      searchRequests.push(body);
      if (offline) return route.abort();
      if (/panel extras/i.test(body.text))
        return route.fulfill({
          json: {
            places: [
              typed("Panel Funfair", "amusement_park"),
              { ...placeFor("Panel Untyped"), primaryType: undefined },
            ],
          },
        });
      if (/panel cafe only/i.test(body.text))
        return route.fulfill({ json: { places: [CATALOG_OF["Panel Cafe"]] } });
      if (/nothing/i.test(body.text)) return route.fulfill({ json: { places: [] } });
      if (/^panel$/i.test(body.text.trim()))
        return route.fulfill({ json: { places: Object.values(CATALOG_OF) } });
      if (/no coordinates/i.test(body.text))
        return route.fulfill({
          json: {
            places: [{ id: "stub:no-coordinates", displayName: { text: "Panel No Coordinates" } }],
          },
        });
      return route.fulfill({ json: { places: [placeFor(body.text)] } });
    });

    const tripId = `panel-trip-${width}-${language}`;
    const otherId = `panel-other-${width}-${language}`;
    const activity = (id, day, startTime, endTime, name, extra = {}) => ({
      id: `${id}-${width}`,
      kind: "activity",
      ...(day === undefined ? {} : { day, startTime, endTime }),
      location: name,
      detail: name,
      placeId: placeFor(name).id,
      ...extra,
    });
    const planOf = (id, items, destination = "Sydney") => ({
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
    const plan = planOf(tripId, [
      activity("museum", 1, "09:00", "10:00", "Panel Museum"),
      activity("garden", 1, "11:00", "12:00", "Panel Garden"),
      activity("harbour", 2, "11:00", "12:00", "Panel Harbour"),
      activity("late", 3, "22:00", "23:30", "Panel Late"),
      activity("idea", undefined, undefined, undefined, "Parked Idea"),
    ]);
    const otherPlan = planOf(
      otherId,
      [
        activity("opera", 1, "09:00", "10:00", "Saved Opera House", { savedPlace: savedFixture }),
        activity("opera-again", 2, "09:00", "10:00", "Saved Opera House", {
          savedPlace: savedFixture,
        }),
      ],
      "Zzzland",
    );
    const snapshotOf = (id, conversationId, p) => ({
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
    const conversationId = `panel-conversation-${width}-${language}`;
    const otherConversationId = `panel-other-conversation-${width}-${language}`;
    const snapshot = snapshotOf(tripId, conversationId, plan);
    const otherSnapshot = snapshotOf(otherId, otherConversationId, otherPlan);
    const catalog = {
      version: 4,
      activeConversationId: conversationId,
      activeTripId: tripId,
      conversations: [
        {
          id: conversationId,
          title: "Sydney panel",
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
          title: "Sydney panel",
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
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
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
    await page.goto(BASE);
    await page.locator(".workspace-app").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

    if (phone) {
      await page.getByRole("tab", { name: /^(Mine|我的)$/ }).click();
      await page
        .locator(".phone-mine .trip-card")
        .filter({ hasNotText: "Zzzland" })
        .first()
        .click();
      const tripTab = page.getByRole("tab", { name: /^(Trip|行程)$/ });
      if (await tripTab.count()) await tripTab.click();
    } else {
      await page.getByRole("button", { name: /^(Trips|行程)/ }).click();
      await page
        .locator(".trips-page .trip-card")
        .filter({ hasNotText: "Zzzland" })
        .first()
        .click();
      const toggle = page.getByRole("button", { name: /^(Open your trip|打开你的行程)$/ });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    }
    const timeline = page.getByRole("region", { name: /^(Trip timeline|行程时间线)$/ });
    await timeline.waitFor({ timeout: 8000 }).catch(() => undefined);
    if (!(await timeline.count())) {
      await page.screenshot({
        path: resolve(out, `setup-${width}-${language}.png`),
        fullPage: true,
      });
      check(false, `saved Trip fixture opens at ${tag}`, {
        body: (await page.locator("body").innerText()).slice(0, 800),
        errors: pageErrors,
      });
      await context.close();
      continue;
    }

    const saved = () =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
        const found = stored?.trips?.find((trip) => trip.id === stored.activeTripId);
        return (
          found?.snapshot?.plan?.sections?.find((part) => part.id === "itinerary")?.proposal
            ?.items ?? []
        );
      });
    const savedCore = async () => core(await saved());
    const waitSaved = (test) => waitUntil(async () => test(await saved()), 10_000);
    const stored = async (name) =>
      (await saved()).find((item) => item.kind === "activity" && item.location === name);
    const showDay = async (day) => {
      const tab = timeline.getByRole("tab", { name: new RegExp(`^(Day ${day}|第 ${day} 天)`) });
      if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
    };
    const panel = page.getByRole("region", { name: T.panel });
    const tab = (name) => panel.getByRole("tab", { name, exact: true });
    const undoButton = page.getByRole("button", { name: T.undo });
    const undo = () => undoButton.first().click();
    const openFromDay = async (day) => {
      await showDay(day);
      await timeline.getByRole("button", { name: T.day(day), exact: true }).click();
      await panel.waitFor();
    };
    const openFromIdeas = async () => {
      await timeline.getByRole("button", { name: T.ideas, exact: true }).click();
      await panel.waitFor();
    };
    const searchFor = async (text) => {
      const box = panel.getByRole("searchbox", { name: T.search });
      await box.fill(text);
      await box.press("Enter");
    };
    const undone = async (label, before) => {
      await undo();
      const restored = await waitUntil(
        async () => JSON.stringify(await savedCore()) === JSON.stringify(before),
        10_000,
      );
      check(restored, `Undo restores the saved plan after ${label} at ${tag}`);
    };

    await showDay(1);
    check(
      (await timeline.getByRole("button", { name: /^(Add place|添加地点)$/ }).count()) === 0 &&
        (await timeline.getByRole("button", { name: T.day(1), exact: true }).count()) === 1 &&
        (await timeline.getByRole("button", { name: T.ideas, exact: true }).count()) === 1 &&
        (await timeline
          .getByRole("button", { name: /^(Add to Ideas|添加到备选地点)$/ })
          .count()) === 0,
      `an Add button ends the day, the ideas chip opens the panel, and the old Add place is gone at ${tag}`,
    );

    let before = await savedCore();
    let requestsBefore = editRequests.length;
    await openFromDay(1);
    check(
      (await panel.getByRole("tab").allInnerTexts()).join("|") ===
        [T.tabs.search, T.tabs.ideas, T.tabs.saved, T.tabs.custom].join("|"),
      `the panel has Search, Ideas, Saved and Custom tabs and no Receipt at ${tag}`,
    );
    check(
      (await panel.getByRole("textbox", { name: /^(Place name|地点名称)$/ }).count()) === 0 &&
        (await panel.getByRole("button", { name: /^(Save as Idea|保存为想法)$/ }).count()) === 0,
      `the panel has none of the old Add place controls at ${tag}`,
    );
    const rect = await panel.boundingBox();
    check(
      !phone || (rect && rect.x >= 0 && rect.x + rect.width <= width + 1),
      `the panel stays inside the phone screen at ${tag}`,
      rect,
    );
    if (phone) {
      const heights = await panel
        .locator("button, input:not([type=checkbox])")
        .evaluateAll((nodes) =>
          nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
        );
      check(
        heights.length > 0 && heights.every((height) => height >= 44),
        `every panel control is at least 44 px tall on a phone at ${tag}`,
        heights,
      );
    }
    await searchFor("Panel Brasserie");
    check(
      await waitUntil(() =>
        searchRequests.some((request) => request.text.includes("Panel Brasserie")),
      ),
      `search starts near the trip destination at ${tag}`,
      searchRequests.at(-1),
    );
    check(
      searchRequests.at(-1)?.destination === "Sydney",
      `the search request carries the trip destination at ${tag}`,
      searchRequests.at(-1),
    );
    await panel
      .getByRole("button", { name: /Panel Brasserie/ })
      .first()
      .click();
    await waitSaved((items) => items.some((item) => item.location === "Panel Brasserie"));
    const brasserie = await stored("Panel Brasserie");
    check(
      brasserie?.day === 1 && !!brasserie.startTime && !!brasserie.endTime,
      `choosing a search result puts the place on the day at once at ${tag}`,
      brasserie,
    );
    check(
      !!brasserie?.placeId && !!brasserie?.savedPlace,
      `the added place keeps a saved map match at ${tag}`,
      brasserie,
    );
    check(
      (await page.getByLabel(T.start).count()) === 0 &&
        (await page.getByRole("button", { name: "Add stop", exact: true }).count()) === 0 &&
        editRequests.slice(requestsBefore).filter((request) => request.operation.kind === "add")
          .length === 1,
      `no preview or confirm follows a search result at ${tag}`,
    );
    check((await panel.count()) === 0, `the panel closes after an add by default at ${tag}`);
    check((await undoButton.count()) > 0, `adding a place offers Undo at ${tag}`);
    await undone("a search add", before);

    await openFromDay(1);
    await searchFor("Panel Museum");
    await panel
      .getByRole("button", { name: /Panel Museum/ })
      .first()
      .click();
    await waitSaved(
      (items) => items.filter((item) => item.location === "Panel Museum").length === 2,
    );
    check(true, `a place already on the day is added again as its own stop at ${tag}`);
    await undone("adding a place twice", before);

    await openFromDay(1);
    await searchFor("nothing here");
    await panel.getByText(T.none).waitFor();
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(before),
      `a search with no results changes nothing and says so at ${tag}`,
    );

    offline = true;
    await searchFor("Panel Offline");
    await panel.getByRole("alert").first().waitFor({ timeout: 8000 });
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(before) &&
        (await panel.getByRole("searchbox", { name: T.search }).isEnabled()),
      `an offline search changes nothing, says so and stays usable at ${tag}`,
    );
    offline = false;

    await searchFor("Panel");
    await panel.getByRole("list", { name: T.results }).waitFor();
    const resultNames = async () =>
      (await panel.getByRole("list", { name: T.results }).locator("strong").allInnerTexts()).sort();
    check(
      (await resultNames()).length === 5,
      `with no filter chosen every kind of place is listed at ${tag}`,
      await resultNames(),
    );
    const expectFilter = async (key, expected) => {
      await panel.getByRole("button", { name: T.filters[key], exact: true }).click();
      const ok = await waitUntil(
        async () => JSON.stringify(await resultNames()) === JSON.stringify(expected),
        6000,
      );
      check(ok, `the ${key} filter narrows Search results at ${tag}`, await resultNames());
    };
    await expectFilter("restaurants", ["Panel Cafe"]);
    await expectFilter("stays", ["Panel Hotel"]);
    await expectFilter("experiences", ["Panel Bridge", "Panel Museum"]);
    await expectFilter("events", ["Panel Theatre"]);
    await expectFilter("places", Object.keys(CATALOG_OF).sort());
    await panel.getByRole("button", { name: T.filters.places, exact: true }).click();
    await searchFor("Panel Extras");
    await waitUntil(async () => (await resultNames()).length === 2, 6000);
    await expectFilter("experiences", ["Panel Funfair", "Panel Untyped"]);
    await expectFilter("stays", ["Panel Untyped"]);
    await expectFilter("restaurants", ["Panel Untyped"]);
    await expectFilter("events", ["Panel Untyped"]);
    await panel.getByRole("button", { name: T.filters.places, exact: true }).click();
    await searchFor("Panel Cafe Only");
    await panel.getByRole("list", { name: T.results }).waitFor();
    await panel.getByRole("button", { name: T.filters.stays, exact: true }).click();
    check(
      await panel
        .getByText(T.none)
        .waitFor({ timeout: 6000 })
        .then(
          () => true,
          () => false,
        ),
      `a filter that hides every returned place says no places were found at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();
    check((await panel.count()) === 0, `Close shuts the panel without asking to discard at ${tag}`);

    await openFromDay(1);
    await searchFor("Panel No Coordinates");
    await panel
      .getByRole("button", { name: /Panel No Coordinates/ })
      .first()
      .click();
    await waitSaved((items) => items.some((item) => item.location === "Panel No Coordinates"));
    const bare = await stored("Panel No Coordinates");
    check(
      bare?.day === 1 && !bare.savedPlace,
      `a result without coordinates is added without a match confirm at ${tag}`,
      bare,
    );
    check(
      (await page.getByText(/Map match|Use this place/).count()) === 0,
      `no map match confirm appears after an add at ${tag}`,
    );
    await undone("adding an unlocated place", before);

    await openFromDay(1);
    await tab(T.tabs.custom).click();
    await panel.getByRole("textbox", { name: T.name, exact: true }).fill("Meeting point");
    await panel.getByRole("textbox", { name: T.note, exact: true }).fill("Bring tickets");
    await panel.getByLabel(T.start, { exact: true }).fill("14:00");
    await panel.getByRole("button", { name: T.add, exact: true }).click();
    await waitSaved((items) => items.some((item) => item.location === "Meeting point"));
    const meeting = await stored("Meeting point");
    check(
      meeting?.day === 1 && meeting.startTime === "14:00" && meeting.note === "Bring tickets",
      `Custom adds a named stop with its time and note at once at ${tag}`,
      meeting,
    );
    await undone("a custom add", before);

    await openFromDay(1);
    await tab(T.tabs.custom).click();
    await panel.getByRole("textbox", { name: T.name, exact: true }).fill("Late show");
    const lateStart = panel.getByLabel(T.start, { exact: true });
    const lateAdd = panel.getByRole("button", { name: T.add, exact: true });
    const lateAdds = [];
    for (const time of ["23:30", "23:59", "22:59"]) {
      await lateStart.fill(time);
      const requestsBefore = editRequests.length;
      await lateAdd.click();
      await sleep(1500);
      const late = await stored("Late show");
      lateAdds.push({
        time,
        added: editRequests.length > requestsBefore,
        range: late ? [late.startTime, late.endTime] : null,
      });
      if (late) break;
    }
    const lateStop = await stored("Late show");
    check(
      lateAdds.slice(0, 2).every((item) => !item.added) &&
        lateStop?.startTime === "22:59" &&
        lateStop.endTime === "23:59",
      `Custom never adds a stop whose end is not after its start at ${tag}`,
      lateAdds,
    );
    await undone("a late custom add", before);

    await openFromDay(1);
    await tab(T.tabs.custom).click();
    check(
      await panel.getByRole("button", { name: T.add, exact: true }).isDisabled(),
      `Custom refuses a nameless stop at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();

    await openFromDay(2);
    await tab(T.tabs.ideas).click();
    check(
      (await panel.getByRole("button", { name: /Parked Idea/ }).count()) === 1 &&
        (await panel.getByRole("button", { name: /Panel Museum/ }).count()) === 0,
      `the Ideas tab lists only unscheduled places at ${tag}`,
    );
    await panel.getByRole("button", { name: /Parked Idea/ }).click();
    await waitSaved((items) => items.find((item) => item.location === "Parked Idea")?.day === 2);
    check(true, `choosing an Idea schedules it on the day at once at ${tag}`);
    await undone("scheduling an Idea", before);

    await openFromDay(2);
    await tab(T.tabs.saved).click();
    const savedButtons = panel.getByRole("button", { name: /Saved Opera House/ });
    check(
      (await savedButtons.count()) === 1 &&
        (await panel.getByRole("button", { name: /Panel Garden|Panel Museum/ }).count()) === 0,
      `the Saved tab lists each place from the account's other trips once and none from this trip at ${tag}`,
      await panel.innerText(),
    );
    await savedButtons.click();
    await waitSaved((items) => items.some((item) => item.location === "Saved Opera House"));
    const opera = await stored("Saved Opera House");
    check(
      opera?.day === 2 && !!opera.savedPlace && !!opera.placeId,
      `adding a Saved place keeps its saved map match at ${tag}`,
      opera,
    );
    await undone("adding a Saved place", before);

    await openFromIdeas();
    check(
      (await tab(T.tabs.ideas).getAttribute("aria-selected")) === "true",
      `the ideas chip opens the panel on its Ideas tab at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();

    await openFromDay(1);
    await panel.getByRole("checkbox", { name: T.keep }).check();
    await searchFor("Panel Keep One");
    await panel
      .getByRole("button", { name: /Panel Keep One/ })
      .first()
      .click();
    await waitSaved((items) => items.some((item) => item.location === "Panel Keep One"));
    await searchFor("Panel Keep Two");
    await panel
      .getByRole("button", { name: /Panel Keep Two/ })
      .first()
      .click();
    await waitSaved((items) => items.some((item) => item.location === "Panel Keep Two"));
    check(
      (await panel.count()) === 1,
      `with Keep open on the panel stays for several adds at ${tag}`,
    );
    await panel.getByRole("button", { name: T.close, exact: true }).click();
    await undo();
    await waitSaved((items) => !items.some((item) => item.location === "Panel Keep Two"));
    check(
      !!(await stored("Panel Keep One")) && !(await stored("Panel Keep Two")),
      `Undo takes back the last of two adds in a row at ${tag}`,
    );
    before = await savedCore();

    await openFromDay(1);
    await page.keyboard.press("Escape");
    check(
      (await panel.count()) === 0 &&
        (await page.getByRole("dialog", { name: /Discard|放弃/ }).count()) === 0,
      `Escape closes the panel without asking to discard at ${tag}`,
    );

    await showDay(3);
    const lateBefore = await savedCore();
    await timeline.getByRole("button", { name: T.day(3), exact: true }).click();
    await searchFor("Panel Night");
    await panel
      .getByRole("button", { name: /Panel Night/ })
      .first()
      .click();
    await timeline.getByRole("alert").first().waitFor({ timeout: 8000 });
    check(
      JSON.stringify(await savedCore()) === JSON.stringify(lateBefore),
      `a day with no room refuses the add with a notice at ${tag}`,
    );
    await showDay(1);
    if (await panel.count())
      await panel.getByRole("button", { name: T.close, exact: true }).click();

    await page.screenshot({ path: resolve(out, `panel-${width}-${language}.png`), fullPage: true });
    check(pageErrors.length === 0, `no page errors at ${tag}`, pageErrors);
    await context.close();
  }
} catch (error) {
  check(false, "Add to trip panel workflow completed without an exception", String(error));
  if (currentPage) {
    await currentPage
      .screenshot({ path: resolve(out, "exception.png"), fullPage: true })
      .catch(() => undefined);
  }
} finally {
  await browser.close();
  const passed = checks.length > 0 && checks.every((item) => item.ok);
  writeFileSync(resolve(out, "result.json"), JSON.stringify({ passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
}
