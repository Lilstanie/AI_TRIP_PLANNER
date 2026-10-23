import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/specialist-mention");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const OPTION_COUNT = 6;

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

      await box(page).fill("@");
      const entries = page.getByRole("listbox").getByRole("option");
      check((await entries.count()) === OPTION_COUNT, `${label}: the @ menu lists six assistants`);
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(fits, `${label}: the @ menu does not overflow the page`);
      await page.screenshot({ path: `${out}/${label}-menu.png` });

      await box(page).fill(`@${STAY[locale]}`);
      await box(page).press("Tab");
      const inserted = await box(page).inputValue();
      check(
        inserted === `@${STAY[locale]} `,
        `${label}: picking from the @ menu inserts a mention`,
        inserted,
      );
      await box(page).fill("");

      await send(page, "Tell me when Tokyo hotels are cheapest, nothing else");
      const plainRequest = requests.at(-1);
      check(!("mentions" in plainRequest), `${label}: a message without a mention carries no ids`);

      requests.length = 0;
      await context.clearCookies();
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
        if (!(await live.count())) break;
        await live.click();
      }

      await send(page, `@${STAY[locale]} when are Tokyo hotels cheapest?`);
      const noPlanRequest = requests.at(-1);
      check(
        JSON.stringify(noPlanRequest.mentions) === '["accommodation"]',
        `${label}: a typed @name resolves to the specialist id`,
        noPlanRequest.mentions,
      );
      const afterNoPlan = await stored(page);
      check(!afterNoPlan?.plan, `${label}: a mention with no plan creates no plan`);
      const noPlanWho = await replies(page)
        .last()
        .locator(".assistant-icon--accommodation")
        .count();
      check(noPlanWho === 1, `${label}: the no-plan answer carries the accommodation icon`);
      const ask = (await replies(page).last().locator(".msg-item__body").innerText()).replace(
        /\s+/g,
        " ",
      );
      check(
        locale === "zh" ? ask.includes("总预算") : ask.includes("total budget"),
        `${label}: the Coordinator still asks for the brief`,
        ask,
      );
      await page.screenshot({ path: `${out}/${label}-no-plan.png` });

      await send(page, PLAN);
      const planned = await stored(page);
      const sectionsBefore = Object.fromEntries(
        planned.plan.sections.map((section) => [section.id, withoutIds(section.proposal)]),
      );

      requests.length = 0;
      await send(page, `@${STAY[locale]} find a cheaper stay`);
      const mentionRequest = requests.at(-1);
      check(
        JSON.stringify(mentionRequest.mentions) === '["accommodation"]',
        `${label}: the mention is sent as an id`,
        mentionRequest.mentions,
      );
      const after = await stored(page);
      const changed = after.plan.sections
        .filter((section) => withoutIds(section.proposal) !== sectionsBefore[section.id])
        .map((section) => section.id);
      check(
        changed.every((id) => id === "accommodation"),
        `${label}: only the mentioned section may change`,
        changed,
      );
      const who = await replies(page).last().locator(".assistant-icon--accommodation").count();
      check(who >= 1, `${label}: the reply carries the accommodation icon`);
      const started = await page.evaluate(() => {
        const last = [...document.querySelectorAll(".msg-item--agent")].at(-1);
        return [...last.querySelectorAll(".team-message:not(.team-message--check)")].map((node) =>
          node.getAttribute("data-assistant"),
        );
      });
      check(
        started.filter((id) => id !== "coordinator").every((id) => id === "accommodation"),
        `${label}: only the accommodation specialist ran`,
        started,
      );
      await page.screenshot({ path: `${out}/${label}-mention.png` });

      const floor = after.plan.sections.reduce(
        (sum, section) => sum + (section.proposal?.floorCost ?? 0),
        0,
      );
      const spend = after.plan.sections.reduce((sum, section) => sum + section.estCost, 0);
      const outputs = after.plan.sections.map((section) => [section.id, section.estCost]);
      budgetOverride = Math.floor((floor + spend) / 2);
      check(
        budgetOverride < spend && budgetOverride >= floor,
        `${label}: a repairable overrun exists`,
        {
          floor,
          spend,
          budgetOverride,
          outputs,
        },
      );
      requests.length = 0;
      await send(page, `@${STAY[locale]} find a cheaper stay again`);
      const checkLines = await replies(page)
        .last()
        .locator(".team-message--check .team-message__text")
        .allInnerTexts();
      check(
        checkLines.length >= 3 &&
          /\d/.test(checkLines[0]) &&
          checkLines.some((line) => /A\$|AUD/.test(line)) &&
          checkLines.some((line) => /→/.test(line)),
        `${label}: a budget overrun shows conflict, score and stop messages`,
        checkLines,
      );
      const ruleStyled = await replies(page)
        .last()
        .locator(".team-message--check .assistant-icon")
        .count();
      check(ruleStyled === 0, `${label}: conflict-check messages are rules, not assistants`);
      await page.screenshot({ path: `${out}/${label}-conflict.png` });
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
