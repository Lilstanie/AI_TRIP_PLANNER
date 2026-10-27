import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-demo");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const COPY = {
  en: {
    locale: "en-AU",
    stay: "Stay",
    dining: "Food & dining",
    conflict: "Conflict check",
    details: "Event details",
    close: "Close details",
    showAll: "Show all records",
    chat: /^Chat/,
  },
  zh: {
    locale: "zh-CN",
    stay: "住宿",
    dining: "餐饮",
    conflict: "冲突检查",
    details: "事件详情",
    close: "关闭详情",
    showAll: "显示全部记录",
    chat: /^聊天/,
  },
};
const UNITS = /\btok\b|\bms\b|token|令牌|毫秒|TTFT/i;
const SUMMARY = ".msg-item--agent .thinking-turn .thinking-row__summary-button";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

async function open(copy, width) {
  const context = await browser.newContext({
    locale: copy.locale,
    viewport: { width, height: width === 390 ? 844 : 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (!window.__slow || !String(args[0]?.url ?? args[0]).includes("/api/chat")) return response;
      const reader = response.body.getReader();
      const lines = [];
      let tail = "";
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async pull(controller) {
          while (lines.length === 0) {
            const { done, value } = await reader.read();
            if (done) {
              if (tail) controller.enqueue(encoder.encode(tail));
              return controller.close();
            }
            const parts = (tail + decoder.decode(value, { stream: true })).split("\n");
            tail = parts.pop() ?? "";
            lines.push(...parts.map((part) => `${part}\n`));
          }
          await new Promise((resolve) => setTimeout(resolve, 150));
          controller.enqueue(encoder.encode(lines.shift()));
        },
      });
      return new Response(body, { status: response.status, headers: response.headers });
    };
  });
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

async function answered(page, before) {
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length > count,
    [".msg-item--agent", before],
    { timeout: 240_000 },
  );
  await page.waitForTimeout(800);
}

const ledgerRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-trajectory-scroll] tr[data-record-index]")].map((row) => ({
      kind: row.getAttribute("data-kind"),
      assistant: row.getAttribute("data-assistant"),
      text: row.cells[1]?.innerText.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

const steps = [];

