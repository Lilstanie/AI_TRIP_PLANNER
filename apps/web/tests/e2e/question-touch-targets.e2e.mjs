import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  "output/playwright/question-touch-targets",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const results = [];
const geometry = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const frame = {
  type: "ask_user",
  known: {},
  questions: [
    {
      id: "pace",
      header: "Pace",
      question: "How busy should each day be?",
      multiSelect: true,
      options: [{ label: "Relaxed" }, { label: "Packed" }],
    },
    { id: "food", header: "Food", question: "Any food preferences?" },
    { id: "notes", header: "Notes", question: "Anything else to plan around?" },
  ],
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const locale of ["en-AU", "zh-CN"]) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [520, 844],
      [521, 844],
      [1440, 1000],
    ]) {
      const id = `${locale}-${width}x${height}`;
      const context = await browser.newContext({
        viewport: { width, height },
        locale,
        hasTouch: width <= 520,
        isMobile: width <= 520,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      const requests = [];
      await page.route("**/api/chat", async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({
          contentType: "application/x-ndjson",
          body: JSON.stringify(frame) + "\n",
        });
      });
      await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
      await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
      const send = async () => {
        await page.locator(".composer__input").fill("Question target fixture");
        await page.locator(".composer__primary").click();
        await page.locator(".question__card").waitFor();
      };
      await send();
      await page.waitForFunction((lang) => document.documentElement.lang === lang, locale);
      const card = page.locator(".question__card");
      const icons = card.locator(".question__icon-button");
      const prev = card.locator(".question__pager button").first();
      const next = card.locator(".question__pager button").last();
      const collapse = card.locator(".question__header-actions button").first();
      const dismiss = card.locator(".question__header-actions button").last();
      const skip = card.locator(".question__button--outline");
      const advance = card.locator(".question__button--primary");
      const measure = async (stage) => {
        const g = await card.evaluate((node) => {
          const rect = (el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              right: r.right,
              bottom: r.bottom,
            };
          };
          const buttons = [...node.querySelectorAll("button")].filter(
            (b) => b.getClientRects().length,
          );
          const controls = [...node.querySelectorAll(".question__icon-button,.question__button")];
          return {
            card: rect(node),
            controls: controls.map((b) => ({
              label: b.getAttribute("aria-label") ?? b.textContent,
              ...rect(b),
              svg: b.querySelector("svg") ? rect(b.querySelector("svg")) : null,
            })),
            overlap: buttons.some((a, i) =>
              buttons.slice(i + 1).some((b) => {
                const x = rect(a),
                  y = rect(b);
                return (
                  x.x < y.right - 0.5 &&
                  y.x < x.right - 0.5 &&
                  x.y < y.bottom - 0.5 &&
                  y.y < x.bottom - 0.5
                );
              }),
            ),
            overflow:
              node.scrollWidth > node.clientWidth ||
              document.documentElement.scrollWidth > innerWidth,
            headingOverlap: (() => {
              const h = rect(node.querySelector(".question__heading")),
                a = rect(node.querySelector(".question__header-actions"));
              return h.right > a.x + 0.5;
            })(),
            reachable: controls.every((b) => {
              const r = rect(b);
              const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return r.y >= 0 && r.bottom <= innerHeight && b.contains(hit);
            }),
            gap: (() => {
              const b = node.querySelectorAll(".question__header-actions button");
              return rect(b[1]).x - rect(b[0]).right;
            })(),
          };
        });
        geometry.push({ id, stage, ...g });
        check(
          !g.overlap && !g.headingOverlap && !g.overflow && g.reachable,
          `${id} ${stage}: controls visible, reachable, no overlap/overflow`,
        );
        check(
          g.controls.every((b) =>
            b.svg
              ? b.width === (width <= 520 ? 44 : 24) && b.height === (width <= 520 ? 44 : 24)
              : b.height === (width <= 520 ? 44 : 36),
          ),
          `${id} ${stage}: target dimensions`,
        );
        check(
          g.controls
            .filter((b) => b.svg)
            .every(
              (b, i) => b.svg.width === (i === 1 ? 16 : 14) && b.svg.height === (i === 1 ? 16 : 14),
            ),
          `${id} ${stage}: SVG sizes preserved`,
        );
        check(g.gap >= (width <= 520 ? 12 : 4), `${id} ${stage}: collapse/dismiss separation`);
      };
      await measure("first");
      await page.screenshot({ path: `${out}/${id}-first.png` });
      check(
        (await prev.isDisabled()) && (await advance.isDisabled()),
        `${id}: initial disabled state`,
      );
      check((await icons.first().getAttribute("aria-label")) !== "", `${id}: accessible icon name`);
      await card.getByRole("checkbox").first().click();
      await next.click({ position: { x: 4, y: 12 } });
      await prev.click({ position: { x: 4, y: 12 } });
      check(
        (await card.getByRole("checkbox").first().getAttribute("aria-checked")) === "true",
        `${id}: pager preserves selection`,
      );
      await collapse.click({ position: { x: 4, y: 12 } });
      check(
        (await card.locator(".question__body").count()) === 0 &&
          (await collapse.getAttribute("aria-expanded")) === "false",
        `${id}: collapse retains card`,
      );
      await collapse.press("Enter");
      check(
        (await card.getByRole("checkbox").first().getAttribute("aria-checked")) === "true",
        `${id}: keyboard expand preserves draft`,
      );
      await advance.click();
      await card.locator("textarea").fill("Discard this");
      await skip.click();
      check(
        (await next.isDisabled()) && (await advance.isDisabled()),
        `${id}: skip advances, last disabled until answer`,
      );
      await measure("last");
      await page.screenshot({ path: `${out}/${id}-last.png` });
      await card.locator("textarea").fill("Quiet room");
      await advance.click();
      await page.waitForFunction(
        () => document.querySelector(".question__progress")?.textContent.trim() === "1 / 3",
      );
      const answer = JSON.stringify(requests.at(-1));
      check(
        answer.includes("Pace: Relaxed") &&
          answer.includes("Food: no preference") &&
          answer.includes("Notes: Quiet room") &&
          !answer.includes("Discard this"),
        `${id}: submit sends preserved and skipped answers`,
      );
      await skip.click();
      await skip.click();
      await skip.click();
      await page.waitForFunction(
        () => document.querySelector(".question__progress")?.textContent.trim() === "1 / 3",
      );
      check(
        JSON.stringify(requests.at(-1)).includes("Notes: no preference"),
        `${id}: last skip submits`,
      );
      const count = requests.length;
      await dismiss.click({ position: { x: 4, y: 12 } });
      await page.locator(".composer__input").waitFor();
      check(
        (await page.locator(".question").count()) === 0 && requests.length === count,
        `${id}: dismiss restores composer without request`,
      );
      check(errors.length === 0, `${id}: no browser errors ${errors.join("; ")}`);
      await context.close();
    }
  }
} finally {
  writeFileSync(
    `${out}/report.json`,
    JSON.stringify({ browser: browser.version(), results, geometry }, null, 2),
  );
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5000))]);
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
