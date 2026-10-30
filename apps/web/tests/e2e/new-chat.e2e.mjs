import { mkdirSync, writeFileSync } from "node:fs";
import { controlledProxy, plan, settings, stop } from "./chat-generation-fixture.mjs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = new URL(process.env.BASE_URL ?? "http://localhost:3000");
const OUT = resolve(
  process.env.E2E_OUTPUT_DIR ?? `output/playwright/new-chat/${process.env.LABEL ?? Date.now()}`,
);
const WAIT = 5_000;
const CATALOG_KEY = "trip-workspace-catalog-v3";
mkdirSync(OUT, { recursive: true });

const within = (promise, label, timeout = WAIT) =>
  new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeout}ms`)), timeout);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const results = [];
const browserErrors = [];
const externalRequests = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const labels = {
  en: {
    newChat: "New chat",
    chat: "Chat",
    chats: "Chats",
    trips: "Trips",
    calendar: "Calendar",
    trajectory: "Trajectory",
    newTrip: "New trip",
    nav: "Open navigation",
    mine: "Mine",
    where: "Where",
  },
  zh: {
    newChat: "新聊天",
    chat: "聊天",
    chats: "聊天",
    trips: "行程",
    calendar: "日历",
    trajectory: "轨迹",
    newTrip: "新行程",
    nav: "打开导航",
    mine: "我的",
    where: "去哪里",
  },
};

const emptyCatalog = {
  version: 5,
  conversations: [],
  trips: [],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "timeline",
  },
};

const proxy = controlledProxy(BASE, within);
const proxyUrl = await proxy.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const openPage = async ({
  language = "en",
  viewport = { width: 1440, height: 1000 },
  seedCatalog = emptyCatalog,
  seedSettings = settings,
} = {}) => {
  const context = await browser.newContext({
    viewport,
    ...(viewport.width <= 520 ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: "reduce",
    locale: language === "en" ? "en-AU" : "zh-CN",
    timezoneId: "Australia/Sydney",
  });
  await context.addInitScript(
    ({ catalog, settings, language, catalogKey }) => {
      localStorage.setItem(catalogKey, JSON.stringify(catalog));
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({ ...settings, language, dataMode: "mock" }),
      );
      localStorage.setItem("trip.dataMode", "mock");
    },
    { catalog: seedCatalog, settings: seedSettings, language, catalogKey: CATALOG_KEY },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(WAIT);
  page.setDefaultNavigationTimeout(WAIT);
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === new URL(proxyUrl).port) {
      return route.continue();
    }
    if (/tiles\.openfreemap\.org|openstreetmap|photon\.komoot|nominatim|osrm/.test(url.hostname)) {
      return route.abort();
    }
    externalRequests.push(url.href);
    return route.abort();
  });
  await page.goto(proxyUrl, { waitUntil: "domcontentloaded", timeout: WAIT });
  await page.locator(".workspace-app").waitFor({ timeout: WAIT });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page };
};

const nav = (page) => page.locator(".sidebar-nav");
const entry = (page, name) => nav(page).getByRole("button", { name: new RegExp(`^${name}`) });
const composer = (page) =>
  page.getByRole("textbox", { name: /Message AI Trip Planner|向 AI 旅行规划助手发送消息/ });
const readCatalog = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), CATALOG_KEY);
const waitCatalog = async (page, predicate, arg) => {
  try {
    await page.waitForFunction(
      ({ predicate, arg, key }) => {
        const value = JSON.parse(localStorage.getItem(key) ?? "null");
        return Function("value", "arg", `return (${predicate})(value, arg);`)(value, arg);
      },
      { predicate: predicate.toString(), arg, key: CATALOG_KEY },
      { timeout: WAIT },
    );
  } catch (error) {
    const value = await readCatalog(page);
    throw new Error(
      `${error instanceof Error ? error.message : error}\nCatalog: ${JSON.stringify(value)}`,
    );
  }
};
const send = async (page, text) => {
  const input = composer(page);
  await input.fill(text);
  await input.press("Enter");
};
const waitForControlledProgress = async (page) => {
  const thinking = page.getByRole("region", { name: /Thinking process|思考过程/ });
  await thinking.waitFor({ timeout: WAIT });
  for (const selector of [".thinking-turn", ".thinking-subagent__row", ".thinking-reasoning"]) {
    const toggle = thinking.locator(`${selector} > .thinking-row__line > button`).last();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  await thinking.getByText("Controlled partial reasoning", { exact: true }).waitFor({
    timeout: WAIT,
  });
};

try {
  for (const language of ["en", "zh"]) {
    const text = labels[language];
    for (const collapsed of [false, true]) {
      const tag = `${language} ${collapsed ? "collapsed" : "expanded"}`;
      const { context, page } = await openPage({ language });
      if (collapsed) {
        await page.locator(".sidebar-toggle").click();
        await page.locator(".workspace-sidebar.is-collapsed").waitFor();
      }
      await page.waitForFunction(
        ({ selector, count }) => document.querySelectorAll(selector).length === count,
        { selector: ".sidebar-nav button", count: 5 },
        { timeout: WAIT },
      );
      const order = await nav(page)
        .getByRole("button")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent.trim()),
        );
      check(
        order.length === 5 &&
          [text.newChat, text.chats, text.trips, text.calendar, text.trajectory].every(
            (name, index) => order[index].startsWith(name),
          ),
        `${tag}: sidebar entries are New chat, Chats, Trips, Calendar, Trajectory`,
        order,
      );
      if (collapsed) {
        check(
          (await entry(page, text.newChat).getAttribute("data-tooltip")) === text.newChat,
          `${tag}: New chat tooltip`,
        );
        check(
          (await entry(page, text.newChat).locator("svg").count()) === 1,
          `${tag}: New chat shows an icon`,
        );
      }
      await entry(page, text.newChat).focus();
      await page.keyboard.press("Enter");
      check(
        (await page.getByRole("dialog", { name: text.where }).count()) === 0,
        `${tag}: keyboard New chat does not open Where`,
      );
      await within(
        page.waitForFunction(() =>
          document.activeElement?.matches?.(".composer textarea, .composer__input, textarea"),
        ),
        `${tag}: composer focus`,
      );
      const catalog = await readCatalog(page);
      const active = catalog.conversations.find((item) => item.id === catalog.activeConversationId);
      check(
        active?.title === "New chat" && active?.tripId === undefined && catalog.trips.length === 0,
        `${tag}: keyboard New chat creates a blank Chat only`,
        { title: active?.title, tripId: active?.tripId, trips: catalog.trips.length },
      );
      await page.screenshot({
        path: `${OUT}/${language}-${collapsed ? "collapsed" : "expanded"}-new-chat.png`,
      });
      await context.close();
    }

    const tablet = await openPage({
      language,
      viewport: { width: 800, height: 900 },
    });
    await tablet.page.getByRole("button", { name: text.nav }).click();
    const drawer = tablet.page.locator(".workspace-drawer--nav");
    await drawer.getByRole("button", { name: new RegExp(`^${text.newChat}`) }).waitFor();
    await drawer.getByRole("button", { name: new RegExp(`^${text.newChat}`) }).click();
    check(
      (await tablet.page.getByRole("dialog", { name: text.where }).count()) === 0,
      `${language} tablet: New chat does not open Where`,
    );
    const tabletCatalog = await readCatalog(tablet.page);
    check(
      tabletCatalog.conversations.some((item) => item.title === "New chat") &&
        tabletCatalog.trips.length === 0,
      `${language} tablet: New chat creates a blank Chat only`,
    );
    await tablet.context.close();

    const phone = await openPage({
      language,
      viewport: { width: 390, height: 844 },
    });
    await phone.page.getByRole("tab", { name: text.mine }).click();
    const mine = phone.page.locator(".phone-mine");
    await mine.waitFor();
    check(
      (await mine
        .locator(".chats-panel__section-head")
        .getByRole("button", { name: text.newChat, exact: true })
        .count()) === 1 &&
        (await mine.getByRole("button", { name: text.newTrip, exact: true }).count()) === 1,
      `${language} phone Mine: Chats and Trips keep their own create actions`,
    );
    await phone.page.screenshot({
      path: `${OUT}/${language}-phone-mine-actions.png`,
    });
    await mine
      .locator(".chats-panel__section-head")
      .getByRole("button", { name: text.newChat, exact: true })
      .click();
    await phone.page
      .getByRole("tab", { name: text.chat })
      .waitFor({ state: "visible", timeout: WAIT });
    check(
      (await phone.page.getByRole("tab", { name: text.chat }).getAttribute("aria-selected")) ===
        "true",
      `${language} phone Mine: New chat opens Chat`,
    );
    const phoneCatalog = await readCatalog(phone.page);
    check(
      phoneCatalog.conversations.length === 1 &&
        phoneCatalog.conversations[0]?.title === "New chat" &&
        phoneCatalog.conversations[0]?.tripId === undefined &&
        phoneCatalog.trips.length === 0,
      `${language} phone Mine: New chat creates one plain Conversation and no Trip`,
      {
        conversations: phoneCatalog.conversations.map((item) => ({
          title: item.title,
          tripId: item.tripId,
        })),
        trips: phoneCatalog.trips.length,
      },
    );
    await phone.page.screenshot({
      path: `${OUT}/${language}-phone-mine-new-chat.png`,
    });
    await phone.page.getByRole("tab", { name: text.chat }).click();
    proxy.reset();
    await send(phone.page, "Phone original plain chat");
    await proxy.waitForCount(1);
    const phoneRequest = proxy.requests[0];
    await waitForControlledProgress(phone.page);
    await phone.page.getByRole("tab", { name: text.mine }).click();
    await mine
      .locator(".chats-panel__section-head")
      .getByRole("button", { name: text.newChat, exact: true })
      .click();
    await phone.page.getByRole("tab", { name: text.mine }).click();
    const originalChat = mine.locator(
      ".history-item:not(.history-item--active) .history-item__open",
    );
    check(
      (await originalChat.count()) === 1,
      `${language} phone Mine: original ordinary Chat remains reachable while generating`,
    );
    await originalChat.click();
    await waitForControlledProgress(phone.page);
    check(
      (await phone.page.getByText("Phone original plain chat", { exact: true }).count()) === 1 &&
        (await readCatalog(phone.page)).activeConversationId === phoneCatalog.activeConversationId,
      `${language} phone Mine: reopening the original Chat restores its message and progress`,
    );
    phoneRequest.releaseNeedsInfo("Phone original reply", {});
    await within(phoneRequest.settled, "phone original reply");
    await phone.page.getByText("Phone original reply", { exact: true }).waitFor();
    await phone.page.getByRole("tab", { name: text.mine }).click();
    await mine.locator(".history-item--active .history-item__open").click();
    check(
      (await phone.page.getByText("Phone original reply", { exact: true }).count()) === 1,
      `${language} phone Mine: completed ordinary Chat remains reachable`,
    );
    await phone.page.screenshot({ path: `${OUT}/${language}-phone-original-chat-restored.png` });
    await phone.context.close();
  }

  proxy.reset();
  const plain = await openPage();
  await entry(plain.page, "New chat").click();
  await entry(plain.page, "New chat").click();
  const reusedCatalog = await readCatalog(plain.page);
  check(
    reusedCatalog.conversations.length === 1 && reusedCatalog.trips.length === 0,
    "repeated New chat reuses one untouched plain Conversation",
    {
      conversations: reusedCatalog.conversations.length,
      trips: reusedCatalog.trips.length,
    },
  );
  await send(plain.page, "Just chatting about weather");
  await proxy.waitForCount(1);
  const plainRequest = proxy.requests[0];
  await waitForControlledProgress(plain.page);
  plainRequest.releaseNeedsInfo("What city are you asking about?", {});
  await within(plainRequest.settled, "plain needs_info");
  await plain.page.getByText("What city are you asking about?", { exact: true }).waitFor({
    timeout: WAIT,
  });
  await waitCatalog(
    plain.page,
    (value) =>
      value?.conversations?.length === 1 &&
      value.trips?.length === 0 &&
      value.conversations[0]?.tripId === undefined &&
      value.conversations[0]?.messages?.some(
        (message) => message.text === "What city are you asking about?",
      ),
  );
  const plainState = await plain.page.locator(".workspace-shell").evaluate((node) => ({
    preferencesOpen: node.getAttribute("data-preferences-open"),
    optionalFactChips: node.querySelectorAll(".fact-chips").length,
  }));
  check(
    plainState.preferencesOpen === "false" && (await plain.page.getByRole("dialog").count()) === 0,
    "plain chat reply keeps Conversation only without forcing a travel fact form",
    plainState,
  );
  await plain.page.locator(".save-state--saved").waitFor({ timeout: WAIT });
  check(true, "plain Chat settles to saved-local status");
  await plain.page.screenshot({ path: `${OUT}/plain-chat-needs-info.png` });
  await plain.context.close();

  proxy.reset();
  const planned = await openPage();
  await entry(planned.page, "New chat").click();
  await send(planned.page, "Plan two days in Lisbon for two people, budget 3000");
  await proxy.waitForCount(1);
  const plannedRequest = proxy.requests[0];
  const plannedTripId = plannedRequest.body.tripId;
  const completed = plan({
    id: plannedTripId,
    destination: "Lisbon",
    items: [stop("lisbon-base", 1, "10:00")],
  });
  plannedRequest.release(completed, "Lisbon plan ready");
  await within(plannedRequest.settled, "planned complete");
  await planned.page.getByText("Lisbon plan ready", { exact: true }).waitFor({ timeout: WAIT });
  await waitCatalog(
    planned.page,
    (value, tripId) =>
      value?.trips?.some((trip) => trip.id === `trip:${tripId}`) &&
      value?.conversations?.some(
        (item) => item.tripId === `trip:${tripId}` && item.id === value.activeConversationId,
      ),
    plannedTripId,
  );
  check(true, "saveable Plan associates a Trip", { tripId: plannedTripId });
  await planned.page.screenshot({ path: `${OUT}/plan-creates-trip.png` });
  await planned.context.close();

  const tripsPage = await openPage();
  await entry(tripsPage.page, "Trips").click();
  await tripsPage.page.locator(".trips-page").waitFor({ timeout: WAIT });
  await tripsPage.page.getByRole("button", { name: "New trip", exact: true }).click();
  const where = tripsPage.page.getByRole("dialog", { name: "Where" });
  await where.waitFor({ timeout: WAIT });
  check(
    await where.evaluate((node) => node.contains(document.activeElement)),
    "Trips page New trip still opens Where",
  );
  await tripsPage.page.screenshot({ path: `${OUT}/trips-page-new-trip.png` });
  await tripsPage.context.close();

  proxy.reset();
  const concurrent = await openPage();
  await entry(concurrent.page, "New chat").click();
  await send(concurrent.page, "Original plain chat");
  await proxy.waitForCount(1);
  const original = proxy.requests[0];
  await waitForControlledProgress(concurrent.page);
  const originalConversationId = await concurrent.page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).activeConversationId,
    CATALOG_KEY,
  );
  await entry(concurrent.page, "New chat").click();
  await waitCatalog(
    concurrent.page,
    (value, originalId) =>
      value?.activeConversationId !== undefined && value.activeConversationId !== originalId,
    originalConversationId,
  );
  const concurrentBlank = await readCatalog(concurrent.page);
  check(
    concurrentBlank.conversations.length === 2 &&
      concurrentBlank.conversations.every((item) => item.tripId === undefined) &&
      !(await composer(concurrent.page).isDisabled()),
    "New chat opens a separate idle plain Chat while the original is generating",
    concurrentBlank.conversations.map((item) => ({
      id: item.id,
      tripId: item.tripId,
    })),
  );
  await concurrent.page.screenshot({ path: `${OUT}/second-chat-before-send.png` });
  await send(concurrent.page, "Second plain chat");
  await proxy.waitForCount(2);
  const second = proxy.requests[1];
  await waitForControlledProgress(concurrent.page);
  const secondConversationId = await concurrent.page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).activeConversationId,
    CATALOG_KEY,
  );
  check(
    originalConversationId !== secondConversationId &&
      original.body.tripId !== second.body.tripId &&
      !original.aborted,
    "new Chat while generating stays isolated",
    {
      originalConversationId,
      secondConversationId,
      originalTripId: original.body.tripId,
      secondTripId: second.body.tripId,
      originalAborted: original.aborted,
    },
  );
  check(
    (await concurrent.page.getByText("Original plain chat", { exact: true }).count()) === 0 &&
      (await concurrent.page.getByText("Second plain chat", { exact: true }).count()) === 1,
    "second Chat shows only its own user message",
  );
  await concurrent.page
    .locator(".sidebar-nav")
    .getByRole("button", { name: /^Chats/ })
    .click();
  await concurrent.page
    .locator(
      ".history-item:not(.history-item--active):not(.history-item--trip) .history-item__open",
    )
    .first()
    .click();
  await waitForControlledProgress(concurrent.page);
  check(
    (await concurrent.page.getByText("Original plain chat", { exact: true }).count()) === 1 &&
      (await concurrent.page.getByText("Second plain chat", { exact: true }).count()) === 0,
    "returning to the original Chat keeps its progress",
  );
  second.releaseNeedsInfo("Second question", {});
  await within(second.settled, "second needs_info");
  original.releaseNeedsInfo("Original question", {});
  await within(original.settled, "original needs_info");
  await concurrent.page.getByText("Original question", { exact: true }).waitFor({ timeout: WAIT });
  check(
    (await concurrent.page.getByText("Second question", { exact: true }).count()) === 0,
    "completed replies do not cross-write",
  );
  await waitCatalog(
    concurrent.page,
    (value) =>
      value?.conversations?.length === 2 &&
      value.trips?.length === 0 &&
      value.conversations.every((item) => item.tripId === undefined),
  );
  const finalCatalog = await readCatalog(concurrent.page);
  check(
    finalCatalog.conversations.length === 2 && finalCatalog.trips.length === 0,
    "final catalog has two plain Conversations and zero Trips",
    {
      conversations: finalCatalog.conversations.map((item) => ({
        id: item.id,
        title: item.title,
        tripId: item.tripId,
      })),
      trips: finalCatalog.trips.length,
    },
  );
  await concurrent.page.screenshot({ path: `${OUT}/concurrent-isolation.png` });
  await concurrent.context.close();

  check(browserErrors.length === 0, "no page errors", browserErrors);
  check(externalRequests.length === 0, "no external requests", externalRequests);
} finally {
  await browser.close();
  await proxy.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        results,
        browserErrors,
        externalRequests,
        fixture: "controlled chat proxy; empty local catalog; no live services",
      },
      null,
      2,
    ),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
