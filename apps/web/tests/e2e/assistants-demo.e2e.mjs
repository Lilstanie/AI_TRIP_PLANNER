import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readRun } from "./support/team-run.mjs";
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
const BUTTON = { en: "Specialist team", zh: "专家团队" };
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

const opened = (scope) =>
  scope.evaluate((node) => ({
    turn: node.querySelector(".thinking-turn")?.getAttribute("data-open") === "true",
    rows: [...node.querySelectorAll(".thinking-subagent")]
      .filter((row) => row.querySelector(".thinking-subagent__row")?.hasAttribute("data-open"))
      .map((row) => row.getAttribute("data-subagent")),
  }));

const focusInfo = () => {
  const node = document.activeElement;
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    subagent: node.closest(".thinking-subagent")?.getAttribute("data-subagent") ?? null,
    reply: [...document.querySelectorAll(".msg-item--agent")].findIndex((item) =>
      item.contains(node),
    ),
    top: rect.top,
    bottom: rect.bottom,
    form: document.querySelector(".chat__form")?.getBoundingClientRect().top ?? innerHeight,
  };
};

async function pick(page, name) {
  await page.keyboard.type(`@${name.split(" ")[0]}`);
  await page.getByRole("listbox").getByRole("option").first().waitFor();
  await page.keyboard.press("Tab");
}

async function sendPicked(page, names, text) {
  const before = await replies(page).count();
  await box(page).fill("");
  await box(page).focus();
  for (const name of names) await pick(page, name);
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await answered(page, before);
}

async function send(page, text) {
  const before = await replies(page).count();
  await box(page).fill(text);
  await page.keyboard.press("Enter");
  await answered(page, before);
}

