import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/phone-mention-chips-row", process.env.LABEL ?? "run");
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (ok, name, observed) => {
  results.push({ ok: Boolean(ok), name, observed });
  console.log(
    `${ok ? "ok" : "FAIL"} ${name}${observed === undefined ? "" : `: ${JSON.stringify(observed)}`}`,
  );
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    for (const language of ["en", "zh"]) {
      const label = `${width}x${height}-${language}`;
      const phone = width <= 520;
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: phone,
        hasTouch: phone,
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
            updatedAt: "2026-10-23T00:00:00Z",
          }),
        );
      }, language);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.locator(".chat-empty__suggestions button").first().waitFor();
      const notNow = page.getByRole("button", { name: language === "zh" ? "暂不" : "Not now" });
      await notNow.waitFor({ timeout: 5000 }).then(
        () => notNow.click(),
        () => {},
      );
      await page.locator(".location-prompt").waitFor({ state: "detached" });
      const row = page.locator(".assistant-chips");
      const chips = row.locator(".assistant-chip");
      const measure = () =>
        page.evaluate(() => {
          const row = document.querySelector(".assistant-chips");
          const chips = [...row.querySelectorAll(".assistant-chip")].map((chip) => {
            const box = chip.getBoundingClientRect();
            const text = chip.querySelector("span:last-child");
            return {
              top: Math.round(box.top),
              height: box.height,
              cut: text.scrollWidth > text.clientWidth + 1,
            };
          });
          return {
            rows: new Set(chips.map((chip) => chip.top)).size,
            rowHeight: row.getBoundingClientRect().height,
            stream: document.querySelector(".chat__stream").getBoundingClientRect().height,
            chips,
            cue: getComputedStyle(row).maskImage !== "none",
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
      const start = await measure();
      if (phone) {
        check(start.rows === 1, `${label} the six chips sit in one row`, {
          rows: start.rows,
          rowHeight: start.rowHeight,
        });
        if (width === 360)
          check(
            start.stream >= 250,
            `${label} the message list keeps at least 250 px`,
            start.stream,
          );
        check(
          start.chips.every((chip) => chip.height >= 44),
          `${label} every chip is at least 44 px high`,
          start.chips.map((chip) => chip.height),
        );
        check(start.cue, `${label} a fade shows more chips past the edge`, start.cue);
        const last = chips.last();
        await last.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        const end = await measure();
        check(!end.cue, `${label} the fade is gone at the end of the row`, end.cue);
        await last.click();
        const value = await page.locator(".composer__input").inputValue();
        check(
          value.startsWith("@"),
          `${label} the last chip, reached by scrolling, inserts its mention`,
          value,
        );
        await chips.first().focus();
        for (let index = 1; index < 6; index += 1) await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const node = document.activeElement;
          const box = node.getBoundingClientRect();
          const row = node.parentElement.getBoundingClientRect();
          return {
            chip: node.classList.contains("assistant-chip"),
            visible: box.left >= row.left - 1 && box.right <= row.right + 1,
          };
        });
        check(
          focused.chip && focused.visible,
          `${label} Tab reaches the sixth chip and shows it`,
          focused,
        );
      } else {
        check(!start.cue, `${label} desktop row has no fade`, start.cue);
      }
      check(
        start.chips.every((chip) => !chip.cut),
        `${label} no chip label is cut`,
        start.chips.filter((chip) => chip.cut).length,
      );
      check(start.overflow <= 0, `${label} page has no horizontal overflow`, start.overflow);
      await row.screenshot({ path: `${OUT}/${label}-chips.png` });
      await page.screenshot({ path: `${OUT}/${label}.png` });
      writeFileSync(`${OUT}/${label}.json`, JSON.stringify(start, null, 2));
      check(errors.length === 0, `${label} browser has no page errors`, errors);
      await context.close();
    }
  }
} catch (error) {
  check(false, "journey completes", String(error).slice(0, 400));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
