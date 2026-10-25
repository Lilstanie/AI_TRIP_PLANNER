import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/trajectory-tab");
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
    conversation: "Conversation",
    trajectory: "Trajectory",
    stay: "Stay",
    custom: "Hotel Buddy",
    dining: "Food & dining",
    coordinator: "Coordinator",
    toolbar: "Trajectory toolbar",
    timeline: "Trajectory timeline",
    details: "Event details",
    close: "Close details",
    search: "Search trajectory",
    kinds: { user: "USER", message: "ASSISTANT", tool: "TOOL", subtool: "SUBTOOL" },
    turn: (n) => `Turn ${n}`,
    step: (n) => `Step ${n}`,
    payload: "Payload",
    result: "Result",
    tabs: ["Summary", "Payload", "Result"],
    conflict: "Conflict check, round 1:",
    noConflict: "no conflicts",
    scored: "Revision score, round 2:",
    kept: "revision kept",
    stopped: "Stopped after round 2",
    searchStays: "Search stays",
    searchPlaces: "Search places",
    objective: "Fix: @Stay find a cheaper stay again",
    stays: "4 stay options",
    sentBack: "Food & dining should save",
    foreign: /Turn \d|Step \d|USER|ASSISTANT|Search trajectory/,
  },
  zh: {
    locale: "zh-CN",
    conversation: "对话",
    trajectory: "轨迹",
    stay: "住宿",
    custom: "酒店管家",
    dining: "餐饮",
    coordinator: "协调员",
    toolbar: "轨迹工具栏",
    timeline: "轨迹时间线",
    details: "事件详情",
    close: "关闭详情",
    search: "搜索轨迹",
    kinds: { user: "用户", message: "助手", tool: "工具", subtool: "子工具" },
    turn: (n) => `第 ${n} 轮`,
    step: (n) => `第 ${n} 步`,
    payload: "载荷",
    result: "结果",
    tabs: ["摘要", "载荷", "结果"],
    conflict: "冲突检查，第 1 轮：",
    noConflict: "没有冲突",
    scored: "修订得分，第 2 轮",
    kept: "保留修订",
    stopped: "第 2 轮后停止",
    searchStays: "Search stays",
    searchPlaces: "Search places",
    objective: "修正：@住宿 find a cheaper stay again",
    stays: "4 stay options",
    sentBack: "餐饮",
    foreign: /Turn \d|Step \d|\bUSER\b|\bASSISTANT\b|Search trajectory|Event details/,
  },
};
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const KINDS_TURN_ONE = [
  "user",
  "message",
  "tool",
  "tool",
  "tool",
  "tool",
  "tool",
  "message",
  "tool",
  "message",
  "tool",
  "message",
];
const KINDS_TURN_TWO = [
  "user",
  "message",
  "tool",
  "subtool",
  "message",
  "tool",
  "message",
  "tool",
  "subtool",
  "tool",
  "message",
  "tool",
  "message",
  "tool",
  "message",
];

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const box = (page) => page.locator(".chat__form textarea");
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"));
const replies = (page) => page.locator(".msg-item--agent");

async function submit(page, text) {
  await box(page).fill(text);
  await page.keyboard.press("Enter");
}

async function send(page, text) {
  const before = await replies(page).count();
  await submit(page, text);
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
      groupStart: row.getAttribute("data-group-start") === "true",
      error: row.getAttribute("data-error") === "true",
      running: row.getAttribute("data-running") === "true",
      label: row.cells[0]?.innerText.replace(/\s+/g, " ").trim() ?? "",
      text: row.cells[1]?.innerText.replace(/\s+/g, " ").trim() ?? "",
    })),
  );

