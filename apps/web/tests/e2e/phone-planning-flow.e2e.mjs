import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-planning-flow", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const copy = {
  en: {
    send: "Send",
    exampleTrips: "Example trips",
    chat: /^Chat/,
    trip: /^Trip/,
    thinking: "Thinking process",
    preparing: "Preparing your request.",
    working: /Working with Day plan/,
    retry: "Retry update",
    planningFailed: "Planning failed. Please retry.",
    openTrip: "Open trip",
    yourTrip: "Your trip",
    tripDetails: /^Trip details:/,
    tripDetailsDialog: "Trip details",
  },
  zh: {
    send: "发送",
    exampleTrips: "示例行程",
    chat: /^聊天/,
    trip: /^行程/,
    thinking: "思考过程",
    preparing: "正在准备你的请求。",
    working: /正在与.*协作/,
    retry: "重试更新",
    planningFailed: "规划失败，请重试。",
    openTrip: "打开行程",
    yourTrip: "你的行程",
    tripDetails: /^行程信息：/,
    tripDetailsDialog: "行程信息",
  },
};

const plan = {
  tripId: "e2e-phone-planning",
  brief: {
    tripId: "e2e-phone-planning",
    userId: "local",
    destination: "Sydney",
    dates: ["2026-11-10", "2026-11-14"],
    groupSize: 2,
    budgetTotal: 4000,
  },
  round: 1,
  budgetTotal: 4000,
  estTotal: 200,
  overrunPct: -95,
  sections: [
    {
      id: "itinerary",
      label: "Day plan",
      status: "draft",
      summary: "Museum visit",
      estCost: 200,
      proposal: {
        agent: "itinerary",
        summary: "Museum visit",
        items: [{ kind: "activity", detail: "Museum", estCost: 200 }],
        assumptions: [],
        conflictsWith: [],
      },
    },
  ],
};

const settings = (language) =>
  JSON.stringify({
    version: 1,
    travel: { homeCity: "", preferences: [] },
    language,
    dataMode: "mock",
    appearance: "system",
    updatedAt: "2026-10-26T00:00:00Z",
  });

async function dismissLocation(page, language) {
  const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
  await notNow.waitFor({ timeout: 5000 }).then(
    () => notNow.click(),
    () => {},
  );
}

async function openWorkspace(browser, language, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width <= 520,
    hasTouch: width <= 520,
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
  });
  await context.addInitScript(
    ({ value, width, height }) => {
      localStorage.setItem("trip.settings.v1", value);
      const viewport = new EventTarget();
      Object.assign(viewport, {
        height,
        width,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
      });
      window.__phoneViewport = viewport;
      Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
      const originalFetch = window.fetch.bind(window);
      window.__controlledChat = { requests: [], streams: [] };
      window.fetch = async (input, init) => {
        const request = input instanceof Request ? input : undefined;
        const url = new URL(request?.url ?? String(input), location.href);
        if (url.pathname !== "/api/chat") return originalFetch(input, init);
        const body = typeof init?.body === "string" ? init.body : await request?.text();
        window.__controlledChat.requests.push(JSON.parse(body ?? "{}"));
        let controller;
        const stream = new ReadableStream({
          start(next) {
            controller = next;
          },
        });
        const encoder = new TextEncoder();
        window.__controlledChat.streams.push({
          write(frame) {
            controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
          },
          close() {
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "application/x-ndjson" },
        });
      };
    },
    { value: settings(language), width, height },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await dismissLocation(page, language);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page, errors };
}

const composer = (page) => page.locator(".composer textarea, .composer__input, textarea").first();

async function waitForStream(page, index) {
  await page.waitForFunction(
    (expected) => window.__controlledChat.streams.length > expected,
    index,
  );
}

async function emit(page, index, frame) {
  await page.evaluate(
    ({ streamIndex, value }) => window.__controlledChat.streams[streamIndex].write(value),
    { streamIndex: index, value: frame },
  );
}

async function closeStream(page, index) {
  await page.evaluate((streamIndex) => window.__controlledChat.streams[streamIndex].close(), index);
}

async function requestCount(page) {
  return page.evaluate(() => window.__controlledChat.requests.length);
}

async function setSimulatedViewport(page, height, offsetTop = 0) {
  await page.evaluate(
    ({ nextHeight, nextOffsetTop }) => {
      window.__phoneViewport.height = nextHeight;
      window.__phoneViewport.offsetTop = nextOffsetTop;
      window.__phoneViewport.dispatchEvent(new Event("resize"));
    },
    { nextHeight: height, nextOffsetTop: offsetTop },
  );
  await page.waitForFunction(
    ({ nextHeight, nextOffsetTop }) => {
      const app = document.querySelector(".workspace-app");
      return (
        app?.style.getPropertyValue("--phone-viewport-height") === `${nextHeight}px` &&
        app?.style.getPropertyValue("--phone-viewport-top") === `${nextOffsetTop}px`
      );
    },
    { nextHeight: height, nextOffsetTop: offsetTop },
  );
}

