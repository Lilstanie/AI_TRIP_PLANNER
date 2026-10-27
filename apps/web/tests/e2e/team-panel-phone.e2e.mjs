import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/team-panel-phone");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const NAME = { en: "Agent Team", zh: "智能体团队" };
const WORKING_NAME = {
  en: (count) => `Agent Team, ${count} working`,
  zh: (count) => `智能体团队，${count} 个正在工作`,
};
const IDLE = { en: "Idle", zh: "空闲" };
const IDS = [
  "coordinator",
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
];
const MARKERS = { en: ["Decided by AI", "Decided by code"], zh: ["AI 决定", "程序决定"] };

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

try {
  for (const [locale, width, height] of [
    ["en", 390, 844],
    ["en", 360, 800],
    ["zh", 390, 844],
  ]) {
    const label = `${locale}-${width}`;
    const context = await browser.newContext({
      locale: locale === "zh" ? "zh-CN" : "en-AU",
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
    await page.getByRole("tab", { name: /^(Chat|聊天)/ }).click();

    const button = page.locator(".workspace-topbar .phone-topbar__team");
    const sheet = page.locator("dialog.phone-trajectory[open]");
    const rows = sheet.locator(".team-panel__row");
    const topbar = () => page.locator(".workspace-topbar").boundingBox();
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

    check((await button.count()) === 1, `${label}: the top bar has one Agent Team button`);
    check(
      (await button.getAttribute("aria-label")) === NAME[locale],
      `${label}: the idle button has a localized Agent Team name`,
    );
    check(
      await page.evaluate(() => {
        const title = document.querySelector(".phone-topbar__title");
        const trigger = document.querySelector(".workspace-topbar .team-trigger");
        if (!title || !trigger) return false;
        return (
          title.getBoundingClientRect().right <= trigger.getBoundingClientRect().left + 1 &&
          trigger.getBoundingClientRect().right <= window.innerWidth
        );
      }),
      `${label}: the button sits right of the trip title`,
    );
    const target = await button.boundingBox();
    check(
      target && target.width >= 44 && target.height >= 44,
      `${label}: the button is at least 44px`,
      target,
    );
    check(
      (await button.locator(".team-trigger__label, .team-trigger__count").count()) === 0,
      `${label}: the button shows avatars only`,
    );
    const bar = await topbar();
    check(bar && bar.height <= 64, `${label}: the top bar is one row`, bar?.height);
    check((await sheet.count()) === 0, `${label}: the sheet is closed at first`);

    await button.tap();
    await sheet.waitFor();
    await page.waitForTimeout(400);
    check(
      (await sheet.getAttribute("aria-modal")) === "true",
      `${label}: the sheet is a modal dialog`,
    );
    check(
      (await button.getAttribute("aria-expanded")) === "true",
      `${label}: the button reports it is expanded`,
    );
    await sheet.locator(".phone-trajectory__team > summary").tap();
    check((await rows.count()) === 6, `${label}: six assistant rows`, await rows.count());
    const idle = await rows.evaluateAll((nodes) =>
      nodes.map((n) => [n.getAttribute("data-assistant"), n.getAttribute("data-status")]),
    );
    check(
      JSON.stringify(idle.map((r) => r[0])) === JSON.stringify(IDS) &&
        idle.every((r) => r[1] === "idle"),
      `${label}: every row is idle in the fixed order`,
      idle,
    );
    const statuses = await rows.locator(".team-panel__status").allInnerTexts();
    check(
      statuses.length === 6 && statuses.every((s) => s === IDLE[locale]),
      `${label}: idle statuses use the interface language`,
      statuses,
    );
    check(
      await sheet.evaluate((n) => n.contains(document.activeElement)),
      `${label}: focus moves into the sheet`,
    );
    const trapped = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      trapped.push(await sheet.evaluate((n) => n.contains(document.activeElement)));
    }
    check(trapped.every(Boolean), `${label}: Tab stays inside the sheet`, trapped);
    const frame = await sheet.boundingBox();
    check(
      frame && frame.x >= 0 && frame.x + frame.width <= width && frame.y + frame.height <= height,
      `${label}: the sheet stays inside the viewport`,
      frame,
    );
    check(await noSideScroll(), `${label}: no horizontal overflow with the sheet open`);
    await page.screenshot({ path: `${out}/${label}-idle.png` });

    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
    check(
      await page.evaluate(() => document.activeElement?.classList.contains("team-trigger")),
      `${label}: Esc closes the sheet and returns focus to the button`,
    );
    await button.tap();
    await sheet.waitFor();
    await page.waitForTimeout(300);
    await page.goBack();
    await sheet.waitFor({ state: "hidden" });
    check(true, `${label}: Browser Back closes the trajectory`);
    await button.tap();
    await sheet.waitFor();
    await page.waitForTimeout(300);
    await sheet.locator(".phone-trajectory__close").tap();
    await sheet.waitFor({ state: "hidden" });
    check(true, `${label}: the close button closes the sheet`);

    await page.locator(".phone-topbar__title-button").tap();
    await page.locator("#trip-facts-sheet").waitFor();
    check((await sheet.count()) === 0, `${label}: the trip facts sheet opens alone`);
    await page.keyboard.press("Escape");
    await page.locator("#trip-facts-sheet").waitFor({ state: "detached" });

    await page.locator(".chat-empty__suggestions button").first().click();
    const caught = await page
      .waitForFunction(
        () => {
          const trigger = document.querySelector(".workspace-topbar .team-trigger");
          const working = Number(trigger?.getAttribute("data-working"));
          return working > 0
            ? { working, pulsing: trigger.querySelectorAll(".assistant-icon--working").length }
            : false;
        },
        undefined,
        { polling: "raf", timeout: 60_000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => undefined);
    check(
      caught && caught.working > 0 && caught.pulsing > 0,
      `${label}: the button avatars show who is working`,
      caught,
    );
    const workingButton = await button.evaluate((element) => ({
      label: element.getAttribute("aria-label"),
      iconCount: element.querySelectorAll(".team-trigger__avatars .assistant-icon").length,
      count: element.querySelector(".team-trigger__count-compact")?.textContent?.trim(),
    }));
    check(
      workingButton.label === WORKING_NAME[locale](caught?.working ?? 0) &&
        workingButton.iconCount === 1 &&
        workingButton.count === String(caught?.working ?? 0),
      `${label}: the working button shows one icon and a localized numeric count`,
      workingButton,
    );
    check(
      ((await topbar())?.height ?? 99) <= 64,
      `${label}: the top bar stays one row while planning`,
    );
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(800);
    const bar2 = await topbar();
    const title = await page.locator(".phone-topbar__title-text").evaluate((n) => ({
      wrap: getComputedStyle(n).whiteSpace,
      overflow: getComputedStyle(n).textOverflow,
    }));
    check(
      bar2 && bar2.height <= 64 && title.wrap === "nowrap" && title.overflow === "ellipsis",
      `${label}: the title truncates and the top bar stays one row`,
      { bar: bar2?.height, ...title },
    );

    await button.tap();
    await sheet.waitFor();
    await page.waitForTimeout(400);
    const settled = await rows.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-status")),
    );
    check(
      settled.length === 6 && settled.every((s) => s === "done"),
      `${label}: every assistant is done after the plan`,
      settled,
    );
    const assignments = sheet.locator(".team-panel__assignment");
    const owners = await assignments.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-assistant")),
    );
    check(
      IDS.slice(1).every((id) => owners.includes(id)),
      `${label}: the sheet lists each specialist's assignment`,
      owners,
    );
    const markers = await assignments.locator(".team-panel__marker").allInnerTexts();
    check(
      markers.length === owners.length && markers.every((m) => MARKERS[locale].includes(m)),
      `${label}: every assignment says who decided`,
      markers,
    );
    const scroll = await sheet.evaluate((n) => {
      const scroller = [n, ...n.querySelectorAll("*")].find(
        (el) =>
          el.scrollHeight > el.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(el).overflowY),
      );
      if (!scroller) return { scrolls: false, fits: n.scrollHeight <= n.clientHeight + 1 };
      const before = scroller.scrollTop;
      scroller.scrollTop = scroller.scrollHeight;
      return { scrolls: scroller.scrollTop > before, fits: false };
    });
    check(
      scroll.scrolls || scroll.fits,
      `${label}: long content scrolls inside the sheet or fits`,
      scroll,
    );
    check(await noSideScroll(), `${label}: no horizontal overflow with assignments`);
    await page.screenshot({ path: `${out}/${label}-settled.png` });

    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "hidden" });
    await page.waitForTimeout(400);
    const tripTab = page.getByRole("tablist").getByRole("tab", { name: /^(Trip|行程)/ });
    await tripTab.tap({ timeout: 5000 });
    check(
      (await tripTab.getAttribute("aria-selected")) === "true",
      `${label}: the tab bar is reachable after closing`,
    );
    await page.screenshot({ path: `${out}/${label}-closed.png` });

    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator(".workspace-app[data-phone]").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page
    .locator(".workspace-topbar")
    .getByRole("button", { name: "Agent Team", exact: true })
    .click();
  await page.locator("dialog.phone-trajectory[open]").waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  check(
    (await page.locator("dialog.phone-trajectory[open]").count()) === 0,
    "resizing to desktop closes the phone sheet",
  );
  check(
    (await page.locator(".workspace-topbar .team-trigger").count()) === 1 &&
      (await page.locator(".topbar-leading .team-trigger").count()) === 1 &&
      (await page.locator(".topbar-actions .team-trigger").count()) === 0,
    "desktop keeps a single Agent Team button in the top-left",
  );
  await context.close();
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