const turnsOf = (rows) => {
  const turns = [];
  for (const row of rows) {
    if (row.turnStart || turns.length === 0) turns.push([]);
    turns.at(-1).push(row);
  }
  return turns;
};

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

    const conversationTab = page.getByRole("tab", { name: copy.conversation, exact: true });
    const trajectoryTab = page.getByRole("tab", { name: copy.trajectory, exact: true });
    const stream = page.locator(".chat__stream");
    await conversationTab.waitFor({ timeout: 15_000 }).catch(() => undefined);
    const tabsPresent =
      (await conversationTab.count()) === 1 && (await trajectoryTab.count()) === 1;
    check(tabsPresent, `${label}: the chat column has Conversation and Trajectory tabs`);
    if (!tabsPresent) {
      await context.close();
      continue;
    }
    check(
      (await conversationTab.getAttribute("aria-selected")) === "true" &&
        (await trajectoryTab.getAttribute("aria-selected")) === "false",
      `${label}: Conversation is selected at first`,
    );

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

    const scrollBefore = await stream.evaluate((node) => node.scrollTop);
    await trajectoryTab.click();
    const view = page.locator("[data-trajectory-scroll]");
    await view.waitFor({ timeout: 10_000 });
    check(
      (await trajectoryTab.getAttribute("aria-selected")) === "true" &&
        (await conversationTab.getAttribute("aria-selected")) === "false",
      `${label}: the Trajectory tab becomes selected`,
    );
    check(!(await stream.isVisible()), `${label}: the conversation stream is hidden`);

    const rows = await ledgerRows(page);
    const turns = turnsOf(rows);
    check(turns.length === 3, `${label}: one turn per traveller message`, turns.length);
    check(
      turns.every((turn) => turn[0].kind === "user"),
      `${label}: every turn starts with the traveller message`,
      turns.map((turn) => turn[0].kind),
    );
    check(
      turns[0]?.[0].text.includes("Tokyo from Sydney") &&
        turns[1]?.[0].text.includes("find a cheaper stay again") &&
        turns[2]?.[0].text.includes("find another stay"),
      `${label}: each User record carries the traveller's words`,
      turns.map((turn) => turn[0].text),
    );
    check(
      JSON.stringify(turns[0]?.map((row) => row.kind)) === JSON.stringify(KINDS_TURN_ONE),
      `${label}: the first turn lists the dispatch, five assignments, the check and the reply`,
      turns[0]?.map((row) => row.kind),
    );
    const two = turns[1] ?? [];
    check(
      JSON.stringify(two.map((row) => row.kind)) === JSON.stringify(KINDS_TURN_TWO),
      `${label}: the conflict turn lists message, dispatch, tool calls, conflict, revision and reply in order`,
      two.map((row) => row.kind),
    );
    check(
      two[2]?.text.startsWith(copy.custom) && two[3]?.text.startsWith(copy.searchStays),
      `${label}: the specialist's tool call sits under its own assignment`,
      [two[2]?.text, two[3]?.text],
    );
    check(
      two[5]?.text.includes(copy.conflict) && two[5]?.text.includes(copy.sentBack),
      `${label}: the conflict check names the specialist it sends back`,
      two[5]?.text,
    );
    check(
      two[7]?.text.startsWith(copy.dining) && two[8]?.text.startsWith(copy.searchPlaces),
      `${label}: the revision round assigns the sent-back specialist and nests its tool call`,
      [two[7]?.text, two[8]?.text],
    );
    check(
      two[9]?.text.includes(copy.scored) && two[9]?.text.includes(copy.kept),
      `${label}: the revision check says the revision was kept`,
      two[9]?.text,
    );
    check(
      two[11]?.text.includes(copy.noConflict) && two[13]?.text.includes(copy.stopped),
      `${label}: the second check finds no conflicts and the loop stops`,
      [two[11]?.text, two[13]?.text],
    );
    check(
      two.at(-1)?.kind === "message" && two.at(-1)?.text.startsWith(copy.custom),
      `${label}: the turn ends with the mentioned specialist's reply`,
      two.at(-1)?.text,
    );
    check(
      turns[0]?.at(-1)?.text.startsWith(copy.coordinator) &&
        turns[0]?.[1]?.text.startsWith(copy.coordinator),
      `${label}: the Coordinator's dispatch and reply are Assistant records`,
      [turns[0]?.[1]?.text, turns[0]?.at(-1)?.text],
    );
    check(
      turns[0]?.slice(2, 7).every((row) => row.kind === "tool") &&
        turns[0]?.slice(2, 7).some((row) => row.text.startsWith(copy.custom)),
      `${label}: assignments use the specialist's name, including a custom name`,
      turns[0]?.slice(2, 7).map((row) => row.text.slice(0, 24)),
    );
    check(
      two.every((row) => !row.error) &&
        turns[0].every((row) => !row.error) &&
        turns[2].some(
          (row) => row.kind === "tool" && row.error && row.text.startsWith(copy.custom),
        ) &&
        turns[2].some((row) => row.kind === "subtool" && row.error),
      `${label}: only the failed assignment and its failed tool call are marked failed`,
      turns[2]?.filter((row) => row.error).map((row) => [row.kind, row.text.slice(0, 40)]),
    );
    check(
      rows.every((row) => !row.running),
      `${label}: no record of a settled chat is left running`,
      rows.filter((row) => row.running).map((row) => row.text),
    );
    const kindLabels = Object.fromEntries(
      Object.entries(copy.kinds).map(([kind, text]) => [kind, text]),
    );
    check(
      rows.every((row) => row.label.includes(kindLabels[row.kind])),
      `${label}: kind tags use the interface language`,
      [...new Set(rows.map((row) => `${row.kind}:${row.label}`))].slice(0, 8),
    );
    const groupStarts = two.filter((row) => row.groupStart).length;
    check(
      groupStarts === 3,
      `${label}: the conflict turn has a message group and two steps`,
      groupStarts,
    );
    const stepButtons = await view
      .locator("tr[data-record-index] button[aria-label]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    check(
      stepButtons.filter((name) => name === copy.step(2)).length === 2 &&
        stepButtons.filter((name) => name === copy.step(1)).length === 3,
      `${label}: each step has a marker named after its round`,
      stepButtons,
    );
    check(
      (await view
        .locator("tr[data-turn-start] [aria-label]")
        .first()
        .getAttribute("aria-label")) === copy.turn(1),
      `${label}: turn labels use the interface language`,
    );

    const toolbar = page.getByRole("toolbar", { name: copy.toolbar });
    check((await toolbar.count()) === 1, `${label}: the toolbar is present and translated`);
    check(
      (await toolbar.getByRole("button", { name: /Duration|时长|Actual|实际/ }).count()) === 0,
      `${label}: the toolbar offers no duration or clock switch`,
    );
    const timeline = page.getByRole("region", { name: copy.timeline });
    check((await timeline.count()) === 1, `${label}: the timeline overview is present`);
    const spans = await timeline.locator("[data-timeline-span]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        kind: node.getAttribute("data-timeline-span"),
        index: Number(node.getAttribute("data-timeline-record-index")),
        lane: Number(node.style.getPropertyValue("--trajectory-span-lane")),
        left: parseFloat(node.style.getPropertyValue("--trajectory-span-left")),
        width: parseFloat(node.style.getPropertyValue("--trajectory-span-width")),
        error: node.getAttribute("data-error") === "true",
      })),
    );
    check(spans.length === rows.length, `${label}: the timeline has one span per record`, [
      spans.length,
      rows.length,
    ]);
    const laneOf = { user: 0, message: 1, tool: 2, subtool: 2 };
    check(
      spans.every((span) => span.lane === laneOf[span.kind]),
      `${label}: lanes follow the record type`,
      [...new Set(spans.map((span) => `${span.kind}:${span.lane}`))],
    );
    check(
      spans.every((span, position) => position === 0 || span.left > spans[position - 1].left) &&
        spans.every((span, position) => span.index === rows[position]?.index),
      `${label}: spans follow event order`,
    );
    check(
      spans.every((span) => Math.abs(span.width - spans[0].width) < 0.0001),
      `${label}: spans are equal width, so no duration is implied`,
      [...new Set(spans.map((span) => span.width.toFixed(3)))],
    );
    check(
      spans.filter((span) => span.error).length === rows.filter((row) => row.error).length,
      `${label}: failed records are marked on the timeline`,
    );
    await page.screenshot({ path: `${out}/${label}-ledger.png` });

    const aside = page.getByRole("complementary", { name: copy.details });
    const tableRows = view.locator("tr[data-record-index]");
    const rowOf = (turn, position) => tableRows.nth(turns.slice(0, turn).flat().length + position);
    await rowOf(1, 3).click();
    await aside.waitFor({ timeout: 5000 });
    await page.waitForTimeout(200);
    const pane = await view.boundingBox();
    const panel = await aside.boundingBox();
    check(
      pane &&
        panel &&
        pane.height >= 150 &&
        panel.y >= pane.y + pane.height - 1 &&
        panel.width >= pane.width - 2,
      `${label}: in the chat column the inspector sits under a full-width ledger`,
      { pane, panel },
    );
    const controls = await page
      .getByRole("toolbar", { name: /^(Trajectory toolbar|轨迹工具栏)$/ })
      .locator("button")
      .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().height)));
    check(
      controls.length >= 2 && controls.every((h) => h <= 30),
      `${label}: toolbar buttons are compact, not 36px pills`,
      controls,
    );
    const tabs = await aside
      .getByRole("tab")
      .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).backgroundColor));
    check(
      tabs.length >= 2 && tabs.every((c) => c === "rgba(0, 0, 0, 0)" || c === "transparent"),
      `${label}: inspector tabs are plain tabs without a pill background`,
      tabs,
    );
    check(
      (await aside.innerText()).includes(copy.stays),
      `${label}: opening a tool call shows its result`,
    );
    await rowOf(1, 2).click();
    await page.waitForTimeout(200);
    check(
      (await aside.innerText()).includes(copy.objective),
      `${label}: opening an assignment shows its objective`,
      await aside.innerText(),
    );
    const tabNames = await aside.getByRole("tab").allInnerTexts();
    check(
      JSON.stringify(tabNames) === JSON.stringify(copy.tabs),
      `${label}: the inspector offers only summary, payload and result for a tool`,
      tabNames,
    );
    const inspectorText = await aside.innerText();
    check(
      !/\btok\b|\bms\b|token|令牌|毫秒|TTFT/i.test(inspectorText),
      `${label}: the inspector shows no token or duration field`,
    );
    await page.screenshot({ path: `${out}/${label}-inspector.png` });
    await aside.getByRole("button", { name: copy.close }).click();
    check((await aside.count()) === 0, `${label}: closing the details clears the selection`);

    const searchBox = page.getByRole("searchbox", { name: copy.search });
    await searchBox.fill("places");
    await page.waitForTimeout(400);
    const found = await ledgerRows(page);
    check(
      found.length > 0 &&
        found.length < rows.length &&
        found.every((row) => /places/i.test(row.text)),
      `${label}: searching narrows the ledger to matching records`,
      found.map((row) => row.text.slice(0, 40)),
    );
    await searchBox.fill("zzzz-no-such-record");
    await page.waitForTimeout(400);
    check((await ledgerRows(page)).length === 0, `${label}: an unmatched query leaves no rows`);
    await searchBox.fill("");
    await page.waitForTimeout(400);
    check(
      (await ledgerRows(page)).length === rows.length,
      `${label}: clearing the search restores the ledger`,
    );

    const text = await page.locator("[data-trajectory-scroll]").innerText();
    check(
      !copy.foreign.test(await toolbar.innerText()) &&
        (locale === "en" || !/Turn \d|Step \d/.test(text)),
      `${label}: no label is left in the other language`,
    );

    await conversationTab.click();
    await stream.waitFor({ timeout: 5000 });
    check(
      (await stream.isVisible()) &&
        (await conversationTab.getAttribute("aria-selected")) === "true",
      `${label}: Conversation brings the stream back`,
    );
    const scrollAfter = await stream.evaluate((node) => node.scrollTop);
    check(
      Math.abs(scrollAfter - scrollBefore) <= 2,
      `${label}: the stream keeps its scroll position`,
      [scrollBefore, scrollAfter],
    );

    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page
      .getByRole("button", { name: /^(Chats|聊天)/ })
      .first()
      .click();
    await page
      .locator(".history-item__open:visible", { hasText: "Tokyo from Sydney" })
      .first()
      .click();
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length >= 3,
      ".msg-item--agent",
      { timeout: 15_000 },
    );
    await trajectoryTab.click();
    await view.waitFor({ timeout: 10_000 });
    const reloaded = turnsOf(await ledgerRows(page));
    check(reloaded.length === 3, `${label}: all three turns survive a reload`, reloaded.length);
    check(
      JSON.stringify(reloaded[0]?.map((row) => row.kind)) === JSON.stringify(KINDS_TURN_ONE) &&
        JSON.stringify(reloaded[1]?.map((row) => row.kind)) === JSON.stringify(KINDS_TURN_TWO),
      `${label}: reloaded turns keep their records in order`,
    );
    check(
      reloaded[2]?.some((row) => row.error),
      `${label}: reloaded turns keep failed records marked`,
    );
    await page.screenshot({ path: `${out}/${label}-reloaded.png` });

    await send(page, "thanks, that looks good");
    await conversationTab.click();
    await stream.waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    const gap = await stream.evaluate(
      (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
    );
    check(
      gap <= 4,
      `${label}: a reply that arrived on the Trajectory tab is in view when Conversation returns`,
      gap,
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
