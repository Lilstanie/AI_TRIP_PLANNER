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
const BUTTON = "Agent Team";
const CLEAR = "Show all records";

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
    let budgetOverride;
    await page.route("**/api/chat", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (budgetOverride && body.plan) {
        body.brief = { ...body.brief, budgetTotal: budgetOverride };
        body.plan = { ...body.plan, brief: { ...body.plan.brief, budgetTotal: budgetOverride } };
      }
      return route.continue({ postData: JSON.stringify(body) });
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
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"),
    );
    const sections = stored.plan.sections;
    const floor = sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
    const spend = sections.reduce((sum, s) => sum + s.estCost, 0);
    budgetOverride = Math.floor((floor + spend) / 2);
    await send(page, "@Stay find a cheaper stay again");
    budgetOverride = undefined;

    const panel = page.locator(".team-panel");
    const trigger = phone
      ? page.locator(".phone-topbar__team")
      : page.getByRole("button", { name: BUTTON, exact: true });
    const openLatest = async () => {
      if (phone) {
        await trigger.click();
        if (!(await page.locator(".phone-trajectory__team").evaluate((node) => node.open))) {
          await page.locator(".phone-trajectory__team > summary").click();
        }
      } else {
        await page.mouse.move(0, 0);
        await trigger.hover();
      }
      await panel.waitFor();
    };
    const press = (id) => panel.locator(`.team-panel__row[data-assistant="${id}"] button`);
    const trajectoryTab = page.getByRole("tab", { name: "Trajectory" });
    const conversationTab = page.getByRole("tab", { name: "Conversation" });
    const chip = page.locator("[data-trajectory-filter]");
    const ledger = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-trajectory-scroll] tr[data-record-index]")].map(
          (row) => ({
            kind: row.getAttribute("data-kind"),
            assistants: (row.getAttribute("data-assistant") ?? "").split(" ").filter(Boolean),
            running: row.getAttribute("data-running") === "true",
            text: row.cells[1]?.innerText.replace(/\s+/g, " ").trim() ?? "",
          }),
        ),
      );
    const thinkingOpen = () =>
      page.evaluate(
        () =>
          document.querySelectorAll(
            ".thinking-subagent [data-open], .thinking-turn[data-open='true']",
          ).length,
      );

    await openLatest();
    const idleCards = await panel
      .locator('.team-panel__row[data-status="none"], .team-panel__row[data-status="idle"]')
      .evaluateAll((rows) => ({
        rows: rows.length,
        actions: rows.filter((row) => row.querySelector("button:not([disabled]), a, [role=button]"))
          .length,
      }));
    check(idleCards.actions === 0, `${label}: not involved cards expose no action`, idleCards);
    if (phone) {
      const live = await panel.locator(".team-panel__row button:not([disabled])").count();
      check(live > 0, `${label}: the phone sheet cards have an action`, live);
      await page.screenshot({ path: `${out}/${label}-sheet.png` });
      await page.keyboard.press("Escape");
      await page.locator("dialog.phone-trajectory[open]").waitFor({ state: "hidden" });
    } else {
      check(
        (await press("accommodation").count()) === 1 &&
          Boolean(await press("accommodation").getAttribute("aria-label")),
        `${label}: an involved specialist has a named button`,
      );
      await page.screenshot({ path: `${out}/${label}-latest-panel.png` });
      await press("accommodation").click();
      await panel.waitFor({ state: "detached" });
      check(
        (await trajectoryTab.getAttribute("aria-selected")) === "true",
        `${label}: pressing a specialist selects the Trajectory tab`,
      );
      check((await thinkingOpen()) === 0, `${label}: no thinking row was expanded`);
      const stay = await ledger();
      check(
        stay.length > 0 &&
          stay.every((row) => row.kind !== "user" && row.assistants.includes("accommodation")),
        `${label}: only the pressed specialist's records are listed`,
        stay.map((row) => [row.kind, row.assistants]),
      );
      check(
        (await chip.count()) === 1 && (await chip.innerText()).includes("Stay"),
        `${label}: the filter names the specialist`,
      );
      const checks = stay.filter((row) => /^Conflict check/.test(row.text));
      const stayChecks = checks.map((row) => row.text);
      await page.screenshot({ path: `${out}/${label}-stay-trajectory.png` });

      await conversationTab.click();
      await openLatest();
      await press("coordinator").click();
      await panel.waitFor({ state: "detached" });
      const lead = await ledger();
      check(
        lead.length > 0 &&
          lead.every((row) => row.assistants.includes("coordinator")) &&
          lead.some((row) => row.kind === "message"),
        `${label}: the Coordinator filter replaces the Stay filter`,
        lead.map((row) => [row.kind, row.assistants]),
      );
      await conversationTab.click();
      await trajectoryTab.click();
      check((await chip.count()) === 1, `${label}: the filter survives a tab switch until cleared`);
      await chip.getByRole("button", { name: CLEAR }).click();
      const everything = await ledger();
      check(
        (await chip.count()) === 0 && everything.some((row) => row.kind === "user"),
        `${label}: clearing the filter shows every record`,
      );
      const allChecks = everything.filter((row) => /^Conflict check/.test(row.text));
      check(
        allChecks.length > 0 &&
          JSON.stringify(stayChecks) ===
            JSON.stringify(
              allChecks.filter((row) => row.text.includes("Stay")).map((row) => row.text),
            ),
        `${label}: the filter keeps exactly the conflict checks naming the specialist`,
        { stayChecks, all: allChecks.map((row) => row.text) },
      );
      await conversationTab.click();

      if (narrow) {
        const views = page.getByRole("group", { name: "Workspace view" });
        await views.getByRole("button", { name: "Map", exact: true }).click();
        await page.waitForTimeout(400);
        await openLatest();
        await press("accommodation").click();
        await panel.waitFor({ state: "detached" });
        const onChat =
          (await views
            .getByRole("button", { name: "Chat", exact: true })
            .getAttribute("aria-pressed")) === "true";
        check(
          onChat && (await trajectoryTab.getAttribute("aria-selected")) === "true",
          `${label}: pressing from the map shows the chat on the Trajectory tab`,
        );
        await chip.getByRole("button", { name: CLEAR }).click();
        await conversationTab.click();
      }

      await page.evaluate(() => {
        window.__slow = true;
      });
      await box(page).fill(PLAN);
      await page.keyboard.press("Enter");
      await page.locator(".chat__stream > .agent-activity").waitFor();
      await openLatest();
      await press("accommodation").waitFor();
      await press("accommodation").click();
      await panel.waitFor({ state: "detached" });
      await page.screenshot({ path: `${out}/${label}-live-stay.png` });
      await page.getByRole("button", { name: "Send" }).waitFor({ timeout: 240_000 });
      const settled = await ledger();
      check(
        settled.length > 0 &&
          settled.every((row) => row.assistants.includes("accommodation") && !row.running),
        `${label}: a filter set mid-run follows the run to its end`,
        settled.map((row) => [row.kind, row.assistants, row.running]),
      );
      await chip.getByRole("button", { name: CLEAR }).click();
      await conversationTab.click();
    }

    await page.evaluate(() => {
      window.__slow = true;
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
    if (phone) await page.locator("dialog.phone-trajectory[open]").waitFor({ state: "hidden" });
    else await panel.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Stop planning" }).click();
    await page.getByRole("button", { name: "Send" }).waitFor();
    await openLatest();
    const stopped = await panel.locator(".team-panel__row").evaluateAll((rows) =>
      rows.map((row) => ({
        id: row.getAttribute("data-assistant"),
        status: row.getAttribute("data-status"),
        text: row.querySelector(".team-panel__status")?.textContent,
      })),
    );
    const unfinished = stopped.filter((row) => row.status === "stopped");
    check(
      unfinished.length > 0 && unfinished.every((row) => row.text === "Stopped"),
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
