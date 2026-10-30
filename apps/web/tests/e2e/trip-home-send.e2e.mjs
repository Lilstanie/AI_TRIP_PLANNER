import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { checkHomeLayout, checkLinkedChatLayout } from "./trip-home-layout-checks.mjs";
import { controlledProxy, plan, settings, stop } from "./chat-generation-fixture.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = new URL(process.env.BASE_URL ?? "http://localhost:3000");
const OUT = resolve(
  process.env.E2E_OUTPUT_DIR ?? `output/playwright/trip-home-send/${process.env.LABEL ?? "run"}`,
);
const WAIT = 8_000;
mkdirSync(OUT, { recursive: true });

const results = [];
const browserErrors = [];
const externalRequests = [];
let current;
let profileName = "";

const check = (ok, name, observed) => {
  const label = `${profileName}: ${name}`;
  results.push({ ok: Boolean(ok), name: label, observed });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

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

const draft = (destination) => ({
  destination,
  origin: "",
  start: "2031-03-10",
  end: "2031-03-12",
  groupSize: "2",
  budgetTotal: "3000",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  minRating: "0",
  freeCancellation: false,
});

const snapshotFor = ({ id, destination, items, stamp, message, tripPlan }) => ({
  version: 4,
  id,
  savedAt: stamp,
  plan: tripPlan ?? plan({ id, destination, items }),
  draft: draft(destination),
  messages: message ? [{ role: "user", text: message, at: Date.parse(stamp) }] : [],
  input: "",
});

const makeTrip = ({ id, destination, title, items, chatCount, oneChat, tripPlan }) => {
  const tripStamp = "2026-10-20T00:00:00.000Z";
  const conversations = Array.from({ length: chatCount }, (_, index) => {
    const chatId = oneChat ?? `${id}-${index + 1}`;
    const message = `${title} marker ${index + 1}`;
    const stamp = `2026-10-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`;
    const snapshot = snapshotFor({
      id,
      destination,
      items,
      stamp,
      message,
      tripPlan,
    });
    return {
      id: `conversation:${chatId}`,
      title: `Saved Chat ${index + 1}`,
      renamed: true,
      updatedAt: stamp,
      tripId: `trip:${id}`,
      messages: snapshot.messages,
      input: "",
      snapshot,
    };
  });
  return {
    id: `trip:${id}`,
    title,
    renamed: true,
    updatedAt: tripStamp,
    snapshot: snapshotFor({ id, destination, items, stamp: tripStamp, tripPlan }),
    conversations,
  };
};

const sydneyItems = [stop("Opera House", 1, "09:00"), stop("Harbour Bridge", 1, "11:00")];
const sydneyPlan = plan({ id: "sydney", destination: "Sydney", items: sydneyItems });
sydneyPlan.sections[0].proposal.items.push({
  id: "bakery",
  kind: "activity",
  location: "Surry Hills bakery",
  detail: "Breakfast idea",
});
sydneyPlan.sections.push({
  id: "dining",
  label: "Dining",
  status: "draft",
  summary: "Sydney dining",
  estCost: 100,
  proposal: {
    agent: "dining",
    summary: "Sydney dining",
    items: [
      {
        id: "fish",
        kind: "meal",
        location: "Sydney fish restaurant",
        detail: "Seafood dinner",
      },
    ],
    assumptions: [],
    conflictsWith: [],
  },
});
const sydney = makeTrip({
  id: "sydney",
  destination: "Sydney",
  title: "Sydney winter weekend",
  items: sydneyItems,
  chatCount: 10,
  tripPlan: sydneyPlan,
});
sydney.conversations.push({
  id: "conversation:sydney-old-plan",
  title: "Saved Chat old",
  renamed: true,
  updatedAt: "2026-10-10T00:00:00.000Z",
  tripId: "trip:sydney",
  messages: [{ role: "user", text: "Old Sydney plan marker", at: Date.parse("2026-10-10") }],
  input: "",
  snapshot: snapshotFor({
    id: "sydney",
    destination: "Sydney",
    items: [],
    stamp: "2026-10-10T00:00:00.000Z",
    message: "Old Sydney plan marker",
  }),
});
const melbourne = makeTrip({
  id: "melbourne",
  destination: "Melbourne",
  title: "Melbourne food weekend",
  items: [stop("Queen Victoria Market", 1, "10:00")],
  chatCount: 1,
  oneChat: "melbourne",
});
const trips = [sydney, melbourne];
const catalog = {
  version: 5,
  activeConversationId: sydney.conversations[0].id,
  activeTripId: sydney.id,
  trips: trips.map(({ conversations: _conversations, ...trip }) => ({
    ...trip,
    conversationIds: _conversations.map((chat) => chat.id),
  })),
  conversations: trips.flatMap((trip) => trip.conversations),
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "timeline",
  },
};

