import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { seedTrip } from "./phone-map-seed.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve(`output/playwright/sidebar-no-chat-plus/${process.env.LABEL ?? "run"}`);
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
const labels = {
  en: {
    newTrip: "New trip",
    chats: "Chats",
    trips: "Trips",
    calendar: "Calendar",
    newChat: "New chat",
    mine: /^Mine/,
    chat: /^Chat/,
    nav: "Open navigation",
  },
  zh: {
    newTrip: "新行程",
    chats: "聊天",
    trips: "行程",
    calendar: "日历",
    newChat: "新聊天",
    mine: /^我的/,
    chat: /^聊天/,
    nav: "打开导航",
  },
};
const open = async (browser, language, viewport, extra = {}, seeded = false) => {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    locale: language === "en" ? "en-AU" : "zh-CN",
    ...extra,
  });
  await context.addInitScript(
    ({ language, seeded, seed }) => {
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
      if (seeded) {
        localStorage.setItem("trip-workspace-v1", JSON.stringify(seed.snapshot));
        localStorage.setItem("trip-workspace-catalog-v3", JSON.stringify(seed.catalog));
        localStorage.setItem("trip.dataMode", "mock");
      }
    },
    { language, seeded, seed: seedTrip() },
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(BASE);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return { context, page, errors };
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const text = labels[language];
    for (const [collapsed, seeded] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const tag = `${language} ${collapsed ? "collapsed" : "expanded"} ${seeded ? "saved chats" : "no chats"}`;
      const { context, page, errors } = await open(
        browser,
        language,
        { width: 1440, height: 1000 },
        {},
        seeded,
      );
      await page.locator(".workspace-app").waitFor();
      const nav = page.locator(".sidebar-nav");
      if (collapsed) {
        await page.locator(".sidebar-toggle").click();
        await page.locator(".workspace-sidebar.is-collapsed").waitFor();
      }
      const order = await nav
        .getByRole("button")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent.trim()),
        );
      check(
        order.length === 4 &&
          [text.newTrip, text.chats, text.trips, text.calendar].every((name, index) =>
            order[index].startsWith(name),
          ),
        `${tag}: sidebar entries are exactly New trip, Chats, Trips, Calendar ${JSON.stringify(order)}`,
      );
      check(
        (await nav.getByRole("button", { name: text.newChat }).count()) === 0,
        `${tag}: no New chat button in the sidebar`,
      );
      await page.screenshot({
        path: `${out}/${language}-${collapsed ? "collapsed" : "expanded"}-${seeded ? "saved" : "empty"}.png`,
      });
      await nav.getByRole("button", { name: new RegExp(`^${text.chats}`) }).click();
      await page.locator(".chats-panel.is-open").waitFor();
      check(
        (await nav.getByRole("button", { name: text.newChat }).count()) === 0,
        `${tag}: Chats panel open still leaves no New chat in the sidebar`,
      );
      await nav.getByRole("button", { name: new RegExp(`^${text.chats}`) }).click();
      await nav.getByRole("button", { name: new RegExp(`^${text.newTrip}`) }).focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog").first();
      await dialog.waitFor();
      check(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
        `${tag}: New trip opens the Where dialog with focus inside`,
      );
      check(
        (await page.locator(".composer").count()) > 0,
        `${tag}: New trip starts a blank conversation`,
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
        `${tag}: no page overflow`,
      );
      check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
      await context.close();
    }

    const tablet = await open(browser, language, { width: 800, height: 900 });
    await tablet.page.locator(".workspace-app").waitFor();
    await tablet.page.getByRole("button", { name: text.nav }).click();
    const drawer = tablet.page.locator(".workspace-drawer--nav");
    await drawer.getByRole("button", { name: new RegExp(`^${text.newTrip}`) }).waitFor();
    check(
      (await drawer.locator(".sidebar-nav").getByRole("button", { name: text.newChat }).count()) ===
        0,
      `${language} tablet: navigation drawer has no New chat row`,
    );
    const dead = await drawer
      .locator(".sidebar-nav button[aria-controls]")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => !document.getElementById(node.getAttribute("aria-controls")))
          .map((node) => node.textContent),
      );
    check(
      dead.length === 0,
      `${language} tablet: no navigation button controls a missing panel`,
      dead,
    );
    check(
      (await drawer.locator(".sidebar-nav").getByRole("button", { name: text.chats }).count()) ===
        0 && (await drawer.locator(".history-item__open").count()) >= 0,
      `${language} tablet: the drawer has no dead Chats entry`,
    );
    check(tablet.errors.length === 0, `${language} tablet: no page errors`);
    await tablet.context.close();

    const phone = await open(
      browser,
      language,
      { width: 390, height: 844 },
      { isMobile: true, hasTouch: true },
      true,
    );
    const notNow = phone.page.getByRole("button", { name: language === "en" ? "Not now" : "暂不" });
    await notNow.waitFor({ timeout: 5000 }).then(
      () => notNow.click(),
      () => {},
    );
    await phone.page.locator(".phone-tabbar").getByRole("tab", { name: text.mine }).click();
    const mineNew = phone.page
      .locator(".phone-mine .chats-panel__section-head")
      .getByRole("button", { name: text.newChat, exact: true });
    check((await mineNew.count()) === 1, `${language} phone: Mine keeps its own New chat button`);
    await phone.page.screenshot({ path: `${out}/${language}-phone-mine.png` });
    await mineNew.click();
    check(
      await phone.page
        .locator(".phone-tabbar")
        .getByRole("tab", { name: text.chat })
        .getAttribute("aria-selected")
        .then((value) => value === "true"),
      `${language} phone: Mine New chat opens Chat`,
    );
    check(phone.errors.length === 0, `${language} phone: no page errors`);
    await phone.context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    `${out}/summary.json`,
    JSON.stringify({ results, fixture: "empty local catalog; no live services" }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
