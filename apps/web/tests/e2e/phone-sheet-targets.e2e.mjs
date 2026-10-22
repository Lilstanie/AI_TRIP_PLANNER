import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip, touchSized } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/phone-sheet-targets", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const size = async (locator) => {
  const rect = await locator.boundingBox();
  return rect && { width: Math.round(rect.width), height: Math.round(rect.height) };
};
const target = (box) => box && touchSized(box.width) && touchSized(box.height);
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const locale of ["en-AU", "zh-CN"]) {
    const zh = locale === "zh-CN";
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-AU",
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    await planSuggestedTrip(page);
    if (zh) {
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
      await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
      await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
    }
    const tripTab = page
      .locator(".phone-tabbar")
      .getByRole("tab", { name: zh ? /^行程/ : /^Trip/ });
    for (const fact of ["where", "when", "who", "budget", "preferences"]) {
      await tripTab.click();
      await page.getByRole("button", { name: zh ? /^行程信息/ : /^Trip details:/ }).click();
      const sheet = page.locator(".fact-popover--facts");
      await sheet.waitFor();
      if (fact === "where") {
        const close = await size(sheet.locator(".fact-popover__close"));
        check(target(close), `${locale} Trip details close is 44 x 44`, close);
        await page.screenshot({ path: `${out}/${locale}-trip-details.png` });
      }
      await sheet.locator(`[data-fact="${fact}"]`).click();
      const editor = page.locator(".fact-popover--modal:not(.fact-popover--facts)").last();
      await editor.waitFor();
      const close = await size(editor.locator(".fact-popover__close"));
      check(target(close), `${locale} ${fact} close is 44 x 44`, close);
      const primary = await size(editor.locator(".fact-form__primary"));
      check(
        primary && touchSized(primary.height),
        `${locale} ${fact} primary action is 44 px high`,
        primary,
      );
      if (fact === "where") await page.screenshot({ path: `${out}/${locale}-where.png` });
      await editor.locator(".fact-popover__close").click();
      await editor.waitFor({ state: "hidden" });
    }

    await page
      .locator(".phone-tabbar")
      .getByRole("tab", { name: zh ? /^我的/ : /^Mine/ })
      .click();
    await page.locator(".phone-mine__settings").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: zh ? "个性化" : "Personalization" }).click();
    const answers = dialog.locator(".memory-row__answer");
    await answers.first().waitFor();
    const names = await answers.evaluateAll((buttons) =>
      buttons.map((button) => ({
        visible: button.textContent.trim(),
        name: button.getAttribute("aria-label") ?? button.textContent.trim(),
      })),
    );
    check(
      names.length > 1 && new Set(names.map(({ name }) => name)).size === names.length,
      `${locale} every Answer button has its own accessible name`,
      names.map(({ name }) => name),
    );
    check(
      names.every(({ visible, name }) => name.startsWith(visible) && name !== visible),
      `${locale} each Answer name starts with its visible text`,
    );
    await page.screenshot({ path: `${out}/${locale}-personalization.png` });
    const editButtons = dialog.locator(".memory-row__main");
    const editTargets = [];
    for (let index = 0; index < (await editButtons.count()); index += 1) {
      const button = editButtons.nth(index);
      await button.scrollIntoViewIfNeeded();
      editTargets.push(
        await button.evaluate((element) => {
          const button = element;
          const rect = button.getBoundingClientRect();
          const lowerEdge = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 1);
          return {
            label: button.getAttribute("aria-label"),
            text: button.textContent.trim(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            lowerEdgeHitsButton: lowerEdge?.closest("button.memory-row__main") === button,
          };
        }),
      );
    }
    check(
      editTargets.length > 0 &&
        editTargets.every(
          ({ width, height, lowerEdgeHitsButton }) =>
            width >= 44 && height >= 44 && lowerEdgeHitsButton,
        ),
      `${locale} every Personalization edit row has a 44 px target with a live lower edge`,
      editTargets,
    );
    const editorTargets = [];
    for (let index = 0; index < (await editButtons.count()); index += 1) {
      const button = editButtons.nth(index);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const editor = dialog.locator(".memory-row__editor");
      await editor.waitFor();
      if (index === 0)
        await page.screenshot({ path: `${out}/${locale}-personalization-editor.png` });
      editorTargets.push(
        ...(await editor.evaluate(
          (element, row) =>
            [...element.querySelectorAll("button, input, select, textarea")]
              .filter((control) => control.getClientRects().length > 0)
              .map((control) => {
                const target =
                  control.type === "checkbox" ? (control.closest("label") ?? control) : control;
                const rect = target.getBoundingClientRect();
                return {
                  row,
                  control: control.getAttribute("aria-label") ?? control.textContent.trim(),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                };
              }),
          await button.getAttribute("aria-label"),
        )),
      );
      await button.click();
      await editor.waitFor({ state: "detached" });
    }
    const shortEditorTargets = editorTargets.filter(
      ({ width, height }) => !touchSized(width) || !touchSized(height),
    );
    check(
      editorTargets.length > 0 && shortEditorTargets.length === 0,
      `${locale} every control in an opened Personalization editor is 44 x 44`,
      shortEditorTargets.length ? shortEditorTargets : editorTargets.length,
    );
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) === 390,
      `${locale} phone page has no horizontal overflow`,
    );
    check(errors.length === 0, `${locale} no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
