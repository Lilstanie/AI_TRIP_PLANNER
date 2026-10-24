import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-inspector");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const SETTINGS_KEY = "trip.settings.v1";
const COPY = {
  en: {
    locale: "en-AU",
    trajectory: "Trajectory",
    stay: "Stay",
    custom: "Hotel Buddy",
    dining: "Food & dining",
    details: "Event details",
    close: "Close details",
    tabs: { overview: "Summary", input: "Payload", output: "Result" },
    objective: "Fix: @Stay find a cheaper stay again",
    output: "Revised accommodation after",
    stays: "4 stay options",
    stayFailed: "Stay lookup failed",
    searchFailed: "Search timed out",
    conflict: "Conflict check, round 1:",
  },
  zh: {
    locale: "zh-CN",
    trajectory: "轨迹",
    stay: "住宿",
    custom: "酒店管家",
    dining: "餐饮",
    details: "事件详情",
    close: "关闭详情",
    tabs: { overview: "摘要", input: "载荷", output: "结果" },
    objective: "修正：@住宿 find a cheaper stay again",
    output: "修改了accommodation部分",
    stays: "4 stay options",
    stayFailed: "Stay lookup failed",
    searchFailed: "Search timed out",
    conflict: "冲突检查，第 1 轮：",
  },
};
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const UNITS = /\btok\b|\bms\b|token|令牌|毫秒|TTFT/i;

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
const box = (page) => page.locator(".chat__form textarea");
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"));

