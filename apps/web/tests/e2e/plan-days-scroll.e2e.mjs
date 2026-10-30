import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/plan-days-scroll",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const REQUEST = "Lisbon, 2027-11-02 to 2027-11-07, 2 people, budget $3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const plan = async (page) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const box = page.locator("textarea").first();
  await box.fill(REQUEST);
  await box.press("Enter");
  await page
    .locator(".msg-item--agent")
    .last()
    .locator(".msg-item__clock")
    .waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
};

const state = (page) =>
  page.evaluate(() => {
    const strip = [...document.querySelectorAll(".msg-item--agent .plan-days")].at(-1);
    const scroller = strip?.parentElement;
    const rect = strip?.getBoundingClientRect();
    const visible = (selector) => {
      const node = scroller?.querySelector(selector);
      if (!node) return undefined;
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        shown: style.display !== "none" && box.width > 0,
        label: node.getAttribute("aria-label"),
        tabIndex: node.tabIndex,
      };
    };
    const cards = [...(strip?.querySelectorAll(".plan-day") ?? [])].map((card) => {
      const box = card.getBoundingClientRect();
      return { left: Math.round(box.left), right: Math.round(box.right) };
    });
    return {
      scrollLeft: Math.round(strip?.scrollLeft ?? 0),
      overflow: strip ? strip.scrollWidth - strip.clientWidth : 0,
      strip: rect && { left: Math.round(rect.left), right: Math.round(rect.right) },
      mask: strip ? getComputedStyle(strip).maskImage : "",
      start: visible(".plan-days__scroll--start"),
      end: visible(".plan-days__scroll--end"),
      cards,
    };
  });
const fadesRight = (mask) => /transparent\)$|rgba\(0, 0, 0, 0\)\)$/.test(mask.trim());
const fadesLeft = (mask) =>
  /^linear-gradient\(to right, (transparent|rgba\(0, 0, 0, 0\))/.test(mask.trim());

const journeys = [
  {
    label: "desktop",
    locale: "en-AU",
    viewport: { width: 1440, height: 900 },
    later: "Later days",
  },
  { label: "zh", locale: "zh-CN", viewport: { width: 1440, height: 900 }, later: "后几天" },
  {
    label: "reduced",
    locale: "en-AU",
    viewport: { width: 1440, height: 900 },
    later: "Later days",
    reducedMotion: "reduce",
  },
  {
    label: "phone",
    locale: "en-AU",
    viewport: { width: 390, height: 844 },
    phone: true,
  },
];

const results = {};
try {
  for (const journey of journeys) {
    const context = await browser.newContext({
      locale: journey.locale,
      viewport: journey.viewport,
      ...(journey.reducedMotion ? { reducedMotion: journey.reducedMotion } : {}),
      ...(journey.phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await plan(page);
    const tag = journey.label;
    const first = await state(page);
    results[tag] = { first };
    await page.screenshot({ path: resolve(out, `${tag}-start.png`) });
    check(first.overflow > 0, `${tag}: the day cards overflow the chat column`, first.overflow);
    check(!fadesLeft(first.mask), `${tag}: no left fade before scrolling`, first.mask);
    check(
      fadesRight(first.mask),
      `${tag}: the right edge fades while later days are hidden`,
      first.mask,
    );

    if (journey.phone) {
      check(
        !first.end?.shown && !first.start?.shown,
        `${tag}: no scroll buttons on a touch phone`,
        { start: first.start, end: first.end },
      );
      check(pageErrors.length === 0, `${tag}: no page errors`, pageErrors);
      await context.close();
      continue;
    }

    check(
      first.end?.shown && !first.start?.shown,
      `${tag}: only a later-days button shows at the start`,
      { start: first.start, end: first.end },
    );
    check(
      first.end?.label === journey.later,
      `${tag}: the button is named ${journey.later}`,
      first.end,
    );
    check(first.end?.tabIndex === -1, `${tag}: the button stays out of the tab order`, first.end);

    const strip = page.locator(".msg-item--agent .plan-days").last();
    await strip.hover();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);

    const end = page.locator(".msg-item--agent .plan-days__scroll--end").last();
    let clicks = 0;
    let previous = first.scrollLeft;
    let quick;
    while ((await end.count()) && clicks < 8) {
      await end.click();
      if (journey.reducedMotion && quick === undefined) {
        quick = (await state(page)).scrollLeft;
      }
      await page.waitForTimeout(600);
      const now = await state(page);
      if (now.scrollLeft <= previous) break;
      previous = now.scrollLeft;
      clicks += 1;
    }
    const last = await state(page);
    results[tag].last = last;
    await page.screenshot({ path: resolve(out, `${tag}-end.png`) });
    check(
      clicks > 0 && last.scrollLeft > first.scrollLeft,
      `${tag}: the button scrolls to later days`,
      {
        clicks,
        scrollLeft: last.scrollLeft,
      },
    );
    if (journey.reducedMotion) {
      check(quick > first.scrollLeft, `${tag}: the jump is immediate with reduced motion`, quick);
    }
    const card = last.cards.at(-1);
    check(
      card && last.strip && card.right <= last.strip.right + 1,
      `${tag}: the last day card is fully visible at the end`,
      { card, strip: last.strip },
    );
    check(!fadesRight(last.mask), `${tag}: no right fade at the end`, last.mask);
    check(
      fadesLeft(last.mask),
      `${tag}: the left edge fades while earlier days are hidden`,
      last.mask,
    );
    check(
      last.start?.shown && !last.end?.shown,
      `${tag}: only an earlier-days button shows at the end`,
      { start: last.start, end: last.end },
    );

    const startButton = page.locator(".msg-item--agent .plan-days__scroll--start").last();
    for (let i = 0; i < 8 && (await startButton.count()); i += 1) {
      await startButton.click();
      await page.waitForTimeout(600);
    }
    const back = await state(page);
    check(
      back.scrollLeft === 0,
      `${tag}: the earlier-days button scrolls back to Day 1`,
      back.scrollLeft,
    );

    await page.keyboard.press("Escape");
    await page.locator(".msg-item--agent .plan-day").last().focus();
    await page.waitForTimeout(400);
    const focused = await state(page);
    check(
      focused.scrollLeft > 0,
      `${tag}: focusing the last card with the keyboard still scrolls it in`,
      focused.scrollLeft,
    );
    check(pageErrors.length === 0, `${tag}: no page errors`, pageErrors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(
    resolve(out, "summary.json"),
    JSON.stringify({ base: BASE, checks, results }, null, 2),
  );
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