const labels = {
  en: {
    trips: /^Trips/,
    mine: /^Mine/,
    home: "Sydney winter weekend",
    chatsLabel: "Chats",
    send: "Send",
    start: "Start chat",
    backTrips: "Back to trips",
  },
  zh: {
    trips: /^行程/,
    mine: /^我的/,
    home: "Sydney winter weekend",
    chatsLabel: "聊天",
    send: "发送",
    start: "开始聊天",
    backTrips: "返回行程",
  },
};

const profiles = [
  {
    name: "desktop 1440 en",
    language: "en",
    viewport: { width: 1440, height: 760 },
    primary: true,
  },
  {
    name: "ideas parity en",
    language: "en",
    viewport: { width: 1440, height: 760 },
    ideas: true,
  },
  {
    name: "dismissal storage en",
    language: "en",
    viewport: { width: 1440, height: 760 },
    dismissal: true,
  },
  {
    name: "concurrent Trips en",
    language: "en",
    viewport: { width: 1440, height: 760 },
    concurrent: true,
  },
  {
    name: "tablet 800 en",
    language: "en",
    viewport: { width: 800, height: 720 },
  },
  {
    name: "phone 390 zh",
    language: "zh",
    viewport: { width: 390, height: 700 },
    phone: true,
  },
];

const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null"));
const chatsFor = async (page, tripId) =>
  (await stored(page)).conversations.filter((chat) => chat.tripId === tripId);
const composer = (page) => page.locator(".trip-home__composer .composer__input");
const rowNames = async (page) => page.locator(".trip-home-chats__name").allInnerTexts();
const selectPhoneTab = async (page, name) => {
  await page
    .getByRole("tablist", { name: /Workspace sections|工作区栏目/ })
    .getByRole("tab", { name, exact: true })
    .click();
};

const openTrips = async (page, label) => {
  const width = page.viewportSize().width;
  if (width <= 520) {
    await selectPhoneTab(page, label.mine);
    await page.locator(".phone-mine").waitFor();
    return;
  }
  if (width <= 1000) {
    await page.getByRole("button", { name: /Open navigation|打开导航/, exact: true }).click();
  }
  await page.getByRole("button", { name: label.trips }).filter({ visible: true }).click();
  await page.locator(".trip-cards").waitFor();
};

const openHome = async (page, label, title) => {
  if (!(await page.locator(".trip-cards").isVisible())) await openTrips(page, label);
  await page.locator(".trip-cards .trip-card").filter({ hasText: title }).first().click();
  await page.locator(".trip-home").waitFor();
};

const waitStored = (page, predicate, arg) =>
  page.waitForFunction(
    ({ predicate, arg }) => {
      const value = JSON.parse(localStorage.getItem("trip-workspace-catalog-v3") ?? "null");
      return Function("value", "arg", `return (${predicate})(value, arg);`)(value, arg);
    },
    { predicate: predicate.toString(), arg },
    { timeout: WAIT },
  );

