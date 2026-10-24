import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/team-thinking");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";
const BUTTON = "Specialist team";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const box = (page) => page.locator(".chat__form textarea");
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

async function toChat(page) {
  const tab = page.getByRole("tab", { name: /^Chat/ });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
}

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
    turnLine: Boolean(node.closest(".thinking-turn > .thinking-row__line")),
    reply: [...document.querySelectorAll(".msg-item--agent")].findIndex((item) =>
      item.contains(node),
    ),
    live: Boolean(node.closest(".chat__stream > .agent-activity")),
    top: rect.top,
    bottom: rect.bottom,
    form: document.querySelector(".chat__form")?.getBoundingClientRect().top ?? innerHeight,
  };
};

try {
  for (const width of [1440, 800, 390]) {
    const label = `w${width}`;
    const phone = width <= 520;
    const narrow = width <= 1000;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: phone ? 600 : 560 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (!window.__slow || !String(args[0]?.url ?? args[0]).includes("/api/chat"))
          return response;
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
            await new Promise((resolve) => setTimeout(resolve, window.__delay ?? 150));
            if (args[1]?.signal?.aborted)
              throw new DOMException("The operation was aborted.", "AbortError");
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
      const live = page.getByRole("button", { name: /^Live data/ });
      if (!(await live.count())) break;
      await live.click();
    }
    if (phone) await toChat(page);

    await send(page, PLAN);
    await send(page, "@Stay find another stay");
    await send(page, "@Stay find another stay please");
    await send(page, "@Stay find a cheaper stay");
    await send(page, "@Stay find a quieter stay");
    const last = (await replies(page).count()) - 1;

    const panel = page.locator(".team-panel");
    const trigger = phone
      ? page.locator(".phone-topbar__team")
      : page.getByRole("button", { name: BUTTON, exact: true });
    const openLatest = async () => {
      if (phone) await trigger.click();
      else {
        await page.mouse.move(0, 0);
        await trigger.hover();
      }
      await panel.waitFor();
    };
    const press = (name) =>
      panel.getByRole("button", { name: new RegExp(`^Show ${name} thinking$`) });
    const settle = async () => {
      await panel.waitFor({ state: "detached" });
      await page.waitForTimeout(400);
    };

    await openLatest();
    const idleButtons = await panel
      .locator('.team-panel__row[data-status="none"], .team-panel__row[data-status="idle"]')
      .evaluateAll((rows) => ({
        rows: rows.length,
        actions: rows.filter((row) => row.querySelector("button, a, [role=button], [tabindex]"))
          .length,
      }));
    check(
      idleButtons.rows > 0 && idleButtons.actions === 0,
      `${label}: not involved rows expose no action`,
      idleButtons,
    );
    check(
      (await press("Stay").count()) === 1,
      `${label}: an involved specialist has a named button`,
    );
    await page.screenshot({ path: `${out}/${label}-latest-panel.png` });
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });

    await openLatest();
    await panel.getByRole("button", { name: /^Show Coordinator thinking$/ }).click();
    await settle();
    const lead = await opened(replies(page).nth(last));
    const leadFocus = await page.evaluate(focusInfo);
    check(
      lead.turn && lead.rows.length === 0 && leadFocus?.turnLine && leadFocus.reply === last,
      `${label}: the Coordinator opens the thinking process at its dispatch`,
      { lead, leadFocus },
    );

    await openLatest();
    await press("Stay").click();
    await settle();
    const latest = await opened(replies(page).nth(last));
    const latestFocus = await page.evaluate(focusInfo);
    check(
      latest.turn && latest.rows.length === 1 && latestFocus?.reply === last,
      `${label}: the latest-run panel opens the latest reply's Stay row`,
      { latest, latestFocus },
    );
    check(
      latestFocus && latestFocus.top >= 0 && latestFocus.bottom <= latestFocus.form + 1,
      `${label}: the latest Stay row is in view`,
      latestFocus,
    );
    await page.screenshot({ path: `${out}/${label}-latest-stay.png` });

    if (narrow) {
      if (phone) await page.getByRole("tab", { name: /^Map/ }).click();
      else
        await page
          .getByRole("group", { name: "Workspace view" })
          .getByRole("button", { name: "Map", exact: true })
          .click();
      await page.waitForTimeout(400);
      await openLatest();
      await press("Stay").click();
      await settle();
      const onChat = phone
        ? (await page.getByRole("tab", { name: /^Chat/ }).getAttribute("aria-selected")) === "true"
        : (await page
            .getByRole("group", { name: "Workspace view" })
            .getByRole("button", { name: "Chat", exact: true })
            .getAttribute("aria-pressed")) === "true";
      const fromMap = await page.evaluate(focusInfo);
      check(onChat, `${label}: pressing a specialist from the map switches to the chat`);
      check(
        fromMap?.reply === last && fromMap.subagent?.endsWith(":accommodation"),
        `${label}: the Stay row of the latest reply is focused after the switch`,
        fromMap,
      );
      check(
        fromMap && fromMap.top >= 0 && fromMap.bottom <= fromMap.form + 1,
        `${label}: the Stay row is in view after the switch`,
        fromMap,
      );
    }

    await page.evaluate(() => {
      window.__slow = true;
    });
    await box(page).fill(PLAN);
    await page.keyboard.press("Enter");
    await page.locator(".chat__stream > .agent-activity").waitFor();
    await openLatest();
    await press("Stay").waitFor();
    await page.evaluate(() => {
      window.__live = [];
      const sample = (count) => {
        const node = document.querySelector(".chat__stream > .agent-activity");
        if (node)
          window.__live.push({
            turn: node.querySelector(".thinking-turn")?.getAttribute("data-open") === "true",
            rows: [...node.querySelectorAll(".thinking-subagent")]
              .filter((row) =>
                row.querySelector(".thinking-subagent__row")?.hasAttribute("data-open"),
              )
              .map((row) => row.getAttribute("data-subagent")),
            focused: node.contains(document.activeElement),
          });
        if (count > 0) requestAnimationFrame(() => sample(count - 1));
      };
      document.addEventListener("click", () => sample(60), { capture: true, once: true });
    });
    await press("Stay").click();
    await page.waitForTimeout(1500);
    const samples = await page.evaluate(() => window.__live);
    const liveState = samples.find(
      (item) => item.turn && item.rows.length === 1 && item.focused,
    ) ?? {
      samples: samples.length,
    };
    check(
      "turn" in liveState,
      `${label}: the live panel opens the running thinking process`,
      liveState,
    );
    await page.screenshot({ path: `${out}/${label}-live-stay.png` });

    await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 240_000 });
    await page.evaluate(() => {
      window.__delay = 600;
    });
    await box(page).fill(PLAN);
    await page.keyboard.press("Enter");
    await page.locator(".chat__stream > .agent-activity").waitFor();
    await openLatest();
    await panel
      .locator('.team-panel__row[data-status="working"]:not([data-assistant="coordinator"])')
      .first()
      .waitFor();
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Stop planning" }).click();
    await page.getByRole("button", { name: "Send" }).waitFor();
    await openLatest();
    const stopped = await panel.locator(".team-panel__row").evaluateAll((rows) =>
      rows.map((row) => ({
        id: row.getAttribute("data-assistant"),
        status: row.getAttribute("data-status"),
        text: row.querySelector(".team-panel__status")?.textContent,
        action: Boolean(row.querySelector("button.team-panel__press")),
      })),
    );
    const unfinished = stopped.filter((row) => row.status === "stopped");
    check(
      unfinished.length > 0 && unfinished.every((row) => row.text === "Stopped" && row.action),
      `${label}: a cancelled turn shows its unfinished assistants as Stopped`,
      stopped,
    );
    check(
      stopped.find((row) => row.id === "coordinator")?.status === "stopped",
      `${label}: the Coordinator of a cancelled turn is Stopped`,
      stopped,
    );
    check(
      stopped.every((row) => row.status !== "working" && row.status !== "idle"),
      `${label}: a cancelled turn leaves no assistant working or idle`,
      stopped,
    );
    await page.keyboard.press("Escape");

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    check(fits, `${label}: the page does not overflow`);
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
