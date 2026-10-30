import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { seedTrip } from "./phone-map-seed.mjs";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-empty-chat-hint", process.env.LABEL ?? "run");
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
    notNow: "Not now",
    chat: /^Chat/,
    mine: /^Mine/,
    examples: "Example trips",
    footer: /Estimates require verification/,
    noTrips: "No trips yet.",
    trips: "Trips",
    newTrip: "New trip",
    newChat: "New chat",
    search: "Search chats and trips",
    switchTabs: "Your trips",
    chats: "Chats",
    team: /^Agent Team|Team/,
    traj: "Nothing here yet. Send a message in Chat and each step the assistant takes will be listed here.",
    trajNew: "Each step the assistant takes will be listed here after you send a message.",
    planInChat: "Plan in Chat",
    emptyDay: "Nothing planned for this day yet.",
  },
  zh: {
    notNow: "暂不",
    chat: /^聊天/,
    mine: /^我的/,
    examples: "示例行程",
    footer: /估算都需要核实/,
    noTrips: "尚无行程。",
    trips: "行程",
    newTrip: "新行程",
    newChat: "新聊天",
    search: "搜索聊天与行程",
    switchTabs: "你的行程",
    chats: "聊天",
    team: /专家团队|团队/,
    traj: "还没有记录。在聊天里发送消息后，助手的每个步骤都会列在这里。",
    trajNew: "发送消息后，助手的每一步都会列在这里。",
    planInChat: "去聊天规划",
    emptyDay: "这一天还没有安排。",
  },
};

