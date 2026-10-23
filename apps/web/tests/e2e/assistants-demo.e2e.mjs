import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/assistants-demo");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const CUSTOM = { en: "Hotel Buddy", zh: "酒店管家" };
const MOVE = { en: "Getting around", zh: "出行交通" };
const ASK = { en: "recommend a restaurant", zh: "推荐一家餐厅" };
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
const menuNames = async (page) => {
  await box(page).fill("@");
  const names = await page.getByRole("listbox").getByRole("option").allInnerTexts();
  await box(page).fill("");
  return names.map((name) => name.trim());
};
const menuCount = async (page, name) =>
  (await menuNames(page)).filter((entry) => entry === name).length;
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

const steps = [];

try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const label = `${locale}-${width}`;
      const { context, page, errors } = await open(locale, width);
      const requests = [];
      let budgetOverride;
      await page.route("**/api/chat", async (route) => {
        const body = JSON.parse(route.request().postData() ?? "{}");
        requests.push(body);
        if (budgetOverride && body.plan) {
          body.brief = { ...body.brief, budgetTotal: budgetOverride };
          body.plan = { ...body.plan, brief: { ...body.plan.brief, budgetTotal: budgetOverride } };
        }
        await route.continue({ postData: JSON.stringify(body) });
      });
      if (width === 390) await toChat(page);

      const sectionMap = async () =>
        Object.fromEntries(
          (await stored(page)).plan.sections.map((section) => [
            section.id,
            withoutIds(section.proposal),
          ]),
        );
      const changedSince = async (before) => {
        const now = await sectionMap();
        return Object.keys(now).filter((id) => now[id] !== before[id]);
      };
      const lastTeam = (selector = ".team-message:not(.team-message--check)") =>
        page.evaluate((query) => {
          const last = [...document.querySelectorAll(".msg-item--agent")].at(-1);
          return [...last.querySelectorAll(query)].map((node) => ({
            who: node.getAttribute("data-assistant"),
            handoff: node.classList.contains("team-message--handoff"),
            text: node.querySelector(".team-message__text")?.textContent ?? "",
          }));
        }, selector);
      const step = async (number, name, run) => {
        const before = checks.length;
        await run();
        const file = `${label}-step${number}-${name}.png`;
        await page.screenshot({ path: `${out}/${file}` });
        steps.push({
          label,
          step: number,
          name,
          screenshot: file,
          checks: checks.slice(before).map((entry) => entry.name),
        });
      };

      await step(1, "plan", async () => {
        await send(page, PLAN);
        const team = await lastTeam();
        const specialists = new Set(
          team.map((row) => row.who).filter((id) => id !== "coordinator"),
        );
        check(
          team.some((row) => row.who === "coordinator") && specialists.size === 5,
          `${label} step 1: the Coordinator and five specialists appear with icons`,
          [...specialists],
        );
        const icons = await replies(page).last().locator(".team-message .assistant-icon").count();
        check(icons >= 6, `${label} step 1: every team message has an icon`, icons);
      });

      await step(2, "mention", async () => {
        const before = await sectionMap();
        requests.length = 0;
        await send(page, `@${STAY[locale]} find a cheaper stay`);
        check(
          JSON.stringify(requests.at(-1).mentions) === '["accommodation"]',
          `${label} step 2: Stay is mentioned by id`,
        );
        const changed = await changedSince(before);
        check(
          changed.every((id) => id === "accommodation"),
          `${label} step 2: only the accommodation section may change`,
          changed,
        );
        check(
          (await replies(page).last().locator(".assistant-icon--accommodation").count()) >= 1,
          `${label} step 2: the reply is under the accommodation icon`,
        );
      });

      await step(3, "conflict", async () => {
        const plan = (await stored(page)).plan;
        const floor = plan.sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
        const spend = plan.sections.reduce((sum, s) => sum + s.estCost, 0);
        budgetOverride = Math.floor((floor + spend) / 2);
        await send(page, `@${STAY[locale]} find a cheaper stay again`);
        budgetOverride = undefined;
        const lines = await replies(page)
          .last()
          .locator(".team-message--check .team-message__text")
          .allInnerTexts();
        check(
          lines.length >= 3 && lines.some((line) => /→/.test(line)),
          `${label} step 3: the budget conflict, score and stop messages are shown`,
          lines,
        );
        check(
          (await replies(page).last().locator(".team-message--check .assistant-icon").count()) ===
            0,
          `${label} step 3: conflict messages are rules, not assistants`,
        );
      });

      await step(4, "two-mentions", async () => {
        requests.length = 0;
        await send(page, `@${STAY[locale]} @${MOVE[locale]} find cheaper options`);
        check(
          JSON.stringify(requests.at(-1).mentions) === '["accommodation","transport"]',
          `${label} step 4: two specialists are sent once each`,
        );
        const workers = new Set(
          (await lastTeam()).map((row) => row.who).filter((id) => id !== "coordinator"),
        );
        check(
          workers.size === 2 && workers.has("accommodation") && workers.has("transport"),
          `${label} step 4: exactly those two specialists work`,
          [...workers],
        );
      });

      await step(5, "hand-off", async () => {
        const before = await sectionMap();
        await send(page, `@${STAY[locale]} ${ASK[locale]}`);
        const rows = await lastTeam();
        const decline = rows.findIndex((row) => row.handoff && row.who === "accommodation");
        const dispatch = rows.findIndex((row, i) => i > decline && row.who === "coordinator");
        const answer = rows.findIndex((row, i) => i > dispatch && row.who === "dining");
        check(
          decline >= 0 && dispatch > decline && answer > dispatch,
          `${label} step 5: decline, Coordinator dispatch, then Food & dining`,
          rows,
        );
        const changed = await changedSince(before);
        check(
          changed.every((id) => id === "dining"),
          `${label} step 5: only the receiving section may change`,
          changed,
        );
      });

      await step(6, "rename", async () => {
        const dialog = await openSettings(page, width);
        const field = dialog.locator(".assistant-names input").nth(ACCOMMODATION);
        await field.fill(CUSTOM[locale]);
        await field.blur();
        await closeSettings(page, dialog, width);
        check(
          (await menuCount(page, CUSTOM[locale])) === 1,
          `${label} step 6: the @ menu shows the new name`,
        );
        requests.length = 0;
        await send(page, `@${CUSTOM[locale]} find a cheaper stay`);
        check(
          JSON.stringify(requests.at(-1).mentions) === '["accommodation"]',
          `${label} step 6: the new name sends the same id`,
        );
        check(
          (await replies(page).last().locator(".msg-item__who strong").innerText()) ===
            CUSTOM[locale],
          `${label} step 6: the reply shows the new name`,
        );
      });

      await step(7, "no-plan", async () => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.locator(".workspace-app").waitFor();
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (width === 390) await toChat(page);
        await send(page, `@${STAY[locale]} when are hotels cheapest?`);
        check(!(await stored(page))?.plan, `${label} step 7: no plan is created`);
        const ask = (await replies(page).last().locator(".msg-item__body").innerText()).replace(
          /\s+/g,
          " ",
        );
        check(
          locale === "zh" ? ask.includes("总预算") : ask.includes("total budget"),
          `${label} step 7: the Coordinator still asks for the brief`,
          ask,
        );
      });

      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(fits, `${label}: the page does not overflow`);
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ steps, checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
