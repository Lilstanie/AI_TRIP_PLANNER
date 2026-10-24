import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readRun } from "./support/team-run.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/specialist-handoff");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const ASK = { en: "recommend a restaurant", zh: "推荐一家餐厅" };
const OWN = { en: "find a cheaper hotel", zh: "找一家更便宜的酒店" };
const DINING = { en: "Food & dining", zh: "餐饮" };
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

try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const label = `${locale}-${width}`;
      const { context, page, errors } = await open(locale, width);
      const requests = [];
      await page.route("**/api/chat", async (route) => {
        requests.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.continue();
      });

      await send(page, PLAN);
      await send(page, `@${STAY[locale]} ${OWN[locale]}`);
      const own = await readRun(page);
      check(
        own?.assignments.every((item) => item.kind !== "handoff"),
        `${label}: a request the mentioned specialist owns is not handed off`,
      );

      const before = await stored(page);
      const sectionsBefore = Object.fromEntries(
        before.plan.sections.map((section) => [section.id, withoutIds(section.proposal)]),
      );

      await send(page, `@${STAY[locale]} ${ASK[locale]}`);
      check(
        JSON.stringify(requests.at(-1).mentions) === '["accommodation"]',
        `${label}: the mention names the accommodation specialist`,
        requests.at(-1).mentions,
      );
      const run = await readRun(page);
      if (run) {
        const order = run.assignments;
        const declineAt = order.findIndex(
          (row) => row.kind === "handoff" && row.who === "accommodation",
        );
        const diningAt = order.findIndex(
          (row, index) => index > declineAt && row.who === "dining" && row.kind !== "handoff",
        );
        check(
          declineAt >= 0 && diningAt > declineAt,
          `${label}: decline, then the dining specialist`,
          order,
        );
        check(
          order[declineAt]?.text.includes(DINING[locale]),
          `${label}: the decline names the dining specialist`,
          order[declineAt]?.text,
        );
        check(
          order.filter((row) => row.kind === "handoff").length === 1,
          `${label}: the turn hands off once`,
        );
        check(
          order[declineAt]?.marker.length > 0 && order[diningAt]?.marker.length > 0,
          `${label}: decline and dining assignment carry decision markers`,
          [order[declineAt]?.marker, order[diningAt]?.marker],
        );
      } else check(false, `${label}: the team panel did not open for the hand-off`);
      const after = await stored(page);
      const changed = after.plan.sections
        .filter((section) => withoutIds(section.proposal) !== sectionsBefore[section.id])
        .map((section) => section.id);
      check(
        changed.every((id) => id === "dining"),
        `${label}: only the receiving specialist's section may change`,
        changed,
      );
      const who = await replies(page).last().locator(".assistant-icon--dining").count();
      check(who >= 1, `${label}: the reply carries the dining icon`);
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(fits, `${label}: the page does not overflow`);
      await page.screenshot({ path: `${out}/${label}-handoff.png` });
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
