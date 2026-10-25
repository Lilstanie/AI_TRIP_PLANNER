import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-phone");
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
    team: "Agent Team",
    details: "Event details",
    close: "Close details",
    timeline: "Trajectory timeline",
    showAll: "Show all records",
    chat: /^Chat/,
    map: /^Map/,
  },
  zh: {
    locale: "zh-CN",
    tab: /^轨迹/,
    team: "专家团队",
    details: "事件详情",
    close: "关闭详情",
    timeline: "轨迹时间线",
    showAll: "显示全部记录",
    chat: /^聊天/,
    map: /^地图/,
  },
};
const IDS = [
  "coordinator",
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
];

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

try {
  for (const [locale, width, height] of [
    ["en", 390, 844],
    ["en", 360, 800],
    ["zh", 390, 844],
  ]) {
    const copy = COPY[locale];
    const label = `${locale}-${width}`;
    const context = await browser.newContext({
      locale: copy.locale,
      viewport: { width, height },
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
    const tabs = bar.getByRole("tab");
    const trigger = page.locator(".phone-topbar__team");
    const tab = { tap: () => trigger.tap() };
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    const overflowing = () =>
      page.evaluate(() => {
        const panel = document.querySelector("dialog.phone-trajectory[open]");
        if (!panel) return ["no panel"];
        return [panel, ...panel.querySelectorAll("*")].flatMap((n) => {
          const scrolls = /auto|scroll/.test(getComputedStyle(n).overflowX);
          return scrolls && n.scrollWidth > n.clientWidth + 1
            ? [`${n.tagName}.${String(n.className).slice(0, 40)} ${n.scrollWidth}/${n.clientWidth}`]
            : [];
        });
      });

    await bar.getByRole("tab", { name: copy.chat }).click();
    check(
      (await bar.getByRole("tab", { name: copy.tab }).count()) === 0,
      `${label}: trajectory has no primary tab`,
    );
    check(
      (await tabs.count()) === 3,
      `${label}: three primary tabs before planning`,
      await tabs.count(),
    );
    const boxes = await tabs.evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().toJSON()),
    );
    check(
      boxes.every(
        (b, i) => b.width >= 44 && b.height >= 44 && (i === 0 || b.left >= boxes[i - 1].right - 1),
      ) && boxes.at(-1).right <= width + 1,
      `${label}: tabs are 44px targets that fit without overlap`,
      boxes.map((b) => Math.round(b.width)),
    );

    await tab.tap();
    const panel = page.locator("dialog.phone-trajectory[open]");
    await panel.waitFor();
    check(
      (await trigger.getAttribute("aria-expanded")) === "true",
      `${label}: the team entry is expanded`,
    );
    check(await panel.isVisible(), `${label}: the trajectory panel shows`);
    check(
      await panel.evaluate((node) => node.contains(document.activeElement)),
      `${label}: trajectory owns focus above Chat`,
    );
    await page.screenshot({ path: `${out}/${label}-empty.png` });

    await panel.locator(".phone-trajectory__close").tap();
    await page.locator(".chat-empty__suggestions button").first().tap();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(800);
    await tab.tap();
    await panel.waitFor();
    const rows = panel.locator("tr[data-record-index]");
    await rows.first().waitFor({ timeout: 10_000 });
    const count = await rows.count();
    check(count > 6, `${label}: the ledger lists the chat's records`, count);
    check(
      (await panel.getByRole("region", { name: copy.timeline }).count()) === 0,
      `${label}: no timeline overview on the phone`,
    );
    check(await noSideScroll(), `${label}: the page does not scroll sideways`);
    const wide = await overflowing();
    check(
      wide.length === 0,
      `${label}: nothing in the trajectory panel scrolls sideways`,
      wide.slice(0, 5),
    );
    const toolbar = panel.getByRole("toolbar");
    const controls = toolbar.locator("button, input");
    const sizes = await controls.evaluateAll((nodes) =>
      nodes.map((n) => {
        const box = n.getBoundingClientRect();
        return {
          w: Math.round(box.width),
          h: Math.round(box.height),
          font: parseFloat(getComputedStyle(n).fontSize),
        };
      }),
    );
    check(
      sizes.length === 3 && sizes.every((s) => s.w >= 44 && s.h >= 44),
      `${label}: toolbar controls are 44px targets`,
      sizes,
    );
    check(
      sizes.at(-1).font >= 16,
      `${label}: the search field text is 16px so iOS does not zoom`,
      sizes.at(-1).font,
    );
    const rowHeights = await rows.evaluateAll((nodes) =>
      nodes.slice(0, 12).map((n) => n.getBoundingClientRect().height),
    );
    check(
      rowHeights.length > 0 && rowHeights.every((h) => h >= 55 && h <= 58),
      `${label}: ledger rows are one 56px card each`,
      rowHeights.map(Math.round),
    );
    await page.screenshot({ path: `${out}/${label}-ledger.png` });

    await rows.nth(2).tap();
    const aside = page.getByRole("complementary", { name: copy.details });
    await aside.waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    const frame = await aside.boundingBox();
    const host = await panel.boundingBox();
    check(
      frame && host && frame.width >= host.width - 2 && frame.x >= host.x - 1,
      `${label}: the inspector opens full width`,
      { frame, host },
    );
    check(await noSideScroll(), `${label}: no sideways scroll with the inspector open`);
    await page.screenshot({ path: `${out}/${label}-record.png` });
    await aside.getByRole("button", { name: copy.close }).tap();
    await aside.waitFor({ state: "detached" });
    check((await rows.count()) === count, `${label}: closing the inspector returns to the ledger`);

    await panel.locator(".phone-trajectory__close").tap();
    await bar.getByRole("tab", { name: copy.map }).tap();
    const button = trigger;
    await button.tap();
    const sheet = panel;
    await sheet.waitFor();
    await page.waitForTimeout(400);
    await sheet.locator(".phone-trajectory__team > summary").tap();
    const members = sheet.locator(".team-panel__row");
    check((await members.count()) === 6, `${label}: six member cards`, await members.count());
    const ids = await members.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-assistant")),
    );
    check(JSON.stringify(ids) === JSON.stringify(IDS), `${label}: members in the fixed order`);
    check(
      (await sheet.locator(".team-panel__assignment").count()) >= 5,
      `${label}: the task board lists the assignments`,
    );
    const pressable = await members.evaluateAll((nodes) =>
      nodes.map((n) => !n.querySelector("button")?.disabled),
    );
    check(
      pressable.filter(Boolean).length >= 5,
      `${label}: involved cards have an action`,
      pressable,
    );
    check(await noSideScroll(), `${label}: no sideways scroll with the sheet open`);
    await page.screenshot({ path: `${out}/${label}-sheet.png` });

    await sheet.locator('.team-panel__row[data-assistant="dining"] button').tap();
    await sheet.locator(".phone-trajectory__team:not([open])").waitFor();
    await page.waitForTimeout(300);
    check(
      (await bar.getByRole("tab", { name: copy.map }).getAttribute("aria-selected")) === "true",
      `${label}: a specialist opens filtered trajectory without changing Map`,
    );
    const filter = page.locator("[data-trajectory-filter]");
    await filter.waitFor();
    check(
      (await filter.getAttribute("data-trajectory-filter")) === "dining",
      `${label}: the bar names the specialist`,
    );
    const owners = await panel
      .locator("tr[data-record-index]")
      .evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute("data-assistant")))]);
    check(
      owners.length >= 1 && owners.every((o) => o === "dining"),
      `${label}: only that specialist's records show`,
      owners,
    );
    check(await noSideScroll(), `${label}: no sideways scroll while filtered`);
    await page.screenshot({ path: `${out}/${label}-filtered.png` });
    await filter.getByRole("button", { name: copy.showAll }).tap();
    await filter.waitFor({ state: "detached" });
    check((await rows.count()) === count, `${label}: Show all records restores the ledger`);

    await panel.locator(".phone-trajectory__close").tap();
    await bar.getByRole("tab", { name: copy.chat }).tap();
    check(await page.locator(".workspace-panel--chat").isVisible(), `${label}: Chat comes back`);
    await button.tap();
    await sheet.waitFor();
    await page.waitForTimeout(300);
    await sheet.locator(".phone-trajectory__team > summary").tap();
    await sheet.locator('.team-panel__row[data-assistant="transport"] button').tap();
    await sheet.locator(".phone-trajectory__team:not([open])").waitFor();
    check(
      (await page.locator("[data-trajectory-filter]").getAttribute("data-trajectory-filter")) ===
        "transport",
      `${label}: a card opens the filtered trajectory from the chat`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(600);
    check(
      (await page.locator("#chat-tab-conversation").getAttribute("aria-selected")) === "true" &&
        (await page.locator("[data-trajectory-filter]").count()) === 0,
      `${label}: a card pressed on the phone is not replayed on desktop`,
    );
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator(".workspace-app[data-phone]").waitFor();
  await page.locator(".phone-topbar__team").click();
  await page.locator("dialog.phone-trajectory[open]").waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  check(
    (await page.getByRole("tab", { name: "Conversation" }).getAttribute("aria-selected")) ===
      "true" && (await page.locator("#chat-panel-conversation").isVisible()),
    "resizing to desktop falls back to the conversation",
  );
  await context.close();
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
