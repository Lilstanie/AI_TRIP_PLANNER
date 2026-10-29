import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(`output/playwright/sidebar-entries/${process.env.LABEL ?? "run"}`);
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
};
const labels = {
  en: {
    newChat: "New chat",
    calendar: "Calendar",
    trips: "Trips",
    chats: "Chats",
  },
  zh: { newChat: "新聊天", calendar: "日历", trips: "行程", chats: "聊天" },
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const language of ["en", "zh"]) {
    const text = labels[language];
    for (const collapsed of [false, true]) {
      const tag = `${language} ${collapsed ? "collapsed" : "expanded"}`;
      const state = collapsed ? "collapsed" : "expanded";
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
        locale: language === "en" ? "en-AU" : "zh-CN",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      const nav = page.locator(".sidebar-nav");
      const entry = (name) => nav.getByRole("button", { name: new RegExp(`^${name}`) });
      if (collapsed) {
        await page.locator(".sidebar-toggle").click();
        await page.locator(".workspace-sidebar.is-collapsed").waitFor();
      }
      for (const name of [text.newChat, text.chats, text.trips, text.calendar])
        check(
          (await entry(name).count()) === 1,
          `${tag}: ${name} entry present with accessible name`,
        );
      const order = await nav
        .getByRole("button")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("aria-label") ?? node.textContent.trim()),
        );
      const position = (name) => order.findIndex((label) => label.startsWith(name));
      check(
        position(text.newChat) < position(text.chats) &&
          position(text.chats) < position(text.trips) &&
          position(text.trips) < position(text.calendar),
        `${tag}: keyboard order ${JSON.stringify(order)}`,
      );
      if (collapsed) {
        for (const name of [text.newChat, text.calendar]) {
          const tooltip = await entry(name).getAttribute("data-tooltip");
          check(tooltip === name, `${tag}: ${name} tooltip ${tooltip}`);
          check((await entry(name).locator("svg").count()) === 1, `${tag}: ${name} shows an icon`);
        }
        await entry(text.calendar).hover();
        await page.screenshot({ path: `${out}/${language}-collapsed-tooltip.png` });
      } else await page.screenshot({ path: `${out}/${language}-expanded.png` });

      await entry(text.calendar).click();
      await page.getByRole("tab", { name: text.calendar, selected: true }).waitFor();
      check(
        (await entry(text.calendar).getAttribute("aria-current")) === "true",
        `${tag}: Calendar current on calendar view`,
      );
      check(
        (await entry(text.trips).getAttribute("aria-current")) === null,
        `${tag}: Trips not current on calendar view`,
      );
      await page.screenshot({ path: `${out}/${language}-${state}-calendar.png` });

      await page.getByRole("tab", { name: text.trips }).click();
      check(
        (await entry(text.trips).getAttribute("aria-current")) === "true" &&
          (await entry(text.calendar).getAttribute("aria-current")) === null,
        `${tag}: tab switch moves current entry to Trips`,
      );

      await entry(text.calendar).focus();
      await page.keyboard.press("Enter");
      check(
        (await page.getByRole("tab", { selected: true }).textContent()) === text.calendar,
        `${tag}: Enter on Calendar opens the calendar view`,
      );
      await entry(text.trips).click();
      check(
        (await page.getByRole("tab", { selected: true }).textContent()) === text.trips,
        `${tag}: Trips entry opens the trips view`,
      );

      await entry(text.calendar).click();
      await entry(text.newChat).click();
      check(
        (await page.getByRole("dialog").count()) === 0 &&
          (await page.locator(".composer").count()) > 0,
        `${tag}: New chat opens a blank Chat without Where`,
      );
      await page.screenshot({ path: `${out}/${language}-${state}-new-chat.png` });

      check(
        await page.evaluate(() => document.documentElement.scrollWidth === innerWidth),
        `${tag}: no page overflow`,
      );
      check(errors.length === 0, `${tag}: no page errors (${errors.join("; ")})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    `${out}/summary.json`,
    JSON.stringify({ results, fixture: "empty local catalog; no live services" }, null, 2),
  );
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