const sendWithEnter = async (page, label, text) => {
  const box = composer(page, label);
  await box.fill(text);
  await box.press("Enter");
};

const waitForControlledProgress = async (page) => {
  const thinking = page.getByRole("region", { name: /Thinking process|思考过程/ });
  await thinking.waitFor();
  for (const selector of [".thinking-turn", ".thinking-subagent__row", ".thinking-reasoning"]) {
    const toggle = thinking.locator(`${selector} > .thinking-row__line > button`).last();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
  await thinking.getByText("Controlled partial reasoning", { exact: true }).waitFor();
};

async function runPrimary(page, label) {
  await openHome(page, label, label.home);
  const home = page.locator(".trip-home");
  const before = await chatsFor(page, sydney.id);
  const box = home.locator(".trip-home__composer");
  const boxRect = await box.boundingBox();
  check(
    boxRect !== null && boxRect.y + boxRect.height <= profiles[0].viewport.height + 1,
    "a long Chat list keeps the desktop composer inside the viewport",
    boxRect,
  );
  check(
    (await home.getByRole("button", { name: label.start, exact: true }).count()) === 0,
    "Trip home has no separate Start chat action",
  );
  check(
    (await home.locator(".trip-home-chats__title").innerText()) ===
      `Chats · ${sydney.conversations.length}`,
    "the Chat heading shows the linked Chat count",
    await home.locator(".trip-home-chats__title").innerText(),
  );
  check(
    (await home.locator(".trip-home-chats__chevron").count()) === sydney.conversations.length,
    "every Chat row exposes a forward affordance",
    await home.locator(".trip-home-chats__chevron").count(),
  );

  await page.locator(".trip-home-chats__row").filter({ hasText: "Saved Chat old" }).click();
  await page.locator(".workspace-shell:not(.workspace-shell--trips)").waitFor();
  await checkLinkedChatLayout(page, check);
  check(
    (await page.locator(".trip-home").count()) === 0,
    "a linked Chat opens the independent Chat workspace",
  );
  await page.getByRole("button", { name: "Open your trip", exact: true }).click();
  const itinerary = page.locator(".trip-workspace");
  await itinerary.waitFor();
  check(
    (await itinerary.getByText("Opera House", { exact: true }).count()) === 1,
    "opening an older Chat keeps the Trip's newer Plan",
  );
  await page.getByRole("button", { name: "Open your trip", exact: true }).click();
  if (page.viewportSize().width > 520) {
    if (page.viewportSize().width <= 1000)
      await page.getByRole("button", { name: /Open navigation|打开导航/, exact: true }).click();
    await page
      .locator(".sidebar-nav")
      .getByRole("button", { name: /Trajectory|轨迹/, exact: true })
      .click();
    await page.getByRole("region", { name: /Trajectory|轨迹/, exact: true }).waitFor();
  }
  await openHome(page, label, label.home);
  await home.locator(".trip-home-chats").waitFor();

  const draftBox = composer(page, label);
  await draftBox.focus();
  await draftBox.fill("A draft that should never create a Chat");
  await draftBox.fill("");
  check(
    (await chatsFor(page, sydney.id)).length === before.length,
    "focus, typing and clearing the composer do not create a Chat",
  );
  await draftBox.press("Enter");
  check(
    (await chatsFor(page, sydney.id)).length === before.length,
    "an empty Enter submission does not create a Chat",
  );

  await draftBox.fill("Compose confirmation text");
  await draftBox.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 229,
    which: 229,
    isComposing: true,
  });
  check(
    (await chatsFor(page, sydney.id)).length === before.length,
    "an IME confirmation Enter does not create a Chat",
  );
  await draftBox.fill("Morning walk");
  await draftBox.press("Shift+Enter");
  check(
    (await draftBox.inputValue()).includes("\n") &&
      (await chatsFor(page, sydney.id)).length === before.length,
    "Shift+Enter inserts a line break without creating a Chat",
    await draftBox.inputValue(),
  );
  await draftBox.fill("Sydney-only unsent draft");
  await home.getByRole("button", { name: label.backTrips, exact: true }).click();
  await page.locator(".trip-cards").waitFor();
  await openHome(page, label, "Melbourne food weekend");
  check(
    (await composer(page, label).inputValue()) === "",
    "switching Trips does not leak an unsent draft",
    await composer(page, label).inputValue(),
  );
  await page.getByRole("button", { name: label.backTrips, exact: true }).click();
  await openHome(page, label, label.home);

  await page.locator(".trip-home__composer input[type=file]").setInputFiles({
    name: "trip-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Prefer quiet harbour walks"),
  });
  await page
    .locator(".trip-home__composer .attachment-chips")
    .getByText("trip-notes.txt")
    .waitFor();
  await sendWithEnter(page, label, "Plan a quiet harbour walk");
  const firstArrived = await within(profileProxy.waitForCount(1), "first Trip-home send")
    .then(() => true)
    .catch(() => false);
  check(firstArrived, "the first Enter creates one linked Chat and starts one request");
  if (!firstArrived) throw new Error("first Trip-home send did not reach /api/chat");
  const first = profileProxy.requests[0];
  check(
    first.body.attachments?.[0]?.name === "trip-notes.txt" &&
      (await chatsFor(page, sydney.id)).some((chat) =>
        chat.messages.some((message) => message.attachments?.[0]?.name === "trip-notes.txt"),
      ),
    "Trip home forwards and saves the first message attachment",
  );
  check(
    await page
      .locator(".chat .composer textarea")
      .evaluate((element) => document.activeElement === element),
    "first send transfers keyboard focus into the new Chat composer",
  );
  check(profileProxy.requests.length === 1, "the first Enter starts exactly one request");
  check(
    first.body.message === "Plan a quiet harbour walk",
    "the request carries the composer message exactly once",
    first.body.message,
  );
  check(
    first.body.plan?.tripId === "sydney" &&
      first.body.plan.sections
        .flatMap((section) => section.proposal?.items ?? [])
        .some((item) => item.id === "Opera House") &&
      first.body.brief?.destination === "Sydney" &&
      first.body.known === undefined,
    "the first request uses the explicit current Trip snapshot",
    {
      tripId: first.body.plan?.tripId,
      known: first.body.known,
      destination: first.body.brief?.destination,
    },
  );
  const firstMessages = await page
    .locator(".msg-item--user")
    .getByText("Plan a quiet harbour walk", { exact: true })
    .count();
  check(firstMessages === 1, "the new Chat shows the first user message once", firstMessages);

  await waitForControlledProgress(page);
  await openTrips(page, label);
  await openHome(page, label, "Melbourne food weekend");
  check(
    profileProxy.requests.length === 1 && !first.aborted,
    "opening another Trip keeps the initiating generation alive",
    {
      requests: profileProxy.requests.length,
      aborted: first.aborted,
    },
  );
  await page.getByRole("button", { name: label.backTrips, exact: true }).click();
  await openHome(page, label, label.home);
  const firstRow = page
    .locator(".trip-home-chats__row")
    .filter({ hasText: /quiet harbour walk/i })
    .first();
  await firstRow.waitFor();
  await firstRow.click();
  await waitForControlledProgress(page);
  check(
    (await page
      .locator(".msg-item--user")
      .getByText("Plan a quiet harbour walk", { exact: true })
      .count()) === 1 &&
      profileProxy.requests.length === 1 &&
      !first.aborted,
    "returning to the initiating Chat restores its pending generation without resending",
  );
  first.release(sydneyPlan, "First reply");
  await within(first.settled, "first response completion");
  await page.getByText("First reply", { exact: true }).waitFor();

  await openHome(page, label, label.home);
  await sendWithEnter(page, label, "Find a late seafood dinner");
  await within(profileProxy.waitForCount(2), "failed request start");
  const second = profileProxy.requests[1];
  second.fail("Controlled Trip-home failure");
  await within(second.settled, "failed request settles");
  await page.getByRole("alert").filter({ hasText: "Controlled Trip-home failure" }).waitFor();
  const chatsAtFailure = await chatsFor(page, sydney.id);
  const failedChat = chatsAtFailure.find((chat) =>
    chat.messages.some((message) => message.text === "Find a late seafood dinner"),
  );
  check(
    chatsAtFailure.length === before.length + 2 &&
      failedChat?.messages.filter((message) => message.text === "Find a late seafood dinner")
        .length === 1,
    "a failed first send creates one Chat with one user message",
    {
      count: chatsAtFailure.length,
      users: failedChat?.messages.filter((message) => message.text === "Find a late seafood dinner")
        .length,
    },
  );
  await page.getByRole("button", { name: "Retry update", exact: true }).click();
  await within(profileProxy.waitForCount(3), "retry request start");
  const retry = profileProxy.requests[2];
  const afterRetry = await chatsFor(page, sydney.id);
  check(
    retry.body.message === second.body.message &&
      afterRetry.length === chatsAtFailure.length &&
      afterRetry
        .find((chat) => chat.id === failedChat?.id)
        ?.messages.filter((message) => message.text === "Find a late seafood dinner").length === 1,
    "Retry reuses the failed Chat without duplicating the Chat or user message",
    { count: afterRetry.length, message: retry.body.message },
  );
  retry.release(sydneyPlan, "Retry reply");
  await within(retry.settled, "retry completion");
  await openHome(page, label, label.home);
  await page.locator(".trip-home-chats").waitFor();

  const names = await rowNames(page);
  const firstCreated = names.find((name) => /quiet harbour walk/i.test(name));
  const secondCreated = names.find((name) => /late seafood dinner/i.test(name));
  const firstDate = await page
    .locator(".trip-home-chats__row")
    .filter({ hasText: /quiet harbour walk/i })
    .locator("time")
    .innerText();
  const secondDate = await page
    .locator(".trip-home-chats__row")
    .filter({ hasText: /late seafood dinner/i })
    .locator("time")
    .innerText();
  check(
    Boolean(firstCreated && secondCreated && firstCreated !== secondCreated),
    "two same-day Chats have distinct message-derived summaries",
    { firstCreated, secondCreated },
  );
  check(
    names.includes("Saved Chat 1"),
    "creating Trip-home Chats preserves a manually named Chat",
    names.slice(0, 4),
  );
  check(
    firstDate === secondDate && firstDate.length > 0,
    "same-day Chats keep a localized date while summaries distinguish them",
    { firstDate, secondDate },
  );
  check(
    profileProxy.requests.length === 3 &&
      profileProxy.requests.filter(
        (request) => request.body.message === "Plan a quiet harbour walk",
      ).length === 1 &&
      profileProxy.requests.filter(
        (request) => request.body.message === "Find a late seafood dinner",
      ).length === 2,
    "atomic creation, retry and navigation neither lose nor duplicate requests",
    profileProxy.requests.map((request) => request.body.message),
  );
  await page.screenshot({ path: `${OUT}/desktop-1440-en.png` });
}

