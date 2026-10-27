import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/summary-jump");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const TURNS = [PLAN, "make the stay cheaper", "add a day trip to Hakone"];
const COPY = {
  en: { locale: "en-AU", chat: /^Chat/, trajectory: /^Trajectory/ },
  zh: { locale: "zh-CN", chat: /^聊天/, trajectory: /^轨迹/ },
};
const box = (page) => page.locator(".chat__form textarea");
const SUMMARY = ".msg-item--agent .thinking-turn .thinking-row__summary-button";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

async function send(page, text) {
  const before = await page.locator(".msg-item--agent").count();
  await box(page).fill(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length > count,
    [".msg-item--agent", before],
    { timeout: 240_000 },
  );
  await page.waitForTimeout(800);
}

const rowState = (page, text) =>
  page.evaluate((needle) => {
    const pane = document.querySelector("[data-trajectory-scroll]");
    if (!pane) return "no ledger";
    const rect = pane.getBoundingClientRect();
    const row = [...pane.querySelectorAll('tr[data-kind="user"]')].find((node) =>
      node.innerText.includes(needle),
    );
    if (!row) return "absent";
    const box = row.getBoundingClientRect();
    return box.top >= rect.top - 1 && box.bottom <= rect.bottom + 1 ? "in view" : "out of view";
  }, text);

async function settle(page, text) {
  let state = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    state = await rowState(page, text);
    if (state === "in view") return state;
    await page.waitForTimeout(150);
  }
  return state;
}

try {
  for (const [locale, width, height] of [
    ["en", 1440, 1000],
    ["en", 390, 844],
    ["zh", 1440, 1000],
    ["zh", 390, 844],
  ]) {
    const copy = COPY[locale];
    const label = `${locale}-${width}`;
    const phone = width === 390;
    const context = await browser.newContext({
      locale: copy.locale,
      viewport: { width, height },
      reducedMotion: "reduce",
      ...(phone ? { hasTouch: true, isMobile: true } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(base);
    await page.locator(".workspace-app").waitFor();
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
    const toChat = async () => {
      if (phone) {
        if (await page.locator("dialog.phone-trajectory[open]").count()) {
          await page.locator(".phone-trajectory__close").click();
          await page.locator("dialog.phone-trajectory[open]").waitFor({ state: "hidden" });
        }
        await bar.getByRole("tab", { name: copy.chat }).click();
      } else await page.locator("#chat-tab-conversation").click();
      await page.locator(".chat__stream").waitFor({ state: "visible" });
    };
    const trajectoryShown = async () => {
      if (phone) {
        await page.locator("dialog.phone-trajectory[open]").waitFor();
        return true;
      }
      return (await page.locator("#chat-tab-trajectory").getAttribute("aria-selected")) === "true";
    };
    if (phone) await toChat();

    for (const text of TURNS) await send(page, text);
    const summaries = page.locator(SUMMARY);
    const count = await summaries.count();
    check(count === 3, `${label}: each of three replies has a summary button`, count);
    const names = await summaries.allInnerTexts();
    check(
      names.every((name) => name.trim().length > 0),
      `${label}: the summaries read as text`,
      names,
    );

    const nested = await page.locator('.msg-item--agent [role="button"] button').count();
    check(nested === 0, `${label}: no summary button sits inside another button`, nested);

    const think = page.locator(".msg-item--agent .thinking-turn").nth(1);
    const line = think.locator(":scope > .thinking-row__line > .thinking-row__toggle");
    const before = await line.getAttribute("aria-expanded");
    await summaries.nth(1).click();
    check(await trajectoryShown(), `${label}: the second summary opens the trajectory`);
    await toChat();
    check(
      (await line.getAttribute("aria-expanded")) === before,
      `${label}: pressing the summary does not toggle the Think row`,
    );
    await line.click();
    check(
      (await line.getAttribute("aria-expanded")) !== before,
      `${label}: pressing the Think title still toggles the row`,
    );
    await line.click();

    await summaries.nth(1).click();
    check(
      (await settle(page, TURNS[1])) === "in view",
      `${label}: the second reply's summary shows the second turn`,
      await rowState(page, TURNS[1]),
    );
    const first = await rowState(page, TURNS[0]);
    check(first !== "in view", `${label}: the first turn is out of view`, first);
    await page.waitForTimeout(1000);
    const off = await page.evaluate((needle) => {
      const pane = document.querySelector("[data-trajectory-scroll]");
      const row = [...(pane?.querySelectorAll('tr[data-kind="user"]') ?? [])].find((node) =>
        node.innerText.includes(needle),
      );
      if (!pane || !row) return 1;
      const rect = pane.getBoundingClientRect();
      const box = row.getBoundingClientRect();
      return Math.abs(box.top + box.height / 2 - (rect.top + rect.height / 2)) / rect.height;
    }, TURNS[1]);
    check(off < 0.25, `${label}: the second turn is centred in the ledger`, off);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${label}: the page does not scroll sideways`,
    );
    await page.screenshot({ path: `${out}/${label}-turn-2.png` });

    await toChat();
    await summaries.nth(2).click();
    check(
      (await settle(page, TURNS[2])) === "in view",
      `${label}: the third reply's summary shows the third turn`,
    );
    const second = await rowState(page, TURNS[1]);
    check(second !== "in view", `${label}: the second turn leaves the view`, second);
    await page.screenshot({ path: `${out}/${label}-turn-3.png` });

    await toChat();
    await summaries.nth(0).focus();
    await page.keyboard.press("Enter");
    check(
      (await settle(page, TURNS[0])) === "in view",
      `${label}: Enter on the first summary shows the first turn`,
    );
    await page.screenshot({ path: `${out}/${label}-turn-1.png` });

    await toChat();
    const trigger = page.locator(".team-trigger:visible").first();
    if (phone) {
      await trigger.click();
      await page.locator(".phone-trajectory__team > summary").click();
    } else {
      await page.mouse.move(5, 500);
      await trigger.hover();
    }
    await page.locator('.team-panel__row[data-assistant="dining"] button').click();
    await page.locator("[data-trajectory-filter]").waitFor();
    await toChat();
    await summaries.nth(1).click();
    await page.locator("[data-trajectory-scroll]").waitFor();
    check(
      (await page.locator("[data-trajectory-filter]").count()) === 0,
      `${label}: the summary clears a specialist filter`,
    );
    check(
      (await settle(page, TURNS[1])) === "in view",
      `${label}: the second turn shows after a filter was cleared`,
    );

    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
