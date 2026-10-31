import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { startExamplePlan } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-polish", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};
const settle = (page, ms = 500) => page.waitForTimeout(ms);

const COPY = {
  en: {
    chat: /^Chat/,
    trip: /^Trip/,
    mine: /^Mine/,
    trips: "Trips",
    settings: "Settings & account",
  },
  zh: { chat: /^聊天/, trip: /^行程/, mine: /^我的/, trips: "行程", settings: "设置与账户" },
};

async function open(browser, { width, height, language, scheme }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    ...(width <= 520 ? { isMobile: true, hasTouch: true } : {}),
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  await context.addInitScript((language) => {
    localStorage.setItem(
      "trip.settings.v1",
      JSON.stringify({
        version: 1,
        travel: { homeCity: "", preferences: [] },
        language,
        dataMode: "mock",
        appearance: "system",
        updatedAt: "2026-10-30T00:00:00Z",
      }),
    );
  }, language);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto(BASE);
  await page.waitForSelector(".workspace-app");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForLoadState("networkidle");
  return { context, page, errors };
}

const noSideScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const box = (locator) => locator.boundingBox();
const tab = (page, name) => page.locator(".phone-tabbar").getByRole("tab", { name });
const surfaceIsDark = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((node) => {
      const [r, g, b] = getComputedStyle(node).backgroundColor.match(/\d+/g).map(Number);
      return r + g + b < 200;
    });

