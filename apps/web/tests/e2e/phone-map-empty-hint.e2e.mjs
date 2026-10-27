import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { seedTrip, sydney } from "./phone-map-seed.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-map-empty-hint", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const COPY = {
  en: {
    map: /^Map/,
    mapButton: "Map",
    mine: /^Mine/,
    chat: /^Chat/,
    hint: "Where are you going?",
    toChat: "Plan in Chat",
    locate: "Show my location",
    empty: "Nothing planned for this day yet.",
    day2: "Day 2",
    sheet: "Day stops",
  },
  zh: {
    map: /^地图/,
    mapButton: "地图",
    mine: /^我的/,
    chat: /^聊天/,
    hint: "你想去哪里？",
    toChat: "去聊天规划",
    locate: "显示我的位置",
    empty: "这一天还没有安排。",
    day2: "第 2 天",
    sheet: "当日站点",
  },
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const open = async ({ width, height, language, homeCity = "", dataMode = "mock", seed, abort }) => {
  const phone = width <= 520;
  const context = await browser.newContext({
    viewport: { width, height },
    ...(phone ? { isMobile: true, hasTouch: true } : {}),
    reducedMotion: "reduce",
    locale: language === "zh" ? "zh-CN" : "en-AU",
    geolocation: { latitude: -33.87, longitude: 151.21 },
    permissions: ["geolocation"],
  });
  await context.addInitScript(
    ({ language, homeCity, dataMode, seed }) => {
      localStorage.setItem(
        "trip.settings.v1",
        JSON.stringify({
          version: 1,
          travel: { homeCity, preferences: [] },
          language,
          dataMode,
          appearance: "system",
          updatedAt: "2026-10-27T00:00:00Z",
        }),
      );
      if (seed) {
        localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
        localStorage.setItem("trip.dataMode", "mock");
      }
      window.__geolocationCalls = 0;
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...args) => {
        window.__geolocationCalls += 1;
        return original(...args);
      };
    },
    { language, homeCity, dataMode, seed },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/places/search", (route) =>
    route.fulfill({ json: { places: [sydney] } }),
  );
  await page.route("**/api/places/details", (route) => route.fulfill({ json: { place: sydney } }));
  if (abort) await page.route(abort, (route) => route.abort());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page, errors, phone };
};