const sentences = (text) => (text.match(/[.。!?！？]/g) ?? []).length;

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [375, 812],
    [520, 900],
    [1440, 900],
  ]) {
    const phone = width <= 520;
    for (const language of ["en", "zh"]) {
      const copy = COPY[language];
      const label = `${language}-${width}`;
      const context = await browser.newContext({
        viewport: { width, height },
        ...(phone ? { isMobile: true, hasTouch: true } : {}),
        reducedMotion: "reduce",
        locale: language === "zh" ? "zh-CN" : "en-AU",
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
            updatedAt: "2026-10-24T00:00:00Z",
          }),
        );
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const notNow = page.getByRole("button", { name: copy.notNow });
      await notNow.waitFor({ timeout: 5000 }).then(
        () => notNow.click(),
        () => {},
      );
      if (phone) await page.locator(".phone-tabbar").getByRole("tab", { name: copy.chat }).click();
      const suggestions = page.getByLabel(copy.examples);
      await suggestions.waitFor();
      check(
        (await page.getByRole("heading", { name: "Where to next?" }).count()) === 0 &&
          (await page.getByRole("heading", { name: "下一站去哪里？" }).count()) === 0,
        `${label}: no centre empty card`,
      );
      check(
        (await page.locator(".fact-chips").count()) === 0,
        `${label}: Brief bar stays hidden on a blank untouched chat`,
      );
      check(
        (await suggestions.locator("button").count()) >= 1,
        `${label}: suggestion chips sit with the composer`,
      );
      await page.locator(".chat__form").screenshot({ path: `${OUT}/${label}.png` });
      check(errors.length === 0, `${label}: browser has no page errors`, errors);
      await context.close();
    }
  }
  for (const [width, height] of [
    [390, 844],
    [360, 800],
  ]) {
    for (const language of ["en", "zh"]) {
      const copy = COPY[language];
      const label = `${language}-${width}x${height}`;
      for (const withTrip of [false, true]) {
        const seed = seedTrip();
        const context = await browser.newContext({
          viewport: { width, height },
          isMobile: true,
          hasTouch: true,
          reducedMotion: "reduce",
          locale: language === "zh" ? "zh-CN" : "en-AU",
        });
        await context.addInitScript(
          ({ language, withTrip, seed }) => {
            localStorage.setItem(
              "trip.settings.v1",
              JSON.stringify({
                version: 1,
                travel: { homeCity: "", preferences: [] },
                language,
                dataMode: "mock",
                appearance: "system",
                updatedAt: "2026-10-27T00:00:00Z",
              }),
            );
            if (withTrip) {
              localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
              localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
              localStorage.setItem("trip.dataMode", "mock");
            }
          },
          { language, withTrip, seed },
        );
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.goto(BASE, { waitUntil: "domcontentloaded" });
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        const tabs = page.locator(".phone-tabbar");
        await tabs.waitFor();
        const stage = `${label}-${withTrip ? "trip" : "blank"}`;
        const noOverflow = async (name) =>
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${stage}: ${name} has no horizontal overflow`,
          );
        if (!withTrip) {
          await page.getByLabel(copy.examples).waitFor();
          check(
            (await page.locator(".chat .disclaimer:visible").count()) === 0,
            `${stage}: empty Chat shows no second sentence under the composer`,
          );
          check(
            !copy.footer.test(await page.locator(".chat").innerText()),
            `${stage}: empty Chat does not say estimates need verification`,
          );
          await page.screenshot({ path: `${OUT}/${stage}-chat.png` });
          await noOverflow("empty Chat");

          await tabs.getByRole("tab", { name: copy.mine }).click();
          const mine = page.locator(".phone-mine");
          await mine.waitFor();
          check(
            (await mine.getByRole("button", { name: copy.newTrip, exact: true }).count()) === 1 &&
              (await mine.getByRole("button", { name: copy.newChat, exact: true }).count()) === 1,
            `${stage}: Mine with no data offers New trip and New chat once each`,
          );
          check(
            (await mine.getByRole("heading", { name: copy.trips }).count()) === 1 &&
              (await mine.getByRole("heading", { name: copy.chats }).count()) === 1,
            `${stage}: Mine with no data keeps Trips and Chats collection headings`,
          );
          check(
            (await mine.locator(".history-item").count()) === 0 &&
              !(await mine.innerText()).includes(copy.noTrips),
            `${stage}: Mine with no data renders no blank history rows or duplicate empty sentence`,
          );
          check(
            (await mine.getByRole("searchbox", { name: copy.search }).count()) === 0 &&
              (await mine.locator(".trips-page__tabs").count()) === 0,
            `${stage}: Mine with no data has no search field or Trips and Calendar switch`,
          );
          await page.screenshot({ path: `${OUT}/${stage}-mine.png` });
          await noOverflow("empty Mine");

          await page.locator(".phone-topbar__team").click();
          const trajectory = page.locator(".trajectory-empty");
          await trajectory.waitFor();
          const lines = await trajectory.locator("p").allInnerTexts();
          check(
            lines.length === 1 && sentences(lines[0]) === 1 && lines[0].trim() === copy.trajNew,
            `${stage}: empty Trajectory says one sentence`,
            lines,
          );
          check(
            (await trajectory.getByRole("button").count()) === 1 &&
              (await trajectory.getByRole("button", { name: copy.planInChat }).count()) === 1,
            `${stage}: empty Trajectory offers Plan in Chat only`,
          );
          await page.screenshot({ path: `${OUT}/${stage}-trajectory.png` });
        } else {
          await tabs.getByRole("tab", { name: copy.mine }).click();
          await openTripWorkspace(page, page.locator(".phone-mine .trip-card").first());
          await tabs.getByRole("tab", { name: /^(Trip|行程)/ }).click();
          await page
            .getByRole("tab", { name: /^(Day 2|第 2 天)/ })
            .first()
            .click();
          const emptyDay = page.locator(".timeline-empty");
          await emptyDay.waitFor();
          check(
            (await emptyDay.innerText()).trim() === copy.emptyDay &&
              sentences(await emptyDay.innerText()) === 1,
            `${stage}: an empty day says one sentence`,
            await emptyDay.innerText(),
          );
          await page.screenshot({ path: `${OUT}/${stage}-empty-day.png` });
          await noOverflow("empty day");
        }
        check(errors.length === 0, `${stage}: browser has no page errors`, errors);
        await context.close();
      }
    }
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results }, null, 2));
}
if (results.some(({ ok }) => !ok)) process.exit(1);
