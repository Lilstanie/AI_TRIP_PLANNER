import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, settle } from "./trip-setup.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/chinese-map-splitter-labels");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name, detail) => {
  results.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const KYOTO =
  "Plan 3 days in Kyoto from 12 Mar 2027 for 2 travellers, budget AUD 3000, departing from Sydney";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const locale of ["zh-CN", "en-AU"]) {
    const zh = locale === "zh-CN";
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    await page.waitForFunction((expected) => document.documentElement.lang === expected, locale);
    const composer = page.locator(".composer__input");
    await composer.fill(KYOTO);
    await composer.press("Enter");
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180_000 });
    await settle(page, 1500);

    const notice = page.locator(".trip-map-status--partial");
    await notice.waitFor({ timeout: 30_000 }).catch(async (error) => {
      await page.screenshot({ path: `${out}/${locale}-no-notice.png`, fullPage: true });
      throw error;
    });
    const noticeText = (await notice.innerText()).trim();
    check(
      zh
        ? /\d+ 个活动尚未确定地点/.test(noticeText)
        : /activit(y|ies) (has|have) no confirmed place yet/.test(noticeText),
      `${locale} map notice uses the interface language`,
      { text: noticeText },
    );
    check(
      zh ? !/no confirmed place|activit/.test(noticeText) : !/尚未确定地点/.test(noticeText),
      `${locale} map notice has no text from the other language`,
      { text: noticeText },
    );
    await page.screenshot({ path: `${out}/${locale}-map-notice.png` });

    const separator = page.getByRole("separator", {
      name: zh ? "调整聊天与地图宽度" : "Resize chat and map",
    });
    const valueText = await separator.getAttribute("aria-valuetext");
    check(
      zh ? /^聊天占宽度的 \d+%$/.test(valueText) : /^Chat \d+% of the width$/.test(valueText),
      `${locale} splitter value text uses the interface language`,
      { valueText },
    );
    await separator.focus();
    await page.keyboard.press("ArrowLeft");
    const nextValueText = await separator.getAttribute("aria-valuetext");
    check(
      zh
        ? /^聊天占宽度的 \d+%$/.test(nextValueText)
        : /^Chat \d+% of the width$/.test(nextValueText),
      `${locale} splitter value text follows ArrowLeft`,
      { nextValueText },
    );
    check(errors.length === 0, `${locale} no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