try {
  for (const [width, height] of [
    [390, 844],
    [360, 800],
    [800, 900],
  ]) {
    const phone = width <= 520;
    for (const language of ["en", "zh"]) {
      const copy = COPY[language];
      const label = `${language}-${width}x${height}`;
      const { context, page, errors } = await open({ width, height, language });
      if (phone) await page.locator(".phone-tabbar").getByRole("tab", { name: copy.map }).click();
      else
        await page.locator(".topbar-views").getByRole("button", { name: copy.mapButton }).click();
      const canvas = page.locator(".trip-map-canvas:visible");
      await canvas.waitFor();
      const map = canvas.locator(".google-map");
      await map.waitFor({ state: "visible" });
      await page.waitForFunction(
        () => document.querySelector(".trip-map-canvas .google-map")?.dataset.mapReady === "true",
        undefined,
        { timeout: 15_000 },
      );
      check(await map.isVisible(), `${label}: a basemap is visible`);
      check(
        (await canvas.locator(".map-placeholder").count()) === 0,
        `${label}: the grey placeholder card is gone`,
      );
      const hints = canvas.locator(".trip-map-start");
      check((await hints.count()) === 1, `${label}: exactly one hint`, await hints.count());
      check(
        (await hints.first().innerText()).includes(copy.hint),
        `${label}: the hint asks for a destination`,
        await hints.first().innerText(),
      );
      check(
        (await hints.first().getAttribute("class"))?.includes("glass-float"),
        `${label}: the hint is a glass surface`,
      );
      check(
        (await page.locator(".location-prompt:visible").count()) === 0,
        `${label}: no location prompt before Locate me`,
      );
      check(
        (await page.evaluate(() => window.__geolocationCalls)) === 0,
        `${label}: the browser is not asked for location before the tap`,
      );
      check(
        (await canvas.getAttribute("data-basemap-centre")) === "world",
        `${label}: no home base gives the world view`,
        await canvas.getAttribute("data-basemap-centre"),
      );
      check(
        (await canvas.locator(".trip-map-fallback").count()) === 0,
        `${label}: no map error alert`,
      );
      if (phone) {
        check(
          (await page.locator(".phone-map-sheet").count()) === 0,
          `${label}: no Day stops sheet without a trip`,
        );
        const button = hints.first().getByRole("button", { name: copy.toChat });
        check(await button.isVisible(), `${label}: the hint has one button to Chat`);
        check(
          (await hints.first().getByRole("button").count()) === 1,
          `${label}: the hint has only that button`,
        );
        await page.screenshot({ path: `${OUT}/${label}-map.png` });
        await canvas.getByRole("button", { name: copy.locate }).click();
        await page.waitForFunction(() => window.__geolocationCalls === 1);
        check(true, `${label}: tapping Locate me asks for location once`);
        await button.click();
        check(
          (await page
            .locator(".phone-tabbar")
            .getByRole("tab", { name: copy.chat })
            .getAttribute("aria-selected")) === "true",
          `${label}: the button opens Chat`,
        );
      } else {
        check(
          (await hints.first().getByRole("button").count()) === 0,
          `${label}: the desktop hint has no button because the view switch already reaches Chat`,
        );
        await page.screenshot({ path: `${OUT}/${label}-map.png` });
        await canvas.getByRole("button", { name: copy.locate }).click();
        await page.waitForFunction(() => window.__geolocationCalls === 1);
        check(true, `${label}: tapping Locate me asks for location once`);
      }
      check(errors.length === 0, `${label}: browser has no page errors`, errors);
      await context.close();
    }
  }

  {
    const label = "desktop-1440x900";
    const { context, page, errors } = await open({ width: 1440, height: 900, language: "en" });
    await page.locator(".workspace-shell").waitFor();
    const visibility = await page
      .locator(".workspace-panel--map")
      .evaluate((node) => getComputedStyle(node).visibility);
    check(
      visibility === "hidden",
      `${label}: the wide empty workspace keeps the map area hidden`,
      visibility,
    );
    check(
      (await page.locator(".trip-map-start:visible, .map-placeholder:visible").count()) === 0,
      `${label}: no hint or placeholder is shown in the hidden map area`,
    );
    await page.screenshot({ path: `${OUT}/${label}.png` });
    check(errors.length === 0, `${label}: browser has no page errors`, errors);
    await context.close();
  }

  {
    const label = "home-base-390x844";
    const { context, page, errors } = await open({
      width: 390,
      height: 844,
      language: "en",
      homeCity: "Sydney",
    });
    await page.locator(".phone-tabbar").getByRole("tab", { name: COPY.en.map }).click();
    const canvas = page.locator(".trip-map-canvas:visible");
    await canvas.waitFor();
    await page.waitForFunction(
      () => document.querySelector(".trip-map-canvas")?.dataset.basemapCentre === "home",
      undefined,
      { timeout: 10_000 },
    );
    check(true, `${label}: a travel profile home base centres the basemap`);
    await page.screenshot({ path: `${OUT}/${label}-map.png` });
    check(errors.length === 0, `${label}: browser has no page errors`, errors);
    await context.close();
  }

  {
    const label = "tiles-fail-390x844";
    const { context, page, errors } = await open({
      width: 390,
      height: 844,
      language: "en",
      dataMode: "default",
      abort: /tiles\.openfreemap\.org/,
    });
    await page.locator(".phone-tabbar").getByRole("tab", { name: COPY.en.map }).click();
    const canvas = page.locator(".trip-map-canvas:visible");
    await canvas.waitFor();
    await page.waitForTimeout(2500);
    check(
      (await canvas.locator(".trip-map-start").count()) === 1,
      `${label}: the hint stays when tiles fail`,
    );
    check(
      (await canvas.locator(".trip-map-fallback, [role=alert]").count()) === 0,
      `${label}: no error alert or Retry map when tiles fail`,
    );
    await page.screenshot({ path: `${OUT}/${label}-map.png` });
    check(errors.length === 0, `${label}: browser has no page errors`, errors);
    await context.close();
  }

  for (const language of ["en", "zh"]) {
    const copy = COPY[language];
    const label = `empty-day-${language}-390x844`;
    const { context, page, errors } = await open({
      width: 390,
      height: 844,
      language,
      seed: seedTrip(),
    });
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.mine }).click();
    await page.locator(".phone-mine .trip-card").first().click();
    await page.locator(".phone-tabbar").getByRole("tab", { name: copy.map }).click();
    const sheet = page.locator(".phone-map-sheet");
    await sheet.waitFor();
    check(
      (await sheet.getAttribute("data-snap")) === "half",
      `${label}: a day with stops opens half`,
    );
    await sheet.getByRole("button", { name: copy.day2, exact: true }).click();
    check(
      (await sheet.getAttribute("data-snap")) === "handle",
      `${label}: an empty day collapses the sheet to its handle`,
      await sheet.getAttribute("data-snap"),
    );
    check(
      await sheet.getByText(copy.empty, { exact: true }).isVisible(),
      `${label}: one line says the day has nothing yet`,
    );
    check(
      !(await sheet.locator(".phone-map-sheet__body").isVisible()),
      `${label}: the sheet body is hidden`,
    );
    const box = await sheet.boundingBox();
    check(box && box.height < 140, `${label}: the sheet is only handle plus one line`, box?.height);
    await page.screenshot({ path: `${OUT}/${label}.png` });
    check(errors.length === 0, `${label}: browser has no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
