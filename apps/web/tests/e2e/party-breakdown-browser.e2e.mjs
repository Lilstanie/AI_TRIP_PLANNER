import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openTripWorkspace } from "./support/e2e-helpers.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/party-breakdown-browser");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let page;
try {
  for (const language of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const zh = language === "zh";
      const adults = 1;
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
        locale: zh ? "zh-CN" : "en-AU",
      });
      page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.waitForLoadState("networkidle");
      if (width === 390)
        await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
      const mode = page
        .getByRole("button", { name: zh ? /^(实时|示例)数据/ : /^(Live|Mock) data/ })
        .first();
      await mode.waitFor();
      if ((await mode.getAttribute("aria-pressed")) === "true") await mode.click();
      assert.equal(await mode.getAttribute("aria-pressed"), "false");
      if (width === 390)
        await page.getByRole("tab", { name: zh ? "聊天" : "Chat", exact: true }).click();
      await page
        .getByRole("textbox", {
          name: zh ? "向 AI 旅行规划助手发送消息" : "Message AI Trip Planner",
        })
        .fill(
          zh
            ? "请规划 2026-12-01 到 2026-12-03 去悉尼，1 位成人和 1 位小孩，预算 3000 澳元，住在朋友家不需要住宿。"
            : "Plan a 3-day trip to Sydney from 2026-12-01 to 2026-12-03 for 1 adult and 1 child aged 3, total budget AUD 3000. We are staying with friends and need no accommodation.",
        );
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/chat") && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: zh ? "发送" : "Send", exact: true }).click();
      const stream = await (await response).text();
      writeFileSync(`${out}/${language}-${width}.ndjson`, stream);
      assert.equal(JSON.parse(stream.trim().split("\n").at(-1)).type, "complete");
      await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
      for (const reopened of [false, true]) {
        if (reopened) {
          await page.waitForFunction(() =>
            Boolean(JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan),
          );
          await page.reload();
          await page.waitForLoadState("networkidle");
          if (width === 390)
            await page.getByRole("tab", { name: zh ? "我的" : "Mine", exact: true }).click();
          else
            await page
              .locator(".sidebar-nav")
              .getByRole("button", { name: zh ? /^行程/ : /^Trips/ })
              .click();
          await openTripWorkspace(page, page.locator(".trip-card").first());
        }
        if (width === 390) {
          await page.locator(".phone-topbar__title-button").click();
          await page.locator('.facts-sheet__row[data-fact="who"]').click();
        } else {
          await page
            .locator(".fact-chips")
            .getByRole("button", { name: zh ? /成人/ : /1 adult, 1 child/ })
            .click();
        }
        const sheet = page.getByRole("dialog", { name: zh ? "同行人员" : "Who", exact: true });
        for (const [label, count] of [
          [zh ? "成人" : "Adults", adults],
          [zh ? "儿童" : "Children", 1],
          [zh ? "婴儿" : "Infants", 0],
          [zh ? "老人" : "Seniors", 0],
          [zh ? "宠物" : "Pets", 0],
        ]) {
          await sheet.getByLabel(`${label}: ${count}`, { exact: true }).waitFor();
        }
        assert.equal(await page.locator("html").getAttribute("lang"), zh ? "zh-CN" : "en-AU");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        await page.screenshot({
          path: `${out}/${language}-${width}-${reopened ? "reopened" : "planned"}.png`,
          fullPage: true,
        });
        results.push({
          language,
          width,
          reopened,
          adults,
          children: 1,
          infants: 0,
          seniors: 0,
          pets: 0,
        });
        await page.keyboard.press("Escape");
        await sheet.waitFor({ state: "hidden" });
        if (width === 390) await page.waitForFunction(() => !history.state?.tripPhoneOverlay);
      }
      assert.deepEqual(errors, []);
      await context.close();
      page = undefined;
    }
  }
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
