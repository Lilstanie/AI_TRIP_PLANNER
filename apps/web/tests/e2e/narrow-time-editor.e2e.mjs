import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip } from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/narrow-time-editor", process.env.LABEL ?? "after");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  page = await browser.newPage({
    viewport: { width: 1001, height: 800 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await planSuggestedTrip(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  for (const language of ["en", "zh"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (language === "zh") {
      await page.getByRole("button", { name: "Close your trip", exact: true }).click();
      await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
      await page.getByRole("button", { name: "打开你的行程", exact: true }).click();
    }
    const zh = language === "zh";
    for (const width of [1001, 1440, 1000, 521, 520, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(
        () => Boolean(document.querySelector('[role="separator"]')) === innerWidth > 1000,
      );
      const separator = page.getByRole("separator", {
        name: zh ? "调整聊天与地图宽度" : "Resize chat and map",
      });
      for (const split of (await separator.isVisible()) ? ["End", "Home", "default"] : [null]) {
        console.log(`Checking ${width}/${split}`);
        if (split) {
          const close = page.getByRole("button", {
            name: zh ? "关闭行程" : "Close your trip",
            exact: true,
          });
          if (await close.isVisible()) await close.click();
          await separator.focus();
          if (split === "default") await separator.dblclick();
          else await separator.press(split);
          await page
            .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
            .click();
        } else if (width <= 520)
          await page.getByRole("tab", { name: zh ? /^行程/ : /^Trip/ }).click();
        const time = page
          .getByRole("button", { name: zh ? /^修改时间,/ : /^Change time,/ })
          .first();
        await time.click();
        const form = page.locator(".stop-editor__time");
        await form.waitFor();
        await form.scrollIntoViewIfNeeded();
        const geometry = await form.evaluate((form) => {
          const drawer = form.closest('[role="dialog"]') ?? document.querySelector(".trip-editor");
          const bounds = drawer.getBoundingClientRect();
          return [...form.querySelectorAll("input, button")].map((control) => {
            const rect = control.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              drawerLeft: bounds.left,
              drawerRight: bounds.right,
            };
          });
        });
        const scrolling = await form.evaluate((form) => {
          const ancestors = [];
          for (let node = form; node; node = node.parentElement) {
            if (node.scrollLeft)
              ancestors.push({ className: node.className, scrollLeft: node.scrollLeft });
          }
          return ancestors;
        });
        await page.screenshot({
          path: `${out}/${language}-${width}-${split ?? "phone"}.png`,
          fullPage: true,
        });
        results.push({ language, width, split, geometry, scrolling });
        assert.equal(
          scrolling.length,
          0,
          `opening the time editor scrolls horizontally at ${width}/${split}: ${JSON.stringify(scrolling)}`,
        );
        assert(
          geometry.every(
            (r) => r.left >= r.drawerLeft - 1 && r.right <= r.drawerRight + 1 && r.right <= width,
          ),
          `time controls overflow at ${width}/${split}`,
        );
        const inputs = form.locator("input");
        const original = await inputs.first().inputValue();
        await inputs.first().fill("23:59");
        assert(await form.locator('button[type="submit"]').isDisabled());
        assert(
          await form
            .getByText(zh ? "结束时间须晚于开始时间。" : "End must be after start.", {
              exact: true,
            })
            .isVisible(),
        );
        await inputs.first().fill(original);
        await form.locator("input").first().press("Escape");
        assert.equal(await form.count(), 0);
        assert(await time.evaluate((button) => document.activeElement === button));
        if (width === 390) {
          await time.click();
          await form
            .locator("input")
            .first()
            .fill(original === "13:00" ? "13:15" : "13:00");
          await form.locator('button[type="submit"]').click();
          await form.waitFor({ state: "detached" });
          await page.waitForFunction(() => !document.querySelector(".timeline-status"));
          assert(
            (await time.getAttribute("aria-label")).includes(
              original === "13:00" ? "13:15" : "13:00",
            ),
          );
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        }
      }
    }
  }
  assert.deepEqual(errors, []);
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.html`, await page.content());
  }
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
