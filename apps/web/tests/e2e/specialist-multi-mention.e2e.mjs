import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/specialist-multi-mention");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const MOVE = { en: "Getting around", zh: "出行交通" };
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
      const planned = await stored(page);
      const before = Object.fromEntries(
        planned.plan.sections.map((section) => [section.id, withoutIds(section.proposal)]),
      );

      requests.length = 0;
      await send(page, `@${STAY[locale]} @${MOVE[locale]} @${STAY[locale]} find cheaper options`);
      const ids = requests.at(-1).mentions;
      check(
        JSON.stringify(ids) === '["accommodation","transport"]',
        `${label}: two specialists are sent once each`,
        ids,
      );
      const after = await stored(page);
      const changed = after.plan.sections
        .filter((section) => withoutIds(section.proposal) !== before[section.id])
        .map((section) => section.id);
      check(
        changed.every((id) => ["accommodation", "transport"].includes(id)),
        `${label}: only the two mentioned sections may change`,
        changed,
      );
      const shown = await page.evaluate(() => {
        const last = [...document.querySelectorAll(".msg-item--agent")].at(-1);
        return [...last.querySelectorAll(".team-message:not(.team-message--check)")].map((node) =>
          node.getAttribute("data-assistant"),
        );
      });
      const workers = new Set(shown.filter((id) => id !== "coordinator"));
      check(
        workers.size === 2 && workers.has("accommodation") && workers.has("transport"),
        `${label}: exactly the two mentioned specialists show work under their own icons`,
        shown,
      );
      const checks = await replies(page)
        .last()
        .locator(".team-message--check .team-message__text")
        .allInnerTexts();
      const firstRound = checks.filter((line) => /^(Conflict check|冲突检查)/.test(line));
      check(
        firstRound.length >= 1 && firstRound.filter((line) => /\b1\b/.test(line)).length === 1,
        `${label}: one conflict check follows both specialists in round 1`,
        checks,
      );
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(fits, `${label}: the page does not overflow`);
      await page.screenshot({ path: `${out}/${label}-multi.png` });
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
