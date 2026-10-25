import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-empty");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const COPY = {
  en: {
    locale: "en-AU",
    tab: /^Trajectory/,
    chat: /^Chat/,
    empty:
      "Nothing here yet. Send a message in Chat and each step the assistant takes will be listed here.",
    plan: "Plan in Chat",
  },
  zh: {
    locale: "zh-CN",
    tab: /^轨迹/,
    chat: /^聊天/,
    empty: "还没有记录。在聊天里发送消息后，助手的每个步骤都会列在这里。",
    plan: "去聊天规划",
  },
};

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

try {
  for (const locale of ["en", "zh"]) {
    const copy = COPY[locale];
    const label = `${locale}-375`;
    const context = await browser.newContext({
      locale: copy.locale,
      viewport: { width: 375, height: 667 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
    await page.goto(base);
    await page.locator(".workspace-app[data-phone]").waitFor();
    await page.waitForLoadState("networkidle");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
      if (!(await live.count())) break;
      if (!(await live.first().isVisible()))
        await page.getByRole("tab", { name: /^(Mine|我的)/ }).click();
      await live.first().click();
      await page.waitForTimeout(300);
    }
    const bar = page.locator(".phone-tabbar");
    const panel = page.locator("dialog.phone-trajectory[open]");
    const empty = page.locator(".trajectory-empty");
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

    await page.locator(".phone-topbar__team").tap();
    await panel.waitFor();
    await empty.waitFor();
    check(
      (await empty.getByText(copy.empty).count()) === 1,
      `${label}: the empty trajectory explains what will appear`,
    );
    check(
      (await panel.getByRole("toolbar").count()) === 0,
      `${label}: no toolbar is shown over the empty state`,
    );
    check(await noSideScroll(), `${label}: the page does not scroll sideways`);
    await page.screenshot({ path: `${out}/${label}-empty.png` });

    await empty.getByRole("button", { name: copy.plan }).tap();
    await page.locator(".workspace-panel--chat").waitFor();
    check(
      await page.locator(".workspace-panel--chat").isVisible(),
      `${label}: Plan in Chat opens the chat`,
    );

    await page.locator(".chat-empty__suggestions button").first().tap();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(800);
    await page.locator(".phone-topbar__team").tap();
    await panel.waitFor();
    await panel.getByRole("toolbar").waitFor({ timeout: 10_000 });
    check(
      (await empty.count()) === 0,
      `${label}: the ledger replaces the empty state after the first message`,
    );
    const rows = panel.locator("tr[data-record-index]");
    check(
      (await rows.count()) > 0,
      `${label}: the ledger lists the chat's records`,
      await rows.count(),
    );
    check(errors.length === 0, `${label}: no page errors`, errors.slice(0, 3));
    await page.screenshot({ path: `${out}/${label}-ledger.png` });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
