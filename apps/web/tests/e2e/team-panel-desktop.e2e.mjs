import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/team-panel-desktop");
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
const IDS = [
  "coordinator",
  "itinerary",
  "transport",
  "accommodation",
  "destination-guide",
  "dining",
];
const BUTTON = { en: "Specialist team", zh: "专家团队" };
const STATUS = {
  en: { idle: "Idle", needs: "Needs change", none: "Not involved" },
  zh: { idle: "空闲", needs: "需修改", none: "未参与" },
};
const MARKERS = { en: ["Decided by AI", "Decided by code"], zh: ["AI 决定", "程序决定"] };
const STAY = { en: "Stay", zh: "住宿" };
const ASK = { en: "recommend a restaurant", zh: "推荐一家餐厅" };
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";

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

try {
  for (const [locale, width] of [
    ["en", 1440],
    ["en", 800],
    ["zh", 1440],
  ]) {
    const label = `${locale}-${width}`;
    const context = await browser.newContext({
      locale: locale === "zh" ? "zh-CN" : "en-AU",
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    let budgetOverride;
    let repeatHandoff = false;
    await page.route("**/api/chat", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (budgetOverride && body.plan) {
        body.brief = { ...body.brief, budgetTotal: budgetOverride };
        body.plan = { ...body.plan, brief: { ...body.plan.brief, budgetTotal: budgetOverride } };
      }
      const postData = JSON.stringify(body);
      if (!repeatHandoff) return route.continue({ postData });
      const response = await route.fetch({ postData });
      const lines = (await response.text()).split("\n");
      const repeated = lines.flatMap((line) =>
        line.includes('"mention_handoff"') ? [line, line] : [line],
      );
      await route.fulfill({ response, body: repeated.join("\n") });
    });
    await page.goto(base);
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
      if (!(await live.count())) break;
      await live.click();
    }

    const button = page.getByRole("button", { name: BUTTON[locale] });
    const panel = page.locator(".team-panel");
    const rows = panel.locator(".team-panel__row");
    const assignments = panel.locator(".team-panel__assignment");
    const dialog = page.getByRole("dialog", { name: BUTTON[locale] });
    const pin = async () => {
      await button.focus();
      await page.keyboard.press("Enter");
      await panel.waitFor();
    };
    const closes = () =>
      panel
        .waitFor({ state: "detached", timeout: 2000 })
        .then(() => true)
        .catch(() => false);
    const status = async () =>
      Object.fromEntries(
        await rows.evaluateAll((nodes) =>
          nodes.map((node) => [
            node.getAttribute("data-assistant"),
            node.getAttribute("data-status"),
          ]),
        ),
      );

    check((await button.count()) === 1, `${label}: the top bar has one Specialist team button`);
    check(
      await page.evaluate(
        () =>
          document
            .querySelector(".topbar-actions .team-trigger")
            ?.closest(".team-control")
            ?.nextElementSibling?.classList.contains("trip-trigger") ?? false,
      ),
      `${label}: the button sits left of Trip`,
    );
    check((await panel.count()) === 0, `${label}: the panel is closed at first`);

    await button.hover();
    await panel.waitFor();
    const idleNames = await rows.locator(".team-panel__name").allInnerTexts();
    check(
      JSON.stringify(idleNames) === JSON.stringify(ROLES[locale]),
      `${label}: six rows in the fixed order with current names`,
      idleNames,
    );
    check(
      (await rows.locator(".assistant-icon svg").count()) === 6,
      `${label}: every row has an icon`,
    );
    const idle = await status();
    check(
      IDS.every((id) => idle[id] === "idle"),
      `${label}: every row is idle before any event`,
      idle,
    );
    const idleText = await rows.locator(".team-panel__status").allInnerTexts();
    check(
      idleText.length === 6 && idleText.every((text) => text === STATUS[locale].idle),
      `${label}: idle rows say so in the interface language`,
      idleText,
    );
    await page.screenshot({ path: `${out}/${label}-idle.png` });
    await page.mouse.move(width / 2, 500);
    await panel.waitFor({ state: "detached" });
    check(true, `${label}: leaving the button closes a hover panel`);

    await button.hover();
    await panel.waitFor();
    check(
      (await dialog.count()) === 1 &&
        !(await dialog.evaluate((node) => node.contains(document.activeElement))),
      `${label}: hovering opens the dialog without taking focus`,
    );
    await button.click();
    check(await closes(), `${label}: a click closes a hover-opened panel`);
    await page.mouse.move(width / 2, 500);
    await panel.waitFor({ state: "detached" });

    await pin();
    await page.mouse.move(width / 2, 500);
    await page.waitForTimeout(300);
    check((await panel.count()) === 1, `${label}: Enter pins the panel`);
    check(
      (await button.getAttribute("aria-expanded")) === "true",
      `${label}: the button reports it is expanded`,
    );
    check((await dialog.count()) === 1, `${label}: the panel is a dialog named like the button`);
    check(
      (await button.getAttribute("aria-controls")) === (await dialog.getAttribute("id")),
      `${label}: the button controls the dialog`,
    );
    check(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      `${label}: opening by keyboard moves focus into the dialog`,
    );
    await button.click();
    check(await closes(), `${label}: a click closes a pinned panel`);
    await page.mouse.move(width / 2, 500);
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    await pin();
    await panel.focus();
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    check(
      await page.evaluate(() => document.activeElement?.classList.contains("team-trigger")),
      `${label}: Esc from inside the panel returns focus to the button`,
    );
    await pin();
    await box(page).focus();
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    check(
      await page.evaluate(() => document.activeElement?.tagName === "TEXTAREA"),
      `${label}: Esc from elsewhere leaves focus where it was`,
    );
    await pin();
    await page.locator(".chat__stream").click({ position: { x: 20, y: 20 } });
    await panel.waitFor({ state: "detached" });
    check(true, `${label}: a click outside closes the pinned panel`);

    await pin();
    await submit(page, PLAN);
    const caught = await page
      .waitForFunction(
        () => {
          const trigger = document.querySelector(".team-trigger");
          if (Number(trigger?.getAttribute("data-working")) === 0) return false;
          return {
            working: Number(trigger?.getAttribute("data-working")),
            text: trigger?.textContent ?? "",
            labelShown:
              getComputedStyle(trigger.querySelector(".team-trigger__label")).display !== "none",
            activity: document.querySelectorAll(".chat__stream > .agent-activity").length,
            rows: Object.fromEntries(
              [...document.querySelectorAll(".team-panel__row")].map((row) => [
                row.getAttribute("data-assistant"),
                row.getAttribute("data-status"),
              ]),
            ),
          };
        },
        undefined,
        { polling: "raf", timeout: 60_000 },
      )
      .then((handle) => handle.jsonValue())
      .catch(() => undefined);
    await page.screenshot({ path: `${out}/${label}-working.png` });
    check(
      caught && caught.working > 0,
      `${label}: the button counts working assistants while planning`,
      caught?.working,
    );
    check(
      caught && Object.values(caught.rows).includes("working"),
      `${label}: the panel shows a working row while planning`,
      caught?.rows,
    );
    check(
      caught && caught.labelShown === width > 1000,
      `${label}: the button label shows only above 1000px`,
      caught?.labelShown,
    );
    if (width > 1000)
      check(
        /\d/.test(caught?.text ?? ""),
        `${label}: the button shows the working count`,
        caught?.text,
      );
    check(
      caught?.activity === 1,
      `${label}: the thinking process stays in the live area while planning`,
      caught?.activity,
    );
    await page.locator(".chat__stream").click({ position: { x: 20, y: 20 } });
    await panel.waitFor({ state: "detached" });
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(800);

    check((await panel.count()) === 0, `${label}: the panel did not open on its own`);

    await button.hover();
    await panel.waitFor();
    const settled = await status();
    check(
      IDS.every((id) => settled[id] === "done"),
      `${label}: every assistant is done after the plan`,
      settled,
    );
    const owners = await assignments.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-assistant")),
    );
    check(
      IDS.slice(1).every((id) => owners.includes(id)),
      `${label}: each specialist has a dispatch assignment`,
      owners,
    );
    const markers = await assignments.locator(".team-panel__marker").allInnerTexts();
    check(
      markers.length === owners.length && markers.every((text) => MARKERS[locale].includes(text)),
      `${label}: every assignment says who decided`,
      markers,
    );
    check(
      (await assignments.locator(".team-panel__source").count()) >= 1,
      `${label}: specialist assignments show their data source`,
    );
    const names = await assignments.locator(".team-panel__owner").allInnerTexts();
    check(
      names.length > 0 && names.every((name) => ROLES[locale].includes(name)),
      `${label}: assignment owners use the interface language`,
      names,
    );
    const frame = await panel.boundingBox();
    check(
      frame && frame.x >= 0 && frame.x + frame.width <= width && frame.y + frame.height <= 1000,
      `${label}: the panel stays inside the viewport`,
      frame,
    );
    await page.screenshot({ path: `${out}/${label}-settled.png` });
    await page.mouse.move(width / 2, 500);

    await send(page, `@${STAY[locale]} find another stay`);
    await button.hover();
    await panel.waitFor();
    const single = await status();
    check(
      single.accommodation === "done" &&
        ["itinerary", "transport", "destination-guide", "dining"].every(
          (id) => single[id] === "none",
        ),
      `${label}: a single mention leaves the other specialists not involved`,
      single,
    );
    const noneText = await panel
      .locator('.team-panel__row[data-status="none"] .team-panel__status')
      .allInnerTexts();
    check(
      noneText.length === 4 && noneText.every((text) => text === STATUS[locale].none),
      `${label}: not involved rows say so`,
      noneText,
    );
    await page.mouse.move(width / 2, 500);

    const plan = (await stored(page)).plan;
    const floor = plan.sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
    const spend = plan.sections.reduce((sum, s) => sum + s.estCost, 0);
    budgetOverride = Math.floor((floor + spend) / 2);
    await send(page, `@${STAY[locale]} find a cheaper stay again`);
    budgetOverride = undefined;
    await button.hover();
    await panel.waitFor();
    const kinds = await assignments.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-kind")),
    );
    check(
      kinds.includes("dispatch") && kinds.includes("revision"),
      `${label}: the conflict turn lists dispatch and revision assignments`,
      kinds,
    );
    const lines = await panel.locator(".team-panel__check").allInnerTexts();
    check(
      lines.some(
        (line) =>
          ROLES[locale].slice(1).some((role) => line.includes(role)) &&
          line.includes(STATUS[locale].needs),
      ),
      `${label}: the conflict names the specialist with needs change`,
      lines,
    );
    check(
      lines.some((line) => /→/.test(line)),
      `${label}: the revision result says kept or discarded`,
      lines,
    );
    check(
      (await panel.locator('.team-panel__check[data-check="loop_stopped"]').count()) === 1,
      `${label}: the stop reason is shown once`,
    );
    check(
      (await panel.locator(".team-panel__check .assistant-icon").count()) === 0,
      `${label}: conflict checks are rules, not assistants`,
    );
    await page.screenshot({ path: `${out}/${label}-conflict.png` });
    await page.mouse.move(width / 2, 500);

    await send(page, `@${STAY[locale]} ${ASK[locale]}`);
    await button.hover();
    await panel.waitFor();
    const handoffs = await panel.locator('.team-panel__assignment[data-kind="handoff"]').count();
    check(
      handoffs === 1,
      `${label}: a misdirected mention shows one hand-off assignment`,
      handoffs,
    );
    const handoffMarker = await panel
      .locator('.team-panel__assignment[data-kind="handoff"] .team-panel__marker')
      .allInnerTexts();
    check(
      handoffMarker.length === 1 && MARKERS[locale].includes(handoffMarker[0]),
      `${label}: the hand-off says who decided`,
      handoffMarker,
    );
    await page.screenshot({ path: `${out}/${label}-handoff.png` });
    await page.mouse.move(width / 2, 500);

    repeatHandoff = true;
    await send(page, `@${STAY[locale]} ${ASK[locale]}`);
    repeatHandoff = false;
    await button.hover();
    await panel.waitFor();
    check(
      (await panel.locator('.team-panel__assignment[data-kind="handoff"]').count()) === 2,
      `${label}: two identical hand-off events list two assignments`,
    );
    check(
      !consoleErrors.some((text) => /same key/i.test(text)),
      `${label}: repeated hand-offs keep unique list keys`,
      consoleErrors.filter((text) => /same key/i.test(text)).length,
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
