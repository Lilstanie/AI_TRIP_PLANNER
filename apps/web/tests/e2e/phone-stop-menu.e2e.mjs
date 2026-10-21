import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-stop-menu", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const reachable = (menu) =>
  menu.evaluate((list) => {
    const bar = document.querySelector(".phone-tabbar")?.getBoundingClientRect().top ?? innerHeight;
    return [...list.querySelectorAll('[role="menuitem"]')].map((item) => {
      item.scrollIntoView({ block: "nearest" });
      const r = item.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        label: item.textContent.trim(),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        visible: r.top >= 0 && r.bottom <= Math.min(bar, innerHeight) + 1 && item.contains(hit),
      };
    });
  });
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const [width, height] of [
    [390, 844],
    [360, 640],
  ]) {
    const id = `${width}x${height}`;
    const context = await browser.newContext({
      viewport: { width, height },
      locale: "en-AU",
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    await planSuggestedTrip(page);
    await page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ }).click();
    const trigger = page.locator(".timeline-stop .action-menu__trigger").first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = page.locator(".action-menu__list");
    await menu.waitFor();
    await page.waitForTimeout(300);
    const items = await reachable(menu);
    check(
      items.length >= 5 && items.every((item) => item.visible),
      `${id} every stop action can be brought on screen above the tab bar`,
      items.filter((item) => !item.visible),
    );
    await page.screenshot({ path: `${out}/${id}-open.png` });
    await page.keyboard.press("End");
    await page.waitForTimeout(300);
    const last = await page.evaluate(() => {
      const item = document.activeElement;
      const r = item.getBoundingClientRect();
      const bar =
        document.querySelector(".phone-tabbar")?.getBoundingClientRect().top ?? innerHeight;
      return {
        label: item.textContent.trim(),
        visible:
          r.top >= 0 &&
          r.bottom <= bar + 1 &&
          item.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)),
      };
    });
    check(last.label === "Remove" && last.visible, `${id} End focuses a visible Remove`, last);
    await page.keyboard.press("Home");
    await page.waitForTimeout(300);
    const first = await page.evaluate(() => {
      const r = document.activeElement.getBoundingClientRect();
      return { label: document.activeElement.textContent.trim(), top: Math.round(r.top) };
    });
    check(first.top >= 0, `${id} Home focuses a visible first item`, first);
    await page.keyboard.press("Escape");
    check(
      await trigger.evaluate((node) => node === document.activeElement),
      `${id} Escape returns focus to the stop's menu button`,
    );
    await context.close();
  }
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
