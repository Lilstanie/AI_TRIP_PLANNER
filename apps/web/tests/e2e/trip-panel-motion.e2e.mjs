import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3114";
const OUT = resolve("output/playwright/trip-panel-motion", process.env.LABEL ?? "before");
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, name, observed) => {
  checks.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const savedAt = new Date(0).toISOString();
const act = (id, detail, startTime, endTime, estCost) => ({
  id,
  kind: "activity",
  detail,
  location: detail,
  day: 1,
  startTime,
  endTime,
  estCost,
});
const guide = {
  id: "destination-guide",
  label: "Destination guide",
  summary: "Guide fixture",
  status: "draft",
  estCost: 0,
  proposal: {
    agent: "destination-guide",
    summary: "Guide fixture",
    assumptions: [],
    conflictsWith: [],
    items: [
      { id: "tip-1", kind: "customs", detail: "Tipping is not expected in Sydney." },
      { id: "tip-2", kind: "safety", detail: "Swim between the flags at patrolled beaches." },
      { id: "tip-3", kind: "note", detail: "Public transport uses an Opal card." },
    ],
  },
};
const itinerary = {
  id: "itinerary",
  label: "Day plan",
  summary: "Plan fixture",
  status: "draft",
  estCost: 120,
  proposal: {
    agent: "itinerary",
    summary: "Plan fixture",
    assumptions: [],
    conflictsWith: [],
    items: [
      act("a1", "Sydney Opera House", "09:00", "11:00", 80),
      act("a2", "Royal Botanic Garden", "11:30", "13:00", 0),
      act("a3", "Bondi Beach", "14:00", "16:00", 40),
    ],
  },
};
const plan = {
  tripId: "trip-panel-motion-fixture",
  brief: {
    tripId: "trip-panel-motion-fixture",
    userId: "e2e",
    destination: "Sydney",
    dates: ["2026-12-16", "2026-12-17"],
    groupSize: 2,
    budgetTotal: 600,
    displayCurrency: "AUD",
  },
  round: 1,
  budgetTotal: 600,
  estTotal: 120,
  overrunPct: 0,
  sections: [guide, itinerary],
  conflicts: [],
};
const snapshot = {
  version: 4,
  id: plan.tripId,
  savedAt,
  plan,
  draft: {
    destination: "Sydney",
    origin: "",
    start: plan.brief.dates[0],
    end: plan.brief.dates[1],
    groupSize: "2",
    budgetTotal: "600",
    preferences: [],
    nationality: "",
    roomAllocation: "shared",
    minRating: "0",
    freeCancellation: false,
  },
  messages: [
    { role: "user", text: "Create a fixture trip." },
    { role: "agent", text: "Ready." },
  ],
  input: "",
};
const conversationId = "conversation:trip-panel-motion-fixture";
const tripId = "trip:trip-panel-motion-fixture";
const TITLE = "Sydney motion fixture";
const catalog = {
  version: 4,
  activeConversationId: conversationId,
  activeTripId: tripId,
  conversations: [
    {
      id: conversationId,
      title: TITLE,
      updatedAt: savedAt,
      tripId,
      messages: snapshot.messages,
      input: "",
      snapshot,
    },
  ],
  trips: [
    { id: tripId, title: TITLE, updatedAt: savedAt, conversationIds: [conversationId], snapshot },
  ],
  layout: {
    sidebar: { collapsed: false },
    preferences: { width: 280 },
    trip: { width: 340 },
    view: "chat",
    editorView: "map",
  },
};
const settings = {
  version: 1,
  travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
  memberships: [],
  assistant: { style: "neutral", memory: true },
  dataMode: "mock",
  appearance: "system",
  language: "en",
  displayCurrency: "AUD",
  updatedAt: savedAt,
};

const TRIGGERS = {
  budget: ".trip-panel__budget-summary > summary",
  tips: ".trip-tips > summary",
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const errors = [];

async function openPanel(size, reducedMotion, phone) {
  const context = await browser.newContext({
    viewport: size,
    reducedMotion,
    ...(phone ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(
    ({ seed, userSettings }) => {
      localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed));
      localStorage.setItem("trip.settings.v1", JSON.stringify(userSettings));
    },
    { seed: catalog, userSettings: settings },
  );
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.locator(".workspace-app").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (phone) {
    await page.getByRole("tab", { name: "Mine", exact: true }).click();
    await page.locator(`.history-item__open[title="${TITLE}"]`).click();
    await page.getByRole("tab", { name: /^Trip/ }).click();
  } else {
    await page.getByRole("button", { name: /^Chats/ }).click();
    await page.locator(`.history-item__open[title="${TITLE}"]`).click();
    const openTrip = page.getByRole("button", { name: "Open your trip" });
    await openTrip.or(page.locator(".trip-panel:visible")).first().waitFor();
    if (await openTrip.count()) await openTrip.click();
  }
  await page.locator(".trip-panel").waitFor();
  return { context, page };
}

const motionOf = (page, selector) =>
  page.evaluate((sel) => {
    const content = getComputedStyle(
      document.querySelector(sel).parentElement,
      "::details-content",
    );
    return {
      property: content.transitionProperty,
      duration: content.transitionDuration,
      easing: content.transitionTimingFunction,
    };
  }, selector);

const contentHeight = (page, selector) =>
  page.evaluate((sel) => {
    const details = document.querySelector(sel).parentElement;
    const trigger = details.querySelector(":scope > summary").getBoundingClientRect();
    return Math.round(details.getBoundingClientRect().bottom - trigger.bottom);
  }, selector);

const belowTop = (page, selector) =>
  page.evaluate((sel) => {
    const details = document.querySelector(sel).parentElement;
    const trigger = details.querySelector(":scope > summary").getBoundingClientRect();
    return Math.round(details.getBoundingClientRect().bottom - trigger.top);
  }, selector);

async function run(label, size, phone) {
  const { context, page } = await openPanel(size, "no-preference", phone);
  const results = { label };
  const order = await page.evaluate(() => {
    const panel = document.querySelector(".trip-panel");
    const rect = (selector) => panel.querySelector(selector)?.getBoundingClientRect().top ?? -1;
    return {
      sub: rect(".trip__sub"),
      budget: rect(".trip-panel__budget-summary"),
      stop: rect(".timeline-stop"),
    };
  });
  results.order = order;
  check(
    order.sub >= 0 && order.budget > order.sub && order.stop > order.budget,
    `${label}: title, budget summary line, then the day plan`,
    order,
  );
  await page.screenshot({ path: `${OUT}/${label}-closed.png` });

  for (const [name, selector] of Object.entries(TRIGGERS)) {
    const trigger = page.locator(selector);
    await trigger.scrollIntoViewIfNeeded();
    const motion = await motionOf(page, selector);
    results[name] = { motion };
    check(
      /^[\d.]+m?s/.test(motion.duration) && !/^0s/.test(motion.duration),
      `${label}: ${name} disclosure animates`,
      motion,
    );
    const closedHeight = await contentHeight(page, selector);
    const before = await belowTop(page, selector);
    await trigger.click();
    const samples = [];
    for (let index = 0; index < 8; index += 1) {
      samples.push({
        height: await contentHeight(page, selector),
        below: await belowTop(page, selector),
      });
      if (index === 2) await page.screenshot({ path: `${OUT}/${label}-${name}-mid.png` });
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(600);
    const openHeight = await contentHeight(page, selector);
    const after = await belowTop(page, selector);
    await page.screenshot({ path: `${OUT}/${label}-${name}-open.png` });
    const heights = samples.map((sample) => sample.height);
    check(openHeight > closedHeight + 20, `${label}: ${name} opens`, { closedHeight, openHeight });
    check(
      heights.some((height) => height > closedHeight + 2 && height < openHeight - 2),
      `${label}: ${name} has frames between closed and open`,
      heights,
    );
    check(
      heights.every((height, index) => index === 0 || height >= heights[index - 1]) &&
        heights.every((height) => height <= openHeight + 1),
      `${label}: ${name} grows without overshoot or flicker`,
      heights,
    );
    const belowSamples = samples.map((sample) => sample.below);
    check(
      after > before && belowSamples.every((top) => top >= before - 1 && top <= after + 1),
      `${label}: ${name} content below moves down once, never past its final place`,
      { before, after, belowSamples },
    );
    results[name] = { ...results[name], closedHeight, openHeight, heights, belowSamples };
    await trigger.click();
    const closing = [];
    for (let index = 0; index < 8; index += 1) {
      closing.push(await contentHeight(page, selector));
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(600);
    const closed = await contentHeight(page, selector);
    check(
      closing.some((height) => height > closed + 2 && height < openHeight - 2) &&
        closing.every((height, index) => index === 0 || height <= closing[index - 1]),
      `${label}: ${name} closes with motion`,
      { closing, closed },
    );
    check(
      Math.abs(closed - closedHeight) <= 1,
      `${label}: ${name} returns to closed height`,
      closed,
    );
  }
  check(
    results.budget.motion.duration === results.tips.motion.duration &&
      results.budget.motion.easing === results.tips.motion.easing,
    `${label}: budget and tips share duration and easing`,
    [results.budget.motion, results.tips.motion],
  );
  await context.close();

  const reduced = await openPanel(size, "reduce", phone);
  for (const [name, selector] of Object.entries(TRIGGERS)) {
    const trigger = reduced.page.locator(selector);
    await trigger.scrollIntoViewIfNeeded();
    const closedHeight = await contentHeight(reduced.page, selector);
    await trigger.click();
    const openHeight = await contentHeight(reduced.page, selector);
    await trigger.click();
    const closedAgain = await contentHeight(reduced.page, selector);
    check(
      openHeight > closedHeight + 20 && Math.abs(closedAgain - closedHeight) <= 1,
      `${label}: reduced motion ${name} switches instantly`,
      { closedHeight, openHeight, closedAgain },
    );
    results[`${name}Reduced`] = { closedHeight, openHeight, closedAgain };
  }
  await reduced.context.close();
  return results;
}

const results = [];
try {
  results.push(await run("desktop-1440", { width: 1440, height: 1000 }, false));
  results.push(await run("phone-390x844", { width: 390, height: 844 }, true));
} finally {
  await browser.close();
}
check(errors.length === 0, "no page errors", errors);
writeFileSync(`${OUT}/results.json`, JSON.stringify({ checks, results }, null, 2));
console.log(`artifact: ${OUT}/results.json`);
process.exit(checks.some((entry) => !entry.ok) ? 1 : 0);