async function phoneRun(browser, { width, height, language, scheme }) {
  const label = `${language}-${width}-${scheme}`;
  const copy = COPY[language];
  const { context, page, errors } = await open(browser, { width, height, language, scheme });
  const shot = (name) => page.screenshot({ path: `${OUT}/${label}-${name}.png` });

  await tab(page, copy.chat).click();
  await settle(page);
  const chips = page.locator(".chat .chat__facts .fact-chip");
  check((await chips.count()) >= 4, `${label}: Where, When, Who and Budget sit above the composer`);
  check(
    (await page.locator(".workspace-topbar .fact-chips").count()) === 0,
    `${label}: the top bar holds no second chip row`,
  );
  const row = await box(page.locator(".chat__facts"));
  const composer = await box(page.locator(".chat__form .composer"));
  check(row && composer && row.y < composer.y, `${label}: the chip row is above the composer`);
  const heights = await chips.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
  );
  check(Math.max(...heights) <= 44, `${label}: every chip label stays on one line`, heights);
  check(await noSideScroll(page), `${label}: no sideways page scroll on a new chat`);

  const tabbar = await box(page.locator(".phone-tabbar"));
  check(
    tabbar && tabbar.x >= 8 && tabbar.x + tabbar.width <= width - 8,
    `${label}: the tab bar floats clear of both screen edges`,
    tabbar,
  );
  const selectedFill = await page
    .locator('.phone-tabbar__tab[aria-selected="true"]')
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  check(
    selectedFill !== "rgba(0, 0, 0, 0)",
    `${label}: the selected tab has a filled pill`,
    selectedFill,
  );
  await shot("01-new-chat");

  const who = chips.nth(2);
  await who.click();
  const popover = page.locator(".fact-popover--who");
  await popover.waitFor();
  const addAdult = popover
    .locator(".fact-steppers__row")
    .first()
    .locator(".fact-stepper__button")
    .last();
  await addAdult.click();
  await addAdult.click();
  await shot("02-who-editor");
  await popover.locator(".fact-form__primary").click();
  await settle(page, 600);
  check(
    (await page.locator(".chat__facts .fact-chip").nth(2).getAttribute("data-empty")) === null,
    `${label}: saving Who fills its chip`,
  );
  check(
    (await page.locator(".chat .chat__facts").count()) === 1,
    `${label}: the row stays above the composer after a save`,
  );

  await startExamplePlan(page, { englishPrompt: true });
  await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
  await settle(page, 1500);
  check(
    (await page.locator(".chat__facts").count()) === 0,
    `${label}: the chip row leaves once the chat has a plan`,
  );
  await shot("03-planned");

  await tab(page, copy.trip).click();
  await settle(page, 800);
  await shot("04-trip");
  if (scheme === "dark")
    check(
      await surfaceIsDark(page, ".phone-trip-surface .trip-panel__budget-summary"),
      `${label}: the budget card is dark in the dark theme`,
    );

  await tab(page, copy.mine).click();
  await settle(page, 800);
  const list = page.locator(".phone-mine .history-list");
  const listShape = await list.evaluate((node) => ({
    radius: parseFloat(getComputedStyle(node).borderTopLeftRadius),
    rowRadius: parseFloat(
      getComputedStyle(node.querySelector(".history-item")).borderTopLeftRadius,
    ),
  }));
  check(
    listShape.radius >= 20 && listShape.rowRadius === 0,
    `${label}: Mine chats form one grouped list`,
    listShape,
  );
  if (scheme === "dark")
    check(await surfaceIsDark(page, ".phone-mine .history-list"), `${label}: Mine list is dark`);
  check(await noSideScroll(page), `${label}: no sideways page scroll on Mine`);
  await shot("05-mine");

  await page.getByRole("button", { name: copy.settings, exact: true }).click();
  const dialog = page.locator(".dialog:has(.settings)");
  await dialog.waitFor();
  await settle(page, 600);
  const sheet = await box(dialog);
  check(
    sheet && Math.round(sheet.x) === 0 && Math.abs(sheet.y + sheet.height - height) <= 1,
    `${label}: Settings opens as a sheet on the bottom edge`,
    sheet,
  );
  await shot("06-settings");
  await page.keyboard.press("Escape");
  await settle(page, 500);

  await page.locator(".phone-mine .trip-card").first().click();
  await page.locator(".trip-home").waitFor();
  await settle(page, 800);
  const actions = await page.locator(".trip-home-cards").evaluate((node) => ({
    radius: parseFloat(getComputedStyle(node).borderTopLeftRadius),
    rowRadius: parseFloat(
      getComputedStyle(node.querySelector(".trip-home-card")).borderTopLeftRadius,
    ),
  }));
  check(
    actions.radius >= 20 && actions.rowRadius === 0,
    `${label}: Trip home actions form one grouped list`,
    actions,
  );
  await shot("07-trip-home");

  check(errors.length === 0, `${label}: no page errors`, errors);
  await context.close();
}

async function desktopRun(browser) {
  const { context, page, errors } = await open(browser, {
    width: 1440,
    height: 1000,
    language: "en",
    scheme: "light",
  });
  await page.getByRole("textbox").first().fill("Sydney");
  await settle(page, 600);
  check(
    (await page.locator(".workspace-topbar .fact-chip").count()) >= 4,
    "desktop: fact chips stay in the top bar",
  );
  check((await page.locator(".phone-tabbar").count()) === 0, "desktop: no phone tab bar");
  check((await page.locator(".chat__facts").count()) === 0, "desktop: no chip row by the composer");
  await page.screenshot({ path: `${OUT}/desktop-1440.png` });
  check(errors.length === 0, "desktop: no page errors", errors);
  await context.close();
}

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  await phoneRun(browser, { width: 390, height: 844, language: "en", scheme: "light" });
  await phoneRun(browser, { width: 390, height: 844, language: "en", scheme: "dark" });
  await phoneRun(browser, { width: 360, height: 800, language: "zh", scheme: "light" });
  await desktopRun(browser);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
writeFileSync(
  `${OUT}/summary.json`,
  JSON.stringify({ base: BASE, passed: results.length - failed.length, failed, results }, null, 2),
);
console.log(
  `${results.length - failed.length}/${results.length} checks passed; evidence in ${OUT}`,
);
process.exitCode = failed.length ? 1 : 0;
