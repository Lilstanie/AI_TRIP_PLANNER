import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve("output/playwright/who-stepper-touch-target", process.env.LABEL ?? "run");
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
    [375, 667],
    [390, 844],
  ]) {
    for (const language of ["en", "zh"]) {
      const label = `${width}x${height}-${language}`;
      const zh = language === "zh";
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
        locale: zh ? "zh-CN" : "en-AU",
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
      const notNow = page.getByRole("button", { name: zh ? "暂不" : "Not now" });
      await notNow.waitFor({ timeout: 5000 }).then(
        () => notNow.click(),
        () => {},
      );
      const who = zh ? "同行人员" : "Who";
      await page.locator(".phone-topbar__title-button").click();
      await page.locator('.facts-sheet__row[data-fact="who"]').click();
      const sheet = page.getByRole("dialog", { name: who, exact: true });
      await sheet.waitFor();
      await page.waitForTimeout(300);

      const measured = await sheet.evaluate((root) =>
        [...root.querySelectorAll(".fact-stepper__button")].map((button) => {
          const box = button.getBoundingClientRect();
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const reach = [
            [cx - 21, cy],
            [cx + 21, cy],
            [cx, cy - 21],
            [cx, cy + 21],
          ].every(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return hit === button || button.contains(hit);
          });
          return {
            name: button.getAttribute("aria-label"),
            width: Math.round(box.width),
            height: Math.round(box.height),
            reach,
          };
        }),
      );
      check(
        measured.length === 10,
        `${label} the Who sheet has ten stepper buttons`,
        measured.length,
      );
      check(
        measured.every((button) => button.width >= 44 && button.height >= 44),
        `${label} every stepper button is at least 44 × 44 px`,
        measured.map((button) => [button.name, button.width, button.height]),
      );
      check(
        measured.every((button) => button.reach),
        `${label} a tap 21 px from each button's centre still hits that button`,
        measured.filter((button) => !button.reach).map((button) => button.name),
      );

      const layout = await sheet.evaluate((root) => {
        const sheetBox = root.getBoundingClientRect();
        return {
          overflow: document.scrollingElement.scrollWidth - window.innerWidth,
          sheetOverflow: root.scrollWidth - root.clientWidth,
          rows: [...root.querySelectorAll(".fact-steppers__row")].map((row) => {
            const text = row.querySelector(".fact-steppers__label span");
            const stepper = row.querySelector(".fact-stepper").getBoundingClientRect();
            const name = text.getBoundingClientRect();
            return {
              label: text.textContent,
              cut: text.scrollWidth > text.clientWidth + 1,
              overlap: name.right > stepper.left,
              outside: stepper.right > sheetBox.right + 1,
            };
          }),
        };
      });
      check(
        layout.overflow <= 0 && layout.sheetOverflow <= 0,
        `${label} the page and sheet have no horizontal scroll`,
        { page: layout.overflow, sheet: layout.sheetOverflow },
      );
      check(
        layout.rows.every((row) => !row.cut && !row.overlap && !row.outside),
        `${label} every row label fits beside its stepper inside the sheet`,
        layout.rows.filter((row) => row.cut || row.overlap || row.outside),
      );

      const status = sheet.getByRole("status").first();
      const before = await status.textContent();
      await sheet.locator(".fact-stepper__button").nth(1).click();
      const raised = await status.textContent();
      await sheet.locator(".fact-stepper__button").nth(0).click();
      const lowered = await status.textContent();
      check(
        raised !== before && lowered === before,
        `${label} + raises the first count and − lowers it again`,
        { before, raised, lowered },
      );

      await sheet.screenshot({ path: `${OUT}/${label}-who-sheet.png` });
      check(errors.length === 0, `${label} browser has no page errors`, errors);
      await context.close();
    }
  }
} catch (error) {
  check(false, "journey completes", String(error));
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