async function runDismissalStorage(page, label) {
  const key = "trip-home-suggestion-dismissals-v1";
  await page.evaluate((name) => localStorage.setItem(name, "null"), key);
  await openHome(page, label, label.home);
  const suggestion = page.locator(".trip-home").getByRole("region", { name: "Trip suggestion" });
  await suggestion.waitFor();
  check(true, "a null suggestion-dismissal record degrades safely");
  await page.evaluate((name) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (item, value) {
      if (item === name) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return setItem.call(this, item, value);
    };
  }, key);
  await suggestion.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Dismissed for this visit; could not save." })
    .waitFor();
  check(
    (await suggestion.count()) === 0,
    "a quota failure dismisses for this visit and reports persistence failure",
  );
}

async function runIdeasParity(page, label) {
  await openHome(page, label, label.home);
  const home = page.locator(".trip-home");
  const ideasAction = home
    .getByRole("list", { name: "Trip actions" })
    .getByRole("button", { name: /^Ideas/ });
  const cardText = await ideasAction.innerText();
  const suggestion = home.getByRole("region", { name: "Trip suggestion" });
  const suggestionText = await suggestion.innerText();
  check(
    (await ideasAction.locator(".trip-home-card__count").innerText()) === "2" &&
      suggestionText.includes("2 unscheduled ideas") &&
      suggestionText.includes("Sydney"),
    "the suggestion and Ideas count use the same unscheduled activity and restaurant rule",
    { cardText, suggestionText },
  );

  await ideasAction.click();
  const ideas = page.getByRole("dialog", { name: "Ideas", exact: true });
  await ideas.waitFor();
  const list = ideas.getByRole("list", { name: "Unscheduled suggestions" });
  await list.getByText("Surry Hills bakery", { exact: true }).waitFor();
  check(
    (await list.getByRole("listitem").count()) === 2 &&
      (await list.getByText("Surry Hills bakery", { exact: true }).count()) === 1 &&
      (await list.getByText("Sydney fish restaurant", { exact: true }).count()) === 1,
    "the Ideas list contains the activity and restaurant counted by the suggestion",
    await list.innerText(),
  );
  await page.keyboard.press("Escape");
  await ideas.waitFor({ state: "hidden" });
  await suggestion.getByRole("button", { name: "Place them", exact: true }).click();
  await within(profileProxy.waitForCount(1), "suggestion request start");
  const request = profileProxy.requests[0];
  check(
    request.body.message.includes("2 unscheduled ideas") && request.body.message.includes("Sydney"),
    "choosing the suggestion sends its matching two-Idea prompt into one linked Chat",
    request.body.message,
  );
  request.release(sydneyPlan, "Ideas reply");
  await within(request.settled, "Ideas reply completion");
  await page.screenshot({ path: `${OUT}/ideas-parity.png` });
}

