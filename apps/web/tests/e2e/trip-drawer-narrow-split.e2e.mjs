import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, planSuggestedTrip } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  "output/playwright/trip-drawer-narrow-split",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: "en-AU" });
  await page.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  await planSuggestedTrip(page);
  const dismiss = page.getByRole("button", { name: "Not now", exact: true });
  if (await dismiss.isVisible()) await dismiss.click();
  for (const language of ["en", "zh"]) {
    const zh = language === "zh";
    if (zh) await page.getByRole("button", { name: "Switch language to 简体中文" }).click();
    for (const [width, height] of [
      [1024, 768],
      [1440, 1000],
    ]) {
      const label = `${language}/${width}`;
      await page.setViewportSize({ width, height });
      const close = page.getByRole("button", {
        name: zh ? "关闭行程" : "Close your trip",
        exact: true,
      });
      if (await close.isVisible()) await close.click();
      const separator = page.getByRole("separator", {
        name: zh ? "调整聊天与地图宽度" : "Resize chat and map",
      });
      await separator.focus();
      await separator.press("End");
      await page
        .getByRole("button", { name: zh ? "打开你的行程" : "Open your trip", exact: true })
        .click();
      const body = page.locator(".drawer__body:visible").last();
      await body.waitFor();
      await page.waitForTimeout(600);
      const report = await body.evaluate((root) => {
        const edge = root.getBoundingClientRect();
        const clipped = [];
        for (const node of root.querySelectorAll("*")) {
          const rect = node.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const style = getComputedStyle(node);
          if (style.visibility === "hidden" || node.closest("[hidden], .sr-only")) continue;
          let scroller = node.parentElement;
          while (
            scroller &&
            scroller !== root &&
            !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)
          )
            scroller = scroller.parentElement;
          if (scroller && scroller !== root) continue;
          const pastEdge = rect.right > edge.right + 1 || rect.left < edge.left - 1;
          const scrolls =
            node.scrollWidth > node.clientWidth + 1 &&
            ["hidden", "clip"].includes(style.overflowX) &&
            style.textOverflow !== "ellipsis";
          if (pastEdge || scrolls)
            clipped.push({
              tag: node.tagName.toLowerCase(),
              className: String(node.className).slice(0, 80),
              text: (node.textContent ?? "").trim().slice(0, 40),
              left: Math.round(rect.left - edge.left),
              right: Math.round(rect.right - edge.left),
              width: Math.round(rect.width),
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth,
              minWidth: style.minWidth,
            });
        }
        return {
          drawer: Math.round(edge.width),
          scroll: root.scrollWidth,
          client: root.clientWidth,
          clipped: clipped.slice(0, 12),
          count: clipped.length,
        };
      });
      check(
        report.scroll <= report.client + 1 && report.count === 0,
        `${label}: Trip drawer content fits at the narrowest split`,
        report,
      );
      await page.locator(".drawer__body:visible .timeline-stop").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${language}-${width}.png` });
    }
  }
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
