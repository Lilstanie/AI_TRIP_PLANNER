// End-to-end walk through the phone shell (#174) with mock data at two phone sizes, plus a check
// that desktop and the 521–1000 px layout are untouched. Screenshots and summary.json land under
// output/playwright/phone-shell/ as a repeatable artifact.
//
// Failure inventory this script was written from:
// - the tab bar is missing, has the wrong tabs, or no tab (or more than one) is selected;
// - the top bar wraps to two rows, or still shows the menu, the chip row or the Chat/Map switch;
// - a tab shows the wrong panel, or more than one panel at once;
// - the Trip tab opens a drawer instead of showing Your Trip in place, or shows nothing before a
//   plan exists;
// - a tab or row target is smaller than 44 px, or the page scrolls sideways;
// - desktop or the 521–1000 px layout grows a tab bar or loses its own controls;
// - the browser console reports an error.
// Later sections (Mine, trip facts, map, keyboard, updates) add their own failures below.
//
//   pnpm --filter @trip/web dev            # in another terminal
//   [BASE_URL=http://localhost:3000] [PLAYWRIGHT=<path>] node apps/web/tests/e2e/phone-shell.e2e.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "output/playwright/phone-shell");
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);
const PHONES = [
  { tag: "iphone", width: 390, height: 844 },
  { tag: "android", width: 360, height: 800 },
];

async function open(browser, { width, height }, { touch = true } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  // Failed requests are not shell errors: mock mode has no Places key, so place lookups answer 502.
  page.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !m.text().startsWith("Failed to load resource") &&
      errors.push(m.text()),
  );
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.waitForLoadState("networkidle");
  // The dev server's floating indicator sits over the tab bar; errors still reach `errors`.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page, errors };
}

/** Switches to mock data wherever the toggle is (the top bar on wide screens, Mine on phones). */
async function useMockData(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const live = page.getByRole("button", { name: /^Live data/ });
    if (!(await live.count())) break;
    if (!(await live.first().isVisible())) await selectTab(page, "Mine");
    await live.first().click();
    await settle(page, 400);
  }
}

const tablist = (page) => page.getByRole("tablist", { name: "Workspace sections" });
const tab = (page, name) => tablist(page).getByRole("tab", { name: new RegExp(`^${name}`) });
async function selectTab(page, name) {
  await tab(page, name).click();
  await settle(page, 450);
}
const visiblePanels = (page) =>
  page
    .locator('.workspace-shell > [role="tabpanel"]:not([hidden])')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
/** Every visible target matching `selector` is at least 44 px tall and wide. */
const smallTargets = (page, selector) =>
  page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length)
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width < 44 || box.height < 44)
      .map((box) => `${Math.round(box.width)}x${Math.round(box.height)}`),
  );

async function plan(page) {
  await selectTab(page, "Chat");
  await page.locator(".chat-empty__suggestions button").first().click();
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
}