async function noHorizontalOverflow(page, name) {
  const observed = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(observed.scrollWidth === observed.width, name, observed);
}

async function controlIsReachable(page, name, locator, height = page.viewportSize().height) {
  const box = await locator.boundingBox();
  check(
    Boolean(box) &&
      box.x >= -1 &&
      box.x + box.width <= page.viewportSize().width + 1 &&
      box.y >= -1 &&
      box.y + box.height <= height + 1,
    name,
    box,
  );
}

async function checkCompactTitle(page, language) {
  const title = page.getByRole("button", { name: copy[language].tripDetails });
  await title.waitFor();
  check(await title.isVisible(), `${language}: compact Trip summary is visible`);
  await title.click();
  const sheet = page.getByRole("dialog", { name: copy[language].tripDetailsDialog, exact: true });
  await sheet.waitFor();
  check(await sheet.isVisible(), `${language}: compact Trip summary opens Brief details`);
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
}

async function runPlanningFlow(browser, language, width, height) {
  const { context, page, errors } = await openWorkspace(browser, language, width, height);
  const labels = copy[language];
  await page.getByRole("tab", { name: labels.chat }).click();

  const examples = page.getByLabel(labels.exampleTrips);
  await examples.waitFor();
  const exampleCount = await examples.getByRole("button").count();
  check(
    exampleCount > 0 && exampleCount <= 2,
    `${language}: blank chat shows at most two examples`,
    {
      exampleCount,
    },
  );
  await controlIsReachable(
    page,
    `${language}: blank composer stays reachable`,
    composer(page),
    height,
  );
  await controlIsReachable(
    page,
    `${language}: blank Send stays reachable`,
    page.getByRole("button", { name: labels.send, exact: true }),
    height,
  );
  await noHorizontalOverflow(page, `${language}: blank chat has no horizontal overflow`);
  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-blank.png` });

  const initialRequest = "Plan a fixture trip to Sydney";
  await composer(page).fill(initialRequest);
  await page.getByRole("button", { name: labels.send, exact: true }).click();
  await waitForStream(page, 0);
  await page.locator('.workspace-shell[aria-busy="true"]').waitFor();
  await page.getByText(labels.preparing, { exact: true }).waitFor();
  check(
    (await page.getByLabel(labels.thinking).count()) >= 1,
    `${language}: coordinator progress remains in Chat while busy`,
  );

  await emit(page, 0, {
    type: "coordinator",
    phase: "dispatch",
    round: 1,
    summary: "Coordinator fixture dispatch.",
  });
  await emit(page, 0, {
    type: "agent_started",
    agent: "itinerary",
    round: 1,
    summary: "Specialist fixture progress.",
  });
  await page.getByText(labels.working).waitFor();
  check(
    (await page.locator('.workspace-shell[aria-busy="true"]').count()) === 1,
    `${language}: specialist progress remains visible while planning`,
  );
  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-progress.png` });

  await emit(page, 0, { type: "error", message: "Synthetic initial failure." });
  await closeStream(page, 0);
  await page.locator(".error-banner").filter({ hasText: labels.planningFailed }).waitFor();
  check(
    (await composer(page).inputValue()) === initialRequest,
    `${language}: initial failure restores submitted text`,
    await composer(page).inputValue(),
  );
  check(
    (await requestCount(page)) === 1,
    `${language}: initial failure does not retry automatically`,
    await requestCount(page),
  );
  const retry = page.getByRole("button", { name: labels.retry, exact: true });
  await retry.waitFor();
  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-initial-failure.png` });
  await retry.click();
  await waitForStream(page, 1);
  check(
    (await requestCount(page)) === 2,
    `${language}: Retry update explicitly starts one new request`,
    await requestCount(page),
  );
  await emit(page, 1, {
    type: "complete",
    response: { reply: "Here is your Sydney fixture plan.", plan },
  });
  await closeStream(page, 1);
  await page.getByText("Here is your Sydney fixture plan.", { exact: true }).waitFor();
  check(
    (await page.getByRole("tab", { name: labels.chat }).getAttribute("aria-selected")) === "true",
    `${language}: completion keeps Chat active`,
  );
  check(
    (await page.getByRole("button", { name: labels.openTrip, exact: true }).count()) === 1,
    `${language}: completion exposes one explicit Open trip action`,
  );
  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-complete.png` });

  await checkCompactTitle(page, language);
  await page.getByRole("button", { name: labels.openTrip, exact: true }).click();
  await page.getByRole("tab", { name: labels.trip }).waitFor();
  check(
    (await page.getByRole("tab", { name: labels.trip }).getAttribute("aria-selected")) === "true",
    `${language}: Open trip opens the updated Plan`,
  );
  await page.getByRole("tab", { name: labels.chat }).click();

  await composer(page).fill("Revise the fixture plan");
  await page.getByRole("button", { name: labels.send, exact: true }).click();
  await waitForStream(page, 2);
  await emit(page, 2, {
    type: "coordinator",
    phase: "revision",
    round: 2,
    summary: "Revising the fixture Plan.",
  });
  await emit(page, 2, { type: "error", message: "Synthetic revision failure." });
  await closeStream(page, 2);
  await page.locator(".error-banner").filter({ hasText: labels.planningFailed }).waitFor();
  check(
    (await requestCount(page)) === 3,
    `${language}: revision failure does not retry automatically`,
    await requestCount(page),
  );
  await page.getByRole("button", { name: labels.openTrip, exact: true }).last().click();
  await page.getByRole("tab", { name: labels.trip }).waitFor();
  check(
    (await page.getByRole("heading", { name: labels.yourTrip, exact: true }).isVisible()) &&
      (await page.getByText("AUD 200.00", { exact: true }).first().isVisible()),
    `${language}: revision failure keeps the previous Plan readable`,
  );
  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-revision-failure.png` });
  await page.getByRole("tab", { name: labels.chat }).click();
  await page.getByRole("button", { name: labels.retry, exact: true }).click();
  await waitForStream(page, 3);
  check(
    (await requestCount(page)) === 4,
    `${language}: revision Retry update starts one new request`,
    await requestCount(page),
  );
  await closeStream(page, 3);

  await noHorizontalOverflow(page, `${language}: completed flow has no horizontal overflow`);
  check(errors.length === 0, `${language}: no page errors`, errors);
  await context.close();
}

async function checkViewport(browser, language, width, height) {
  const { context, page, errors } = await openWorkspace(browser, language, width, height);
  const phone = width <= 520;
  if (phone) await page.getByRole("tab", { name: copy[language].chat }).click();
  const examples = page.getByLabel(copy[language].exampleTrips);
  await examples.waitFor();
  const count = await examples.getByRole("button").count();
  if (phone) {
    check(count > 0 && count <= 2, `${language}: ${width}x${height} stays at two examples`, {
      count,
    });
  } else {
    check(count > 0, `${language}: ${width}x${height} keeps examples`, { count });
  }
  await controlIsReachable(
    page,
    `${language}: ${width}x${height} composer is reachable`,
    composer(page),
    height,
  );
  await controlIsReachable(
    page,
    `${language}: ${width}x${height} Send is reachable`,
    page.getByRole("button", { name: copy[language].send, exact: true }),
    height,
  );
  await noHorizontalOverflow(page, `${language}: ${width}x${height} has no horizontal overflow`);

  if (width === 360 && height === 800) {
    await composer(page).focus();
    await setSimulatedViewport(page, 430);
    await controlIsReachable(
      page,
      `${language}: contracted viewport keeps composer reachable`,
      composer(page),
      430,
    );
    await controlIsReachable(
      page,
      `${language}: contracted viewport keeps Send reachable`,
      page.getByRole("button", { name: copy[language].send, exact: true }),
      430,
    );
    await noHorizontalOverflow(page, `${language}: contracted viewport has no horizontal overflow`);
    await composer(page).evaluate((node) => node.blur());
    await setSimulatedViewport(page, height);
  }

  await page.screenshot({ path: `${OUT}/${language}-${width}x${height}-layout.png` });
  check(errors.length === 0, `${language}: ${width}x${height} has no page errors`, errors);
  await context.close();
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  await runPlanningFlow(browser, "en", 360, 800);
  await checkViewport(browser, "en", 360, 800);
  await checkViewport(browser, "en", 390, 844);
  await checkViewport(browser, "en", 520, 700);
  await checkViewport(browser, "en", 521, 700);
  await checkViewport(browser, "en", 1440, 1000);
  await runPlanningFlow(browser, "zh", 375, 667);
  await checkViewport(browser, "zh", 375, 667);
} catch (error) {
  check(false, "phone planning flow completes", String(error));
} finally {
  await browser.close();
  writeFileSync(
    `${OUT}/result.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE,
        fixtureOnly: true,
        results,
      },
      null,
      2,
    ),
  );
}
if (results.some(({ ok }) => !ok)) process.exit(1);
