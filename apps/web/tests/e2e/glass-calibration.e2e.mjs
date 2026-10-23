import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve("output/playwright/glass-calibration", process.env.LABEL ?? "after");
mkdirSync(OUT, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const check = (condition, label) => {
  results.push({ label, passed: !!condition });
  console.log(`${condition ? "ok" : "FAIL"} ${label}`);
};
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

try {
  for (const width of [1440, 390, 375]) {
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        colorScheme: scheme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) {
          errors.push(`${message.text()} (${message.location().url})`);
        }
      });
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      const tag = `${width}-${scheme}`;
      await shot(page, `${tag}-workspace`);
      check(
        await page
          .locator(".composer")
          .evaluate((el) => getComputedStyle(el).backdropFilter.includes("blur")),
        `${tag}: composer has glass`,
      );
      const language = page.getByRole("button", { name: "Switch language to 简体中文" });
      if (width < 521) await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await language.click();
      await page.locator("html[lang=zh-CN]").waitFor({ state: "attached" });
      if (width < 521) await page.getByRole("tab", { name: "聊天", exact: true }).click();
      await shot(page, `${tag}-zh`);
      if (width < 521) await page.locator(".phone-topbar__title-button").click();
      const trigger =
        width < 521
          ? page.locator('.facts-sheet__row[data-fact="when"]')
          : page.locator(".fact-chip").nth(1);
      await trigger.click();
      const editor = page.getByRole("dialog", { name: "日期", exact: true });
      await editor.waitFor();
      await editor.locator(".trip-calendar").waitFor();
      check(
        await editor.evaluate((el) => {
          const style = getComputedStyle(el);
          return (
            style.getPropertyValue("--glass-fill").trim() ===
            style.getPropertyValue("--glass-bg-strong").trim()
          );
        }),
        `${tag}: editor uses strong material`,
      );
      await shot(page, `${tag}-sheet`);
      await page.keyboard.press("Escape");
      await page.locator(".fact-popover").waitFor({ state: "detached" });
      const focusTarget = width < 521 ? page.locator(".phone-topbar__title-button") : trigger;
      check(
        await focusTarget.evaluate((el) => el === document.activeElement),
        `${tag}: Escape returns focus`,
      );
      await page.keyboard.press("Tab");
      check(
        await page.evaluate(() => {
          const style = getComputedStyle(document.activeElement);
          return style.outlineStyle !== "none" || style.boxShadow !== "none";
        }),
        `${tag}: keyboard focus visible`,
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${tag}: no horizontal overflow`,
      );
      for (const feature of ["prefers-reduced-transparency", "prefers-contrast", "forced-colors"]) {
        const session = await context.newCDPSession(page);
        await session.send("Emulation.setEmulatedMedia", {
          features: [
            { name: "prefers-color-scheme", value: scheme },
            { name: "prefers-reduced-motion", value: "reduce" },
            {
              name: feature,
              value:
                feature === "prefers-contrast"
                  ? "more"
                  : feature === "forced-colors"
                    ? "active"
                    : "reduce",
            },
          ],
        });
        check(
          await page.evaluate((name) => {
            const value =
              name === "prefers-contrast" ? "more" : name === "forced-colors" ? "active" : "reduce";
            return matchMedia(`(${name}: ${value})`).matches;
          }, feature),
          `${tag}: ${feature} emulation active`,
        );
        check(
          await page
            .waitForFunction(
              () => {
                const selectors = [
                  ".composer",
                  ".fact-chips__scroller",
                  ".topbar-icon-button",
                  ".location-prompt",
                  ".workspace-sidebar",
                ];
                return selectors
                  .flatMap((selector) => [...document.querySelectorAll(selector)])
                  .filter((el) => el.getClientRects().length)
                  .every((el) => {
                    const style = getComputedStyle(el);
                    return (
                      style.backdropFilter === "none" &&
                      !style.backgroundColor.match(/rgba\([^)]*,\s*0\./)
                    );
                  });
              },
              null,
              { timeout: 3000 },
            )
            .then(
              () => true,
              () => false,
            ),
          `${tag}: ${feature} surfaces opaque without blur`,
        );
        check(
          await page
            .locator(".composer")
            .evaluate((el) => getComputedStyle(el, "::before").display === "none"),
          `${tag}: ${feature} hides sheen`,
        );
        await shot(page, `${tag}-${feature}`);
        await session.detach();
      }
      check(!errors.length, `${tag}: no console or page errors ${errors.join("; ")}`);
      await context.close();
    }
  }
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
assert(
  results.length > 0 && results.every((result) => result.passed),
  "Glass calibration checks failed",
);