async function runConcurrentTrips(page, label) {
  await openHome(page, label, label.home);
  await sendWithEnter(page, label, "Sydney concurrent walk");
  await within(profileProxy.waitForCount(1), "Sydney pending request");
  const first = profileProxy.requests[0];
  await waitForControlledProgress(page);
  await openTrips(page, label);
  await openHome(page, label, "Melbourne food weekend");
  await composer(page, label).fill("Melbourne concurrent dinner");
  const enabled = await page.getByRole("button", { name: label.send, exact: true }).isEnabled();
  check(enabled, "a pending generation in another Trip leaves this Trip's first send enabled");
  if (!enabled) return;
  await composer(page, label).press("Enter");
  await within(profileProxy.waitForCount(2), "Melbourne concurrent request");
  const second = profileProxy.requests[1];
  check(
    second.body.plan?.tripId === "melbourne" && !first.aborted,
    "different Trips start their own requests without cancelling the first Chat",
  );
  first.release(sydneyPlan, "Sydney concurrent reply");
  second.release(melbourne.snapshot.plan, "Melbourne concurrent reply");
  await within(Promise.all([first.settled, second.settled]), "concurrent replies");
  await page.getByText("Melbourne concurrent reply", { exact: true }).waitFor();
  check(
    (await page.getByText("Sydney concurrent reply", { exact: true }).count()) === 0,
    "a background reply stays out of the other Trip's visible Chat",
  );
  await openTrips(page, label);
  await openHome(page, label, label.home);
  await page.locator(".trip-home-chats__row").filter({ hasText: "Sydney concurrent walk" }).click();
  await page.getByText("Sydney concurrent reply", { exact: true }).waitFor();
  check(!first.aborted, "returning to the initiating Chat shows its completed background reply");
  await page.screenshot({ path: `${OUT}/concurrent-trips.png` });
}

