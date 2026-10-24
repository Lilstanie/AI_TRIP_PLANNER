import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readRun } from "./support/team-run.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/assistant-team-conversation");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const ROLES = {
  en: ["Coordinator", "Day plan", "Getting around", "Stay", "Destination guide", "Food & dining"],
  zh: ["协调员", "每日行程", "出行交通", "住宿", "目的地指南", "餐饮"],
};
const MARKERS = { en: ["Decided by AI", "Decided by code"], zh: ["AI 决定", "程序决定"] };
const SPECIALISTS = ["itinerary", "transport", "accommodation", "destination-guide", "dining"];
const MESSAGE = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const label = `${locale}-${width}`;
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
      await page
        .getByRole("textbox", {
          name: locale === "zh" ? /AI Trip Planner|消息/ : "Message AI Trip Planner",
        })
        .fill(MESSAGE);
      await page.keyboard.press("Enter");
      await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
      await page.waitForTimeout(800);

      const run = await readRun(page);
      if (run) {
        const assistants = run.assignments.map((item) => item.who);
        const names = run.rows.map((row) => row.name);
        check(
          SPECIALISTS.every((id) => assistants.includes(id)),
          `${label}: every specialist has an assignment`,
          assistants,
        );
        check(
          JSON.stringify(names) === JSON.stringify(ROLES[locale]),
          `${label}: role names are in the interface language`,
          names,
        );
        check(
          assistants.length > 0 && run.assignments.every((item) => item.icon === 1),
          `${label}: every assignment has an icon`,
          run.assignments.map((item) => item.icon),
        );
        const markers = run.assignments.map((item) => item.marker);
        check(
          assistants.length > 0 && markers.every((text) => MARKERS[locale].includes(text)),
          `${label}: every assignment says who decided`,
          markers,
        );
        check(
          MARKERS[locale].includes(run.rows[0].marker),
          `${label}: the Coordinator row says who decided`,
          run.rows[0].marker,
        );
        check(
          run.assignments.filter((item) => item.source).length >= 1,
          `${label}: specialist assignments show their data source`,
        );
      } else check(false, `${label}: the team panel did not open`);

      await page.locator(".thinking-turn").last().click();
      const rowIcons = await page.locator(".thinking-subagent .assistant-icon").count();
      check(
        rowIcons >= SPECIALISTS.length,
        `${label}: Think rows carry the assistant icons`,
        rowIcons,
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      check(!overflow, `${label}: no horizontal overflow`);
      check(errors.length === 0, `${label}: no page errors`, errors);
      await page.screenshot({ path: `${out}/${label}.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
