import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/assistant-rename");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const CUSTOM = { en: "Hotel Buddy", zh: "酒店管家" };
const OTHER_DEFAULT = { en: "Day plan", zh: "每日行程" };
const ACCOMMODATION = 3;
const TRANSPORT = 2;
const OTHER = { en: "Rail Pal", zh: "铁路搭子" };
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

async function open(locale, width) {
  const context = await browser.newContext({
    locale: locale === "zh" ? "zh-CN" : "en-AU",
    viewport: { width, height: width === 390 ? 844 : 1000 },
    reducedMotion: "reduce",
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
    await live.click();
  }
  return { context, page, errors };
}

const box = (page) => page.locator(".chat__form textarea");
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"));
const withoutIds = (value) =>
  JSON.stringify(value, (key, item) => (key === "id" ? undefined : item));
const replies = (page) => page.locator(".msg-item--agent");

async function send(page, text) {
  const before = await replies(page).count();
  await box(page).fill(text);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length > count,
    [".msg-item--agent", before],
    { timeout: 240_000 },
  );
  await page.waitForTimeout(800);
}

async function toChat(page) {
  const tab = page.getByRole("tab", { name: /^(Chat|聊天)/ });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
}

async function openSettings(page, width) {
  if (width === 390) {
    await page.getByRole("tab", { name: /^(Mine|我的)/ }).click();
    await page.locator(".phone-mine__settings").click();
  } else {
    await page
      .locator(
        'button[aria-label="Open account menu"]:visible, button[aria-label="打开账户菜单"]:visible',
      )
      .first()
      .click();
    await page.getByRole("menuitem", { name: /^(Personalization|个性化)$/ }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  if (width === 390) await dialog.getByRole("tab", { name: /^(Personalization|个性化)$/ }).click();
  return dialog;
}

async function closeSettings(page, dialog, width) {
  await dialog.locator(".dialog__head button").last().click();
  await dialog.waitFor({ state: "hidden" });
  if (width === 390) await toChat(page);
}

try {
  for (const [locale, width] of [
    ["en", 1440],
    ["en", 390],
    ["zh", 1440],
  ]) {
    const label = `${locale}-${width}`;
    const { context, page, errors } = await open(locale, width);
    const requests = [];
    await page.route("**/api/chat", async (route) => {
      requests.push(JSON.parse(route.request().postData() ?? "{}"));
      await route.continue();
    });
    const chip = (name) => page.locator(".assistant-chips button", { hasText: name });
    const who = () => replies(page).locator(".msg-item__who strong");
    if (width === 390) await toChat(page);

    await send(page, PLAN);
    await send(page, `@${STAY[locale]} find a cheaper stay`);
    check(
      (await who().first().innerText()) === STAY[locale],
      `${label}: earlier reply shows the role name`,
    );

    let dialog = await openSettings(page, width);
    const fields = dialog.locator(".assistant-names input");
    check((await fields.count()) === 6, `${label}: six assistant names are editable`);
    const named = await fields.evaluateAll((nodes) =>
      nodes.every((node) => (node.getAttribute("aria-label") ?? "").length > 0),
    );
    check(named, `${label}: every name field has an accessible name`);
    await page.screenshot({ path: `${out}/${label}-settings.png` });

    await fields.nth(TRANSPORT).fill(OTHER[locale]);
    await fields.nth(TRANSPORT).blur();
    await fields.nth(ACCOMMODATION).fill(`  ${CUSTOM[locale]}  `);
    await fields.nth(ACCOMMODATION).blur();
    const dupError = await dialog.locator(".assistant-name__error").count();
    check(dupError === 0, `${label}: a free custom name saves, trimmed`);
    await fields.nth(TRANSPORT).fill(CUSTOM[locale].toUpperCase());
    await fields.nth(TRANSPORT).blur();
    check(
      (await dialog.locator(".assistant-name__error").count()) === 1,
      `${label}: a name already used by another assistant is rejected with a message`,
    );
    await fields.nth(TRANSPORT).fill(OTHER_DEFAULT[locale]);
    await fields.nth(TRANSPORT).blur();
    check(
      (await dialog.locator(".assistant-name__error").count()) === 1,
      `${label}: another assistant's default name is rejected`,
    );
    await fields.nth(TRANSPORT).fill("");
    await fields.nth(TRANSPORT).blur();
    await fields.nth(ACCOMMODATION).fill("x".repeat(40));
    await fields.nth(ACCOMMODATION).blur();
    const longValue = await fields.nth(ACCOMMODATION).inputValue();
    check(longValue.length <= 24, `${label}: names are limited in length`, longValue.length);
    await fields.nth(ACCOMMODATION).fill(CUSTOM[locale]);
    await fields.nth(ACCOMMODATION).blur();
    await page.screenshot({ path: `${out}/${label}-renamed-settings.png` });
    await closeSettings(page, dialog, width);

    check((await chip(CUSTOM[locale]).count()) === 1, `${label}: the chip shows the custom name`);
    check(
      (await who().first().innerText()) === CUSTOM[locale],
      `${label}: the earlier reply shows the custom name without a reload`,
    );
    await page.locator(".thinking-turn").last().click();
    const rows = await page.locator(`.thinking-subagent[aria-label^="${CUSTOM[locale]}"]`).count();
    check(rows >= 1, `${label}: Subagent rows show the custom name`, rows);
    await page.screenshot({ path: `${out}/${label}-renamed.png` });

    const ask = async (text) => {
      requests.length = 0;
      await send(page, text);
      return JSON.stringify(requests.at(-1).mentions);
    };
    check(
      (await ask(`@${CUSTOM[locale]} find a cheaper stay`)) === '["accommodation"]',
      `${label}: the custom name sends the specialist id`,
    );
    check(
      (await ask(`@${STAY.en} find a cheaper stay`)) === '["accommodation"]',
      `${label}: the default English name still sends the same id`,
    );
    check(
      (await ask(`@${STAY.zh} find a cheaper stay`)) === '["accommodation"]',
      `${label}: the default Chinese name still sends the same id`,
    );

    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    if (width === 390) await toChat(page);
    check(
      (await chip(CUSTOM[locale]).count()) === 1,
      `${label}: the custom name persists across a reload`,
    );

    dialog = await openSettings(page, width);
    const again = dialog.locator(".assistant-names input");
    await again.nth(ACCOMMODATION).fill("");
    await again.nth(ACCOMMODATION).blur();
    await closeSettings(page, dialog, width);
    check(
      (await chip(STAY[locale]).count()) === 1 && (await chip(CUSTOM[locale]).count()) === 0,
      `${label}: clearing the name restores the role name`,
    );
    await page.screenshot({ path: `${out}/${label}-restored.png` });
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    check(fits, `${label}: the page does not overflow`);
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