async function runResponsiveOnly(page, label, profile) {
  await openHome(page, label, label.home);
  const box = page.locator(".trip-home__composer");
  await box.waitFor();
  check(
    (await box.locator(".composer .composer__row .composer__add").count()) === 1 &&
      (await box.locator(".composer__primary").count()) === 1 &&
      (await box.locator(".composer__file-input").isEnabled()),
    "Trip home uses Chat's composer, upload and primary controls",
  );
  await checkHomeLayout(page, check);
  const field = composer(page);
  await field.fill("line one\nline two\nline three\nline four");
  await within(
    page.waitForFunction(() => {
      const field = document.querySelector(".trip-home__composer textarea");
      return field && field.clientHeight > 60;
    }),
    "shared composer grows with multiline text",
  );
  await field.fill("@");
  await box.getByRole("listbox").waitFor();
  await field.press("ArrowDown");
  await field.press("Enter");
  check(
    (await field.inputValue()).startsWith("@") &&
      (await field.inputValue()).length > 2 &&
      profileProxy.requests.length === 0,
    "choosing an agent uses Chat's mention menu without sending",
  );
  await field.fill("");
  await within(
    page.waitForFunction(() => {
      const field = document.querySelector(".trip-home__composer textarea");
      return field && !field.value && field.clientHeight <= 44;
    }),
    "shared composer shrinks after clearing multiline text",
  );
  const rect = await box.boundingBox();
  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(
    rect !== null &&
      rect.y >= 0 &&
      rect.y + rect.height <= profile.viewport.height + 1 &&
      (profile.phone ? rect.width >= profile.viewport.width * 0.8 : rect.width >= 280),
    `${profile.name} keeps a usable bottom composer inside the viewport`,
    rect,
  );
  check(
    layout.scrollWidth === layout.width,
    `${profile.name} has no horizontal page overflow`,
    layout,
  );
  check(
    (await page.getByRole("button", { name: label.backTrips, exact: true }).count()) === 1,
    `${profile.name} preserves the existing Trip navigation affordance`,
  );
  check(
    (await page.getByRole("button", { name: label.start, exact: true }).count()) === 0,
    `${profile.name} has no separate Start chat action`,
  );
  const sendButton = page.getByRole("button", { name: label.send, exact: true });
  check(await sendButton.isDisabled(), `${profile.name} disables Send for an empty composer`);
  await page.screenshot({
    path: `${OUT}/${profile.name.replaceAll(" ", "-")}-home-composer.png`,
  });
  await sendWithEnter(
    page,
    label,
    profile.language === "zh" ? "安排安静的港口散步" : "Plan a short evening walk",
  );
  await within(profileProxy.waitForCount(1), `${profile.name} first send`);
  check(
    profileProxy.requests[0].body.plan?.tripId === "sydney" &&
      profileProxy.requests[0].body.known === undefined,
    `${profile.name} first request keeps the Trip snapshot`,
    {
      tripId: profileProxy.requests[0].body.plan?.tripId,
      known: profileProxy.requests[0].body.known,
    },
  );
  check(
    (await page
      .locator(".msg-item--user")
      .getByText(profile.language === "zh" ? "安排安静的港口散步" : "Plan a short evening walk", {
        exact: true,
      })
      .count()) === 1,
    `${profile.name} opens the new Chat with one user message`,
  );
  await page.locator(".workspace-shell:not(.workspace-shell--trips)").waitFor();
  check(
    (await page.locator(".trip-home").count()) === 0,
    `${profile.name} opens the independent Chat workspace`,
  );
  const chat = page.locator(".chat");
  const userMessage = chat.getByText(
    profile.language === "zh" ? "安排安静的港口散步" : "Plan a short evening walk",
    { exact: true },
  );
  if (profile.phone) {
    const chatRect = await chat.boundingBox();
    const messageRect = await userMessage.boundingBox();
    check(
      chatRect !== null &&
        messageRect !== null &&
        chatRect.y >= 0 &&
        messageRect.y >= 0 &&
        messageRect.y + messageRect.height <= profile.viewport.height + 1,
      `${profile.name} opens at the new Chat instead of leaving it below Trip home`,
      { chatRect, messageRect },
    );
  }
  const chatComposer = chat.locator(".composer");
  const chatComposerRect = await chatComposer.boundingBox();
  check(
    chatComposerRect !== null &&
      chatComposerRect.y >= 0 &&
      chatComposerRect.y + chatComposerRect.height <= profile.viewport.height + 1,
    `${profile.name} keeps the opened Chat composer reachable without clipping`,
    chatComposerRect,
  );
  profileProxy.requests[0].release(
    plan({ id: "sydney", destination: "Sydney", items: sydneyItems }),
    "Responsive reply",
  );
  await within(profileProxy.requests[0].settled, `${profile.name} response completion`);
  if (profile.phone) {
    const replyComposer = chat.locator(".composer textarea");
    await replyComposer.click();
    await replyComposer.pressSequentially("Phone reply");
    check(
      (await replyComposer.inputValue()) === "Phone reply" &&
        (await replyComposer.evaluate((element) => document.activeElement === element)),
      `${profile.name} can focus and type in the reachable Chat composer`,
      await replyComposer.inputValue(),
    );
  }
  await page.screenshot({
    path: `${OUT}/${profile.name.replaceAll(" ", "-")}.png`,
  });
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

let profileProxy;
try {
  for (const profile of profiles) {
    profileName = profile.name;
    profileProxy = controlledProxy(BASE, within);
    const proxyUrl = await profileProxy.listen();
    const context = await browser.newContext({
      viewport: profile.viewport,
      reducedMotion: "reduce",
      locale: profile.language === "zh" ? "zh-CN" : "en-AU",
      timezoneId: "Australia/Sydney",
      ...(profile.phone ? { hasTouch: true, isMobile: true } : {}),
    });
    await context.addInitScript(
      ({ catalog, settings, seed }) => {
        if (localStorage.getItem(seed)) return;
        localStorage.setItem(seed, "1");
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(catalog));
        localStorage.setItem("trip.settings.v1", JSON.stringify(settings));
      },
      {
        catalog,
        settings: {
          ...settings,
          language: profile.language,
        },
        seed: `trip-home-send-${profile.name}`,
      },
    );
    const page = await context.newPage();
    current = page;
    page.setDefaultTimeout(WAIT);
    page.setDefaultNavigationTimeout(WAIT);
    page.on("pageerror", (error) => browserErrors.push(`${profile.name}: ${String(error)}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`${profile.name}: ${message.text()}`);
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(proxyUrl).origin) return route.continue();
      externalRequests.push(`${profile.name}: ${url.href}`);
      return route.abort();
    });
    await page.goto(proxyUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const label = labels[profile.language];
    if (profile.primary) await runPrimary(page, label);
    else if (profile.ideas) await runIdeasParity(page, label);
    else if (profile.dismissal) await runDismissalStorage(page, label);
    else if (profile.concurrent) await runConcurrentTrips(page, label);
    else await runResponsiveOnly(page, label, profile);
    await context.close();
    await profileProxy.close();
    profileProxy = undefined;
  }
  check(browserErrors.length === 0, "all profiles have no page or console errors", browserErrors);
  check(externalRequests.length === 0, "all profiles make no external requests", externalRequests);
} catch (error) {
  check(false, "journey completes", {
    error: String(error),
    browserErrors,
  });
  await current?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
} finally {
  await profileProxy?.close();
  await browser.close();
  writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        results,
        browserErrors,
        externalRequests,
        fixture: "local catalog; controlled local /api/chat NDJSON; external requests blocked",
      },
      null,
      2,
    ),
  );
}

process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