try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const copy = COPY[locale];
      const label = `${locale}-${width}`;
      const phone = width === 390;
      const { context, page, errors } = await open(copy, width);
      let budgetOverride;
      await page.route("**/api/chat", async (route) => {
        const body = JSON.parse(route.request().postData() ?? "{}");
        if (budgetOverride && body.plan) {
          body.brief = { ...body.brief, budgetTotal: budgetOverride };
          body.plan = {
            ...body.plan,
            brief: { ...body.plan.brief, budgetTotal: budgetOverride },
          };
        }
        await route.continue({ postData: JSON.stringify(body) });
      });
      const bar = page.locator(".phone-tabbar");
      const toChat = async () => {
        if (phone && (await page.locator("dialog.phone-trajectory[open]").count())) {
          await page.keyboard.press("Escape");
          await page.locator("dialog.phone-trajectory[open]").waitFor({ state: "hidden" });
        }
        if (phone) await bar.getByRole("tab", { name: copy.chat }).click();
        else await page.locator("#chat-tab-conversation").click();
        await page.locator(".chat__stream").waitFor({ state: "visible" });
      };
      if (phone) await toChat();
      const trigger = page.locator(".team-trigger:visible").first();
      const panel = page.locator(".team-panel");
      const replies = page.locator(".msg-item--agent");
      let shots = [];
      let shotNumber = 0;
      const snap = async (name) => {
        shotNumber += 1;
        const file = `${label}-${String(shotNumber).padStart(2, "0")}-${name}.png`;
        await page.screenshot({ path: `${out}/${file}` });
        shots.push(file);
      };
      const step = async (number, name, run) => {
        const before = checks.length;
        shots = [];
        await run();
        steps.push({
          label,
          step: number,
          name,
          screenshots: shots,
          checks: checks.slice(before).map((entry) => entry.name),
        });
      };
      const openPanel = async () => {
        if (phone) {
          await trigger.click();
          const roster = page.locator("dialog.phone-trajectory[open] .phone-trajectory__team");
          if (!(await roster.evaluate((node) => node.open)))
            await roster.locator("> summary").click();
        } else {
          await page.mouse.move(5, 500);
          await trigger.hover();
        }
        await panel.waitFor();
      };

      const closePanel = async () => {
        await page.keyboard.press("Escape");
        if (phone) await page.locator("dialog.phone-trajectory[open]").waitFor({ state: "hidden" });
        else await panel.waitFor({ state: "detached" });
      };

      await step(1, "team-working", async () => {
        await page.evaluate(() => {
          window.__slow = true;
        });
        const before = await replies.count();
        await box(page).fill(PLAN);
        await page.keyboard.press("Enter");
        await page.locator(".team-trigger:visible:not([data-working='0'])").first().waitFor();
        check(
          (await page.locator(".team-trigger:visible .assistant-icon--working").count()) >= 1,
          `${label} step 1: the button avatars show who is working`,
        );
        await snap("working");
        await openPanel();
        const statuses = await panel
          .locator(".team-panel__row")
          .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-status")));
        check(
          statuses.length === 6 && statuses.includes("working"),
          `${label} step 1: the panel lists six assistants with a working one`,
          statuses,
        );
        await snap("panel-live");
        await closePanel();
        await answered(page, before);
        await page.evaluate(() => {
          window.__slow = false;
        });
      });

      await step(2, "revision", async () => {
        const plan = (await stored(page)).plan;
        const floor = plan.sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
        const spend = plan.sections.reduce((sum, s) => sum + s.estCost, 0);
        budgetOverride = Math.floor((floor + spend) / 2);
        const before = await replies.count();
        await box(page).fill("");
        await box(page).focus();
        await page.keyboard.type(`@${copy.stay}`);
        await page.getByRole("listbox").getByRole("option").first().waitFor();
        await page.keyboard.press("Tab");
        await page.keyboard.type("find a cheaper stay again");
        await page.keyboard.press("Enter");
        await answered(page, before);
        budgetOverride = undefined;
        await openPanel();
        const kinds = await panel
          .locator(".team-panel__assignment")
          .evaluateAll((items) => items.map((item) => item.getAttribute("data-kind")));
        check(
          kinds.includes("revision") && (await panel.locator(".team-panel__check").count()) >= 1,
          `${label} step 2: the panel shows a conflict check and a revision`,
          kinds,
        );
        await snap("panel-revision");
        await closePanel();
      });

      await step(3, "trajectory", async () => {
        await replies.last().scrollIntoViewIfNeeded();
        await page.locator(SUMMARY).nth(1).click();
        await page.locator("[data-trajectory-simple]").waitFor();
        check(
          (await page
            .locator('[data-simple-turn="2"] [data-simple-toggle]')
            .getAttribute("aria-expanded")) === "true",
          `${label} step 3: the summary opens the simple list at the revision turn`,
        );
        await page.getByRole("button", { name: /^(Full view|完整视图)$/ }).click();
        await page.locator("[data-trajectory-scroll]").waitFor();
        await page.waitForTimeout(600);
        const inView = await page.evaluate(() => {
          const pane = document.querySelector("[data-trajectory-scroll]");
          const rect = pane?.getBoundingClientRect();
          const rows = [...(pane?.querySelectorAll('tr[data-kind="user"]') ?? [])];
          const row = rows.find((node) => node.innerText.includes("find a cheaper stay again"));
          const box = row?.getBoundingClientRect();
          return Boolean(rect && box && box.top >= rect.top - 1 && box.bottom <= rect.bottom + 1);
        });
        check(inView, `${label} step 3: the summary opens the revision turn`);
        await snap("turn");
      });

      await step(4, "inspect-revision", async () => {
        const rows = await ledgerRows(page);
        const position = rows.findLastIndex(
          (row) =>
            row.kind === "tool" &&
            row.text.includes(copy.conflict) &&
            row.text.includes(copy.dining),
        );
        check(position >= 0, `${label} step 4: the turn has a conflict check`, rows.length);
        if (position < 0) return;
        await page.locator("[data-trajectory-scroll] tr[data-record-index]").nth(position).click();
        const aside = page.getByRole("complementary", { name: copy.details });
        await aside.waitFor({ timeout: 5000 });
        await page.waitForTimeout(300);
        const text = await aside.innerText();
        check(
          text.includes(copy.dining) && !UNITS.test(text),
          `${label} step 4: the inspector names the specialist and shows no token or duration`,
          text,
        );
        await snap("inspector");
        await aside.getByRole("button", { name: copy.close }).click();
        await aside.waitFor({ state: "detached" });
      });

      await step(5, "filter", async () => {
        const total = await page.locator("[data-trajectory-scroll] tr[data-record-index]").count();
        await toChat();
        await openPanel();
        await page.locator('.team-panel__row[data-assistant="dining"] button').click();
        const filter = page.locator("[data-trajectory-filter]");
        await filter.waitFor();
        await page.locator("[data-trajectory-simple]").waitFor();
        const simpleOwners = await page
          .locator("[data-trajectory-simple] [data-simple-turn]")
          .evaluateAll((nodes) =>
            nodes.map((node) =>
              [...node.querySelectorAll("[data-simple-avatar]")].map((a) =>
                a.getAttribute("data-simple-avatar"),
              ),
            ),
          );
        check(
          simpleOwners.length >= 1 && simpleOwners.every((ids) => ids.includes("dining")),
          `${label} step 5: the simple list lists only turns that specialist took part in`,
          simpleOwners,
        );
        await page.getByRole("button", { name: /^(Full view|完整视图)$/ }).click();
        await page.locator("[data-trajectory-scroll]").waitFor();
        const owners = await page
          .locator("[data-trajectory-scroll] tr[data-record-index]")
          .evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute("data-assistant")))]);
        check(
          owners.length >= 1 && owners.every((owner) => owner === "dining"),
          `${label} step 5: only that specialist's records show`,
          owners,
        );
        await snap("filtered");
        await filter.getByRole("button", { name: copy.showAll }).click();
        await filter.waitFor({ state: "detached" });
        check(
          (await page.locator("[data-trajectory-scroll] tr[data-record-index]").count()) >= total,
          `${label} step 5: Show all records restores the ledger`,
        );
      });

      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${label}: the page does not overflow`,
      );
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ steps, checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
