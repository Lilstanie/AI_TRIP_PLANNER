import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/trip-panel-head",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PROMPT = "Plan 4 days in Lisbon from Sydney, 2 people, budget 6000 AUD, from 2027-03-10";
const browser = await chromium.launch({ channel: process.env.CHANNEL });

const measure = (page) =>
  page.evaluate(() => {
    const panel = [...document.querySelectorAll(".trip-panel")].find(
      (node) => node.getBoundingClientRect().width > 0,
    );
    const box = (node) => {
      if (!node) return undefined;
      const rect = node.getBoundingClientRect();
      if (!rect.width) return undefined;
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      };
    };
    const line = panel?.querySelector(".trip-panel__budget-line");
    const figures = [...(line?.children ?? [])]
      .filter((node) => !node.classList.contains("budget-status"))
      .map(box)
      .filter(Boolean);
    return {
      text: panel?.innerText ?? "",
      first: panel?.firstElementChild?.className ?? "",
      figures,
      menu: box(panel?.querySelector(".trip-editor__toolbar .action-menu")),
      badge: box(document.querySelector(".trip-workspace__open-items .open-items__badge")),
    };
  });
const overlap = (a, b) =>
  a &&
  b &&
  a.left < b.right - 1 &&
  b.left < a.right - 1 &&
  a.top < b.bottom - 1 &&
  b.top < a.bottom - 1;
const middle = (rect) => (rect.top + rect.bottom) / 2;

async function plan(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const box = page.locator("textarea").first();
  await box.fill(PROMPT);
  await box.press("Enter");
  await page.locator(".msg-item--agent .msg-item__clock").first().waitFor({ timeout: 90_000 });
}

function verify(tag, head) {
  check(
    !/Lisbon · .*travellers/.test(head.text),
    `${tag}: the panel does not repeat the destination, dates and travellers`,
    head.text.split("\n").slice(0, 2),
  );
  check(
    head.first.includes("trip-panel__budget-summary"),
    `${tag}: the budget line heads the panel`,
    head.first,
  );
  const blockers = [head.menu, head.badge].filter(Boolean);
  const hits = head.figures.filter((figure) => blockers.some((item) => overlap(figure, item)));
  check(
    head.figures.length > 0 && hits.length === 0,
    `${tag}: the badge and menu leave the budget figures readable`,
    { figures: head.figures, menu: head.menu, badge: head.badge },
  );
  check(
    head.menu && head.figures[0] && Math.abs(middle(head.menu) - middle(head.figures[0])) <= 8,
    `${tag}: the itinerary menu sits on the budget row`,
    { menu: head.menu, figure: head.figures[0] },
  );
}

const results = {};
try {
  for (const [tag, width, height] of [
    ["desktop", 1440, 900],
    ["narrow", 1000, 800],
  ]) {
    const context = await browser.newContext({ locale: "en-AU", viewport: { width, height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await plan(page);
    const tripButton = page.locator(".trip-trigger");
    if ((await tripButton.getAttribute("aria-expanded")) !== "true") await tripButton.click();
    await page.locator(".trip-workspace .trip-panel").waitFor();
    await page.waitForTimeout(500);
    const head = await measure(page);
    results[tag] = head;
    await page.screenshot({ path: resolve(out, `${tag}.png`) });
    if (tag === "desktop") {
      check(head.badge, `${tag}: the open items badge is shown`, head.badge);
      check(
        !head.badge || head.figures.every((figure) => figure.right < head.badge.left),
        `${tag}: the budget figures stop before the badge`,
        { figures: head.figures, badge: head.badge },
      );
    }
    verify(tag, head);
    check(pageErrors.length === 0, `${tag}: no page errors`, pageErrors);
    await context.close();
  }

  const context = await browser.newContext({
    locale: "en-AU",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await plan(page);
  await page.locator(".phone-tabbar").getByText("Mine").click();
  await page.getByText("Trip to Lisbon").first().click();
  await page.getByText("Itinerary", { exact: true }).first().click();
  await page.locator(".trip-panel").first().waitFor();
  await page.waitForTimeout(600);
  const head = await measure(page);
  results.phone = head;
  await page.screenshot({ path: resolve(out, "phone.png") });
  verify("phone", head);
  await context.close();
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