async function answered(page, before) {
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
      const lastRun = async () => {
        const run = await readRun(page);
        if (!run) {
          check(
            width <= 520 && (await replies(page).last().locator(".team-summary").count()) === 1,
            `${label}: the reply carries a team summary`,
          );
          return null;
        }
        return run;
      };
      const workersOf = (run) => run.assignments.filter((item) => item.kind !== "handoff");
      const trigger = page.locator(".team-trigger:visible").first();
      const panel = page.locator(".team-panel");
      let shots = [];
      let shotNumber = 0;
      const snap = async (name) => {
        shotNumber += 1;
        const file = `${label}-${String(shotNumber).padStart(2, "0")}-${name}.png`;
        await page.screenshot({ path: `${out}/${file}` });
        shots.push(file);
      };
      const openLatest = async () => {
        if (width <= 520) await trigger.click();
        else await trigger.hover();
        await panel.waitFor();
      };
      const closePanel = async () => {
        await page.keyboard.press("Escape");
        await panel.waitFor({ state: "detached" });
        await page.waitForTimeout(400);
      };
      const step = async (number, name, run) => {
        const before = checks.length;
        shots = [];
        await run();
        await snap(name);
        steps.push({
          label,
          step: number,
          name,
          screenshots: shots,
          checks: checks.slice(before).map((entry) => entry.name),
        });
      };

      await step(1, "plan", async () => {
        await page.evaluate(() => {
          window.__slow = true;
        });
        const before = await replies(page).count();
        await box(page).fill(PLAN);
        await page.keyboard.press("Enter");
        await page.locator(".team-trigger:visible:not([data-working='0'])").first().waitFor();
        check(
          (await page.locator(".team-trigger:visible .assistant-icon--working").count()) >= 1,
          `${label} step 1: the button avatars show who is working`,
        );
        check(
          (await panel.count()) === 0,
          `${label} step 1: the panel stays closed while the team works`,
        );
        await snap("working");
        await openLatest();
        const statuses = await panel
          .locator(".team-panel__row")
          .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-status")));
        check(
          statuses.length === 6 && statuses.includes("working"),
          `${label} step 1: the opened panel lists six assistants with a working one`,
          statuses,
        );
        await snap("panel-live");
        await closePanel();
        await answered(page, before);
        await page.evaluate(() => {
          window.__slow = false;
        });
        check(
          (await page.locator(".team-trigger:visible .assistant-icon--working").count()) === 0,
          `${label} step 1: no avatar works once the reply is done`,
        );
        const run = await lastRun();
        if (!run) return;
        const specialists = new Set(run.assignments.map((item) => item.who));
        check(
          run.rows.length === 6 && specialists.size === 5 && !specialists.has("coordinator"),
          `${label} step 1: the Coordinator and five specialists appear with icons`,
          [...specialists],
        );
        check(
          run.assignments.every((item) => item.icon === 1),
          `${label} step 1: every assignment has an icon`,
          run.assignments.map((item) => item.icon),
        );
      });

      await step(2, "mention", async () => {
        const before = await sectionMap();
        requests.length = 0;
        await box(page).fill("");
        await box(page).focus();
        await page.keyboard.type("@");
        await page.getByRole("listbox").getByRole("option").first().waitFor();
        check(
          (await page.getByRole("listbox").getByRole("option").count()) === 6,
          `${label} step 2: @ opens the six-assistant menu`,
        );
        await snap("menu");
        await page.keyboard.press("Escape");
        await sendPicked(page, [STAY[locale]], "find a cheaper stay");
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
        await sendPicked(page, [STAY[locale]], "find a cheaper stay again");
        budgetOverride = undefined;
        const run = await lastRun();
        if (!run) return;
        const lines = run.checks.map((item) => item.text);
        check(
          lines.length >= 3 && lines.some((line) => /→/.test(line)),
          `${label} step 3: the budget conflict, score and stop messages are shown`,
          lines,
        );
        check(
          run.assignments.some((item) => item.kind === "revision"),
          `${label} step 3: the conflict sends a specialist back with a revision`,
          run.assignments.map((item) => `${item.who}:${item.kind}`),
        );
        check(
          run.checks.every((item) => item.icons === 0),
          `${label} step 3: conflict messages are rules, not assistants`,
        );
      });

      await step(4, "remove-mention", async () => {
        const field = box(page);
        await field.fill("");
        await field.focus();
        await pick(page, STAY[locale]);
        const draft = await field.inputValue();
        const token = `@${STAY[locale]}`;
        await page.keyboard.press("Backspace");
        const selected = await field.evaluate((node) => [node.selectionStart, node.selectionEnd]);
        check(
          (await field.inputValue()) === draft && selected[1] - selected[0] === token.length + 1,
          `${label} step 4: the first Backspace selects the whole mention and its space`,
          selected,
        );
        await snap("mention-selected");
        await page.keyboard.press("Backspace");
        check(
          (await field.inputValue()) === draft.slice(token.length + 1),
          `${label} step 4: the second Backspace removes it`,
          await field.inputValue(),
        );
        await field.fill("");
      });

      await step(5, "two-mentions", async () => {
        requests.length = 0;
        await sendPicked(page, [STAY[locale], MOVE[locale]], "find cheaper options");
        check(
          JSON.stringify(requests.at(-1).mentions) === '["accommodation","transport"]',
          `${label} step 5: two specialists are sent once each`,
        );
        const run = await lastRun();
        if (!run) return;
        const workers = new Set(workersOf(run).map((item) => item.who));
        check(
          workers.size === 2 && workers.has("accommodation") && workers.has("transport"),
          `${label} step 5: exactly those two specialists work`,
          [...workers],
        );
      });

      await step(6, "hand-off", async () => {
        const before = await sectionMap();
        await sendPicked(page, [STAY[locale]], ASK[locale]);
        const run = await lastRun();
        if (run) {
          const decline = run.assignments.findIndex(
            (item) => item.kind === "handoff" && item.who === "accommodation",
          );
          const answer = run.assignments.findIndex(
            (item, i) => i > decline && item.who === "dining" && item.kind !== "handoff",
          );
          check(
            decline >= 0 && answer > decline,
            `${label} step 6: decline, then Food & dining`,
            run.assignments,
          );
        }
        const changed = await changedSince(before);
        check(
          changed.every((id) => id === "dining"),
          `${label} step 6: only the receiving section may change`,
          changed,
        );
      });

      await step(7, "earlier-reply", async () => {
        const first = replies(page).nth(0);
        const latest = (await replies(page).count()) - 1;
        check(
          (await first.locator(".team-summary").count()) === 1,
          `${label} step 7: the first reply carries a summary`,
        );
        await first.locator(".team-summary").click();
        await panel.waitFor();
        const handoffs = await panel
          .locator('.team-panel__assignment[data-kind="handoff"]')
          .count();
        check(
          handoffs === 0,
          `${label} step 7: the earlier reply's panel is its own run`,
          handoffs,
        );
        await snap("earlier-panel");
        await page
          .locator(".chat__stream")
          .evaluate((node) => node.scrollTo({ top: node.scrollHeight }));
        const name =
          locale === "zh" ? `查看${STAY[locale]}的思考过程` : `Show ${STAY[locale]} thinking`;
        await panel.getByRole("button", { name, exact: true }).click();
        await panel.waitFor({ state: "detached" });
        await page.waitForTimeout(400);
        const state = await opened(first);
        const focus = await page.evaluate(focusInfo);
        check(
          state.turn && state.rows.length === 1 && state.rows[0].endsWith(":accommodation"),
          `${label} step 7: pressing Stay expands that reply's Stay row`,
          state,
        );
        check(
          focus?.reply === 0 && focus.top >= 0 && focus.bottom <= focus.form + 1,
          `${label} step 7: the Stay row is in view`,
          focus,
        );
        check(
          JSON.stringify(await opened(replies(page).nth(latest))) ===
            JSON.stringify({ turn: false, rows: [] }),
          `${label} step 7: other replies stay closed`,
        );
      });

      await step(8, "rename", async () => {
        const dialog = await openSettings(page, width);
        const field = dialog.locator(".assistant-names input").nth(ACCOMMODATION);
        await field.fill(CUSTOM[locale]);
        await field.blur();
        await closeSettings(page, dialog, width);
        check(
          (await menuCount(page, CUSTOM[locale])) === 1,
          `${label} step 8: the @ menu shows the new name`,
        );
        requests.length = 0;
        await sendPicked(page, [CUSTOM[locale]], "find a cheaper stay");
        check(
          JSON.stringify(requests.at(-1).mentions) === '["accommodation"]',
          `${label} step 8: the new name sends the same id`,
        );
        await openLatest();
        const names = await panel.locator(".team-panel__name").allInnerTexts();
        check(
          names.map((name) => name.trim()).includes(CUSTOM[locale]),
          `${label} step 8: the panel shows the new name`,
          names,
        );
        await closePanel();
        check(
          (await replies(page).last().locator(".msg-item__who strong").innerText()) ===
            CUSTOM[locale],
          `${label} step 8: the reply shows the new name`,
        );
      });

      await step(9, "no-plan", async () => {
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.locator(".workspace-app").waitFor();
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        if (width === 390) await toChat(page);
        await send(page, `@${STAY[locale]} when are hotels cheapest?`);
        check(!(await stored(page))?.plan, `${label} step 9: no plan is created`);
        const ask = (await replies(page).last().locator(".msg-item__body").innerText()).replace(
          /\s+/g,
          " ",
        );
        check(
          locale === "zh" ? ask.includes("总预算") : ask.includes("total budget"),
          `${label} step 9: the Coordinator still asks for the brief`,
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