async function send(page, text) {
  const before = await page.locator(".msg-item--agent").count();
  await box(page).fill(text);
  await page.keyboard.press("Enter");
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
      index: Number(row.getAttribute("data-record-index")),
      kind: row.getAttribute("data-kind"),
      turnStart: row.getAttribute("data-turn-start") === "true",
      error: row.getAttribute("data-error") === "true",
      text: row.cells[1]?.innerText.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

const focusedIndex = (page) =>
  page.evaluate(() => {
    const node = document.activeElement;
    return node?.matches?.("tr[data-record-index]")
      ? Number(node.getAttribute("data-record-index"))
      : null;
  });

try {
  for (const locale of ["en", "zh"]) {
    const copy = COPY[locale];
    const label = `${locale}-1440`;
    const context = await browser.newContext({
      locale: copy.locale,
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      ([key, id, name]) => {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
            memberships: [],
            assistant: { style: "neutral", memory: true, names: { [id]: name } },
            dataMode: "default",
            appearance: "system",
            displayCurrency: "AUD",
            updatedAt: new Date(0).toISOString(),
          }),
        );
      },
      [SETTINGS_KEY, "accommodation", copy.custom],
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    let budgetOverride;
    let failStay = false;
    await page.route("**/api/chat", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (budgetOverride && body.plan) {
        body.brief = { ...body.brief, budgetTotal: budgetOverride };
        body.plan = { ...body.plan, brief: { ...body.plan.brief, budgetTotal: budgetOverride } };
      }
      const postData = JSON.stringify(body);
      if (!failStay) return route.continue({ postData });
      const response = await route.fetch({ postData });
      const lines = (await response.text()).split("\n").map((line) => {
        if (!line.trim()) return line;
        const event = JSON.parse(line);
        if (event.type === "tool_completed")
          return JSON.stringify({
            type: "tool_failed",
            agent: event.agent,
            round: event.round,
            callId: event.callId,
            tool: event.tool,
            label: event.label,
            error: "Search timed out",
          });
        if (event.type === "agent_completed" && event.agent === "accommodation")
          return JSON.stringify({
            type: "agent_failed",
            agent: event.agent,
            round: event.round,
            error: "Stay lookup failed",
          });
        return line;
      });
      await route.fulfill({ response, body: lines.join("\n") });
    });
    await page.goto(base);
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
      if (!(await live.count())) break;
      await live.click();
    }

    await send(page, PLAN);
    budgetOverride = await (async () => {
      const plan = (await stored(page)).plan;
      const floor = plan.sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
      const spend = plan.sections.reduce((sum, s) => sum + s.estCost, 0);
      return Math.floor((floor + spend) / 2);
    })();
    await send(page, `@${copy.stay} find a cheaper stay again`);
    budgetOverride = undefined;
    failStay = true;
    await send(page, `@${copy.stay} find another stay`);
    failStay = false;

    await page.getByRole("tab", { name: copy.trajectory, exact: true }).click();
    const view = page.locator("[data-trajectory-scroll]");
    await view.waitFor({ timeout: 10_000 });
    const rows = await ledgerRows(page);
    const tableRows = view.locator("tr[data-record-index]");
    const aside = page.getByRole("complementary", { name: copy.details });
    const open = async (position) => {
      await tableRows.nth(position).click();
      await aside.waitFor({ timeout: 5000 });
      await page.waitForTimeout(200);
    };
    const tab = (id) => aside.getByRole("tab", { name: copy.tabs[id], exact: true });
    const find = (turn, predicate) => {
      const starts = rows.flatMap((row, i) => (row.turnStart ? [i] : []));
      const to = starts[turn + 1] ?? rows.length;
      for (let i = starts[turn]; i < to; i += 1) if (predicate(rows[i])) return i;
      return -1;
    };

    const assignment = find(1, (row) => row.kind === "tool" && row.text.startsWith(copy.custom));
    await open(assignment);
    const assignmentSummary = await aside.innerText();
    check(
      assignmentSummary.includes(copy.objective),
      `${label}: an assignment shows its objective`,
      assignmentSummary,
    );
    await tab("output").click();
    const assignmentOutput = await aside.innerText();
    check(
      assignmentOutput.includes(copy.output) && !assignmentOutput.includes(copy.stayFailed),
      `${label}: an assignment shows the specialist's output`,
      assignmentOutput,
    );
    await tab("overview").click();
    await page.screenshot({ path: `${out}/${label}-assignment.png` });
    check(
      !UNITS.test(assignmentSummary + assignmentOutput),
      `${label}: the assignment inspector shows no token or duration field`,
    );

    const call = find(1, (row) => row.kind === "subtool");
    await open(call);
    const callSummary = await aside.innerText();
    check(callSummary.includes(copy.stays), `${label}: a tool call shows its result`, callSummary);
    await tab("input").click();
    const callInput = await aside.innerText();
    check(
      /^\s*[\s\S]*\S/.test(callInput) && !/\{\s*\}/.test(callInput),
      `${label}: a tool call shows its arguments`,
      callInput,
    );
    await tab("overview").click();
    await page.screenshot({ path: `${out}/${label}-tool-call.png` });
    check(
      !UNITS.test(callSummary + callInput),
      `${label}: the tool call inspector shows no token or duration field`,
    );

    await open(find(2, (row) => row.kind === "subtool" && row.error));
    check(
      (await aside.innerText()).includes(copy.searchFailed),
      `${label}: a failed tool call shows the failure`,
    );
    await open(find(2, (row) => row.kind === "tool" && row.error));
    check(
      (await aside.innerText()).includes(copy.stayFailed),
      `${label}: a failed assignment shows the failure`,
    );

    const conflict = find(1, (row) => row.kind === "tool" && row.text.includes(copy.conflict));
    await open(conflict);
    const conflictSummary = await aside.innerText();
    check(
      conflictSummary.includes(copy.dining),
      `${label}: the conflict check names the specialist it sends back`,
      conflictSummary,
    );
    await tab("output").click();
    const conflictOutput = await aside.innerText();
    check(
      conflictOutput.includes(copy.dining) && !/"agent"\s*:/.test(conflictOutput),
      `${label}: the conflict check's Result states the conflict with the specialist's name`,
      conflictOutput,
    );
    await tab("overview").click();
    await page.screenshot({ path: `${out}/${label}-conflict.png` });
    check(
      !UNITS.test(conflictSummary + conflictOutput),
      `${label}: the conflict inspector shows no token or duration field`,
    );

    await tab("input").click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check((await aside.count()) === 0, `${label}: Esc closes the inspector from inside it`);
    check(
      (await focusedIndex(page)) === rows[conflict].index,
      `${label}: Esc returns focus to the record that was open`,
      await focusedIndex(page),
    );
    await page.keyboard.press("Escape");
    check(
      (await focusedIndex(page)) === rows[conflict].index && (await aside.count()) === 0,
      `${label}: Esc with nothing open changes neither focus nor selection`,
    );

    await open(call);
    await aside.getByRole("button", { name: copy.close }).click();
    await page.waitForTimeout(200);
    check((await aside.count()) === 0, `${label}: the close control closes the inspector`);
    check(
      (await focusedIndex(page)) === rows[call].index,
      `${label}: the close control returns focus to the record that was open`,
      await focusedIndex(page),
    );

    await open(assignment);
    await tableRows.nth(assignment).focus();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check(
      (await aside.count()) === 0 && (await focusedIndex(page)) === rows[assignment].index,
      `${label}: Esc closes the inspector from the ledger too`,
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    check(!overflow, `${label}: no horizontal overflow`);
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