// ---- #175 shell ----
async function shell(page, tag) {
  const tabs = await tablist(page).getByRole("tab").allInnerTexts();
  check(
    tabs.map((label) => label.trim()).join(",") === "Chat,Map,Trip,Mine",
    `${tag}: tab bar has Chat, Map, Trip and Mine (${tabs.map((l) => l.trim()).join(", ")})`,
  );
  const selected = await tablist(page).locator('[role="tab"][aria-selected="true"]').count();
  check(selected === 1, `${tag}: exactly one tab is selected (${selected})`);
  const topbar = await page.locator(".workspace-topbar").boundingBox();
  check(topbar && topbar.height <= 64, `${tag}: top bar is one row (${topbar?.height}px)`);
  check(
    await page.locator(".phone-topbar__title").isVisible(),
    `${tag}: top bar shows the trip title`,
  );
  check(
    !(await page.getByRole("button", { name: "Open navigation" }).count()),
    `${tag}: no menu button`,
  );
  check(
    !(await page.getByRole("group", { name: "Workspace view" }).count()),
    `${tag}: no Chat/Map switch row`,
  );
  check(!(await page.locator(".fact-chips__scroller").isVisible()), `${tag}: no sideways chip row`);
  check(
    (await smallTargets(page, ".phone-tabbar__tab")).length === 0,
    `${tag}: every tab is at least 44 px`,
  );
  check(await noSideScroll(page), `${tag}: no horizontal page scroll`);
  await page.screenshot({ path: `${OUT}/${tag}-01-chat-empty.png` });

  // Before a plan the Trip tab explains where the plan comes from and leads back to Chat.
  await selectTab(page, "Trip");
  check(
    (await visiblePanels(page)).join() === "phone-panel-trip",
    `${tag}: Trip shows only its own panel`,
  );
  const toChat = page.getByRole("button", { name: "Plan in Chat" });
  check(await toChat.isVisible(), `${tag}: empty Trip tab offers Plan in Chat`);
  await page.screenshot({ path: `${OUT}/${tag}-02-trip-empty.png` });
  await toChat.click();
  await settle(page, 450);
  check(
    (await tab(page, "Chat").getAttribute("aria-selected")) === "true",
    `${tag}: Plan in Chat selects the Chat tab`,
  );

  await plan(page);
  await selectTab(page, "Trip");
  check(
    !(await page.locator(".workspace-drawer--trip").count()),
    `${tag}: no Trip drawer on a phone`,
  );
  const trip = page.locator("#phone-panel-trip");
  check(
    await trip.getByRole("tab", { name: "Itinerary" }).isVisible(),
    `${tag}: Trip tab shows Your Trip in place`,
  );
  check(await noSideScroll(page), `${tag}: Trip tab has no horizontal scroll`);
  await page.screenshot({ path: `${OUT}/${tag}-03-trip.png` });

  await selectTab(page, "Map");
  check((await visiblePanels(page)).join() === "phone-panel-map", `${tag}: Map shows only the map`);
  await page.screenshot({ path: `${OUT}/${tag}-04-map.png` });

  await selectTab(page, "Mine");
  check(
    (await visiblePanels(page)).join() === "phone-panel-mine",
    `${tag}: Mine shows only its own panel`,
  );
  await page.screenshot({ path: `${OUT}/${tag}-05-mine.png` });

  // Arrow keys move between tabs, as in a native tab bar.
  await tab(page, "Mine").focus();
  await page.keyboard.press("ArrowRight");
  await settle(page, 450);
  check(
    (await tab(page, "Chat").getAttribute("aria-selected")) === "true",
    `${tag}: ArrowRight from Mine wraps to Chat`,
  );
}

// ---- #177 Mine ----
async function mine(_page, _tag) {}

// ---- #178 trip facts sheet ----
async function facts(_page, _tag) {}

// ---- #179 map ----
async function map(_page, _tag) {}

// ---- #180 keyboard ----
async function keyboard(_page, _tag) {}

// ---- #181 updates, last tab and back ----
async function updates(_page, _tag) {}

async function wide(browser) {
  for (const { tag, width, height, switchRow } of [
    { tag: "desktop", width: 1280, height: 860, switchRow: false },
    { tag: "tablet", width: 800, height: 1000, switchRow: true },
  ]) {
    const { context, page, errors } = await open(browser, { width, height }, { touch: false });
    check(!(await page.locator(".phone-tabbar").count()), `${tag}: no tab bar`);
    check(
      await page.getByRole("button", { name: "Open your trip" }).isVisible(),
      `${tag}: Trip button still in the top bar`,
    );
    check(
      (await page.getByRole("group", { name: "Workspace view" }).count()) === (switchRow ? 1 : 0),
      `${tag}: Chat/Map switch ${switchRow ? "present" : "absent"} as before`,
    );
    await page.screenshot({ path: `${OUT}/${tag}-unchanged.png` });
    check(errors.length === 0, `${tag}: no console errors (${errors.join(" | ")})`);
    await context.close();
  }
}

const browser = await chromium.launch(
  process.env.CHANNEL ? { channel: process.env.CHANNEL } : undefined,
);
try {
  for (const size of PHONES) {
    const { context, page, errors } = await open(browser, size);
    await useMockData(page);
    await selectTab(page, "Chat");
    await shell(page, size.tag);
    await mine(page, size.tag);
    await facts(page, size.tag);
    await map(page, size.tag);
    await keyboard(page, size.tag);
    await updates(page, size.tag);
    check(errors.length === 0, `${size.tag}: no console errors (${errors.join(" | ")})`);
    await context.close();
  }
  await wide(browser);
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ base: BASE, results }, null, 2));
}
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
