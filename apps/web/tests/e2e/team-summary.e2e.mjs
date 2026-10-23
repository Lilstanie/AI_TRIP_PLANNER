import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/team-summary");
mkdirSync(out, { recursive: true });

const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};

const STAY = { en: "Stay", zh: "住宿" };
const CUSTOM = { en: "Hotel Buddy", zh: "酒店管家" };
const ASK = { en: "recommend a restaurant", zh: "推荐一家餐厅" };
const BUTTON = { en: "Specialist team", zh: "专家团队" };
const TEXT = {
  en: {
    plan: "Coordinator + 5 specialists · 1 round",
    mention: (name) => `${name} specialist · 1 round`,
    conflict: "Coordinator + 2 specialists · 2 rounds",
    handoff: "Coordinator + 2 specialists · 1 round",
    turn: (n) => `Turn ${n}`,
  },
  zh: {
    plan: "协调员 + 5 位专家 · 1 轮",
    mention: (name) => `${name}专家 · 1 轮`,
    conflict: "协调员 + 2 位专家 · 2 轮",
    handoff: "协调员 + 2 位专家 · 1 轮",
    turn: (n) => `第 ${n} 次对话`,
  },
};
const ACCOMMODATION = 3;
const PLAN = "Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000";

const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});

const box = (page) => page.locator(".chat__form textarea");
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null"));
const replies = (page) => page.locator(".msg-item--agent");
const summaryOf = (page, index) => replies(page).nth(index).locator(".team-summary");

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
  const tab = page.getByRole("tab", { name: /^(Chat|聊天)/ });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
}

async function rename(page, width, value) {
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
  const field = dialog.locator(".assistant-names input").nth(ACCOMMODATION);
  await field.fill(value);
  await field.blur();
  await dialog.locator(".dialog__head button").last().click();
  await dialog.waitFor({ state: "hidden" });
  if (width === 390) await toChat(page);
}

try {
  for (const locale of ["en", "zh"]) {
    for (const width of [1440, 390]) {
      const label = `${locale}-${width}`;
      const words = TEXT[locale];
      const context = await browser.newContext({
        locale: locale === "zh" ? "zh-CN" : "en-AU",
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      let budgetOverride;
      await page.route("**/api/chat", async (route) => {
        const body = JSON.parse(route.request().postData() ?? "{}");
        if (budgetOverride && body.plan) {
          body.brief = { ...body.brief, budgetTotal: budgetOverride };
          body.plan = { ...body.plan, brief: { ...body.plan.brief, budgetTotal: budgetOverride } };
        }
        await route.continue({ postData: JSON.stringify(body) });
      });
      await page.goto(base);
      await page.locator(".workspace-app").waitFor();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const live = page.getByRole("button", { name: /^(Live data|实时数据)/ });
        if (!(await live.count())) break;
        await live.click();
      }
      if (width === 390) await toChat(page);

      await send(page, `@${STAY[locale]} when are hotels cheapest?`);
      await send(page, PLAN);
      await send(page, `@${STAY[locale]} find a cheaper stay`);
      const plan = (await stored(page)).plan;
      const floor = plan.sections.reduce((sum, s) => sum + (s.proposal?.floorCost ?? 0), 0);
      const spend = plan.sections.reduce((sum, s) => sum + s.estCost, 0);
      budgetOverride = Math.floor((floor + spend) / 2);
      await send(page, `@${STAY[locale]} find a cheaper stay again`);
      budgetOverride = undefined;
      await send(page, `@${STAY[locale]} ${ASK[locale]}`);

      const stay = STAY[locale];
      check(
        (await summaryOf(page, 0).count()) === 0,
        `${label}: a needs-info reply has no summary`,
      );
      check(
        (await summaryOf(page, 1).innerText()).trim() === words.plan,
        `${label}: the planned reply says the Coordinator and five specialists`,
        await summaryOf(page, 1).innerText(),
      );
      check(
        (await summaryOf(page, 2).innerText()).trim() === words.mention(stay),
        `${label}: the single-mention reply names the specialist`,
        await summaryOf(page, 2).innerText(),
      );
      check(
        (await summaryOf(page, 3).innerText()).trim() === words.conflict,
        `${label}: the revision turn counts two rounds`,
        await summaryOf(page, 3).innerText(),
      );
      check(
        (await summaryOf(page, 4).innerText()).trim() === words.handoff,
        `${label}: the hand-off reply counts both specialists`,
        await summaryOf(page, 4).innerText(),
      );
      check(
        (await page.getByRole("list", { name: /Team conversation|团队对话/ }).count()) === 0,
        `${label}: no team conversation rows under replies`,
      );
      check(
        (await replies(page).nth(1).locator(".agent-activity").count()) === 1,
        `${label}: the thinking process stays under the reply`,
      );
      check(
        (await summaryOf(page, 1).evaluate((node) => node.tagName)) === "BUTTON",
        `${label}: the summary is a button`,
      );
      check(
        (await summaryOf(page, 1).getAttribute("aria-label"))?.includes(words.plan),
        `${label}: the summary has an accessible name that includes its text`,
        await summaryOf(page, 1).getAttribute("aria-label"),
      );
      const planIcons = await summaryOf(page, 1).evaluate((node) =>
        [...node.querySelectorAll(".assistant-icon")].map((icon) =>
          [...icon.classList].find((name) => name.startsWith("assistant-icon--")),
        ),
      );
      check(planIcons.length === 6, `${label}: the planned summary shows six avatars`, planIcons);
      const stayIcons = await summaryOf(page, 2).locator(".assistant-icon").count();
      check(stayIcons === 1, `${label}: the mention summary shows one avatar`, stayIcons);
      await page.screenshot({ path: `${out}/${label}-summaries.png` });

      const panel = page.locator(".team-panel");
      const turn = page.locator(".team-run__turn");
      {
        const phone = width <= 520;
        const button = phone
          ? page.locator(".phone-topbar__team")
          : page.getByRole("button", { name: BUTTON[locale], exact: true });
        const dismiss = async () => {
          if (phone) await page.keyboard.press("Escape");
          else await page.locator(".chat__stream").click({ position: { x: 20, y: 20 } });
          await panel.waitFor({ state: "detached" });
        };
        const openLatest = async () => {
          if (phone) await button.click();
          else await button.hover();
          await panel.waitFor();
        };
        await page.mouse.move(width / 2, 500);
        check(
          (await panel.count()) === 0,
          `${label}: the panel is closed before a summary is used`,
        );

        await summaryOf(page, 1).click();
        await panel.waitFor();
        const owners = await panel
          .locator(".team-panel__assignment")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-assistant")));
        check(
          owners.length === 5 && new Set(owners).size === 5 && !owners.includes("coordinator"),
          `${label}: the planned reply's panel lists the five dispatch assignments`,
          owners,
        );
        check(
          (await panel.locator('.team-panel__assignment[data-kind="revision"]').count()) === 0,
          `${label}: the planned reply's panel has no revision assignments`,
        );
        check(
          (await turn.innerText()).trim() === words.turn(2),
          `${label}: the panel labels turn 2`,
          await turn.innerText(),
        );
        await page.screenshot({ path: `${out}/${label}-turn-2.png` });

        await dismiss();
        await summaryOf(page, 3).click();
        await panel.waitFor();
        const kinds = await panel
          .locator(".team-panel__assignment")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-kind")));
        check(
          kinds.includes("dispatch") && kinds.includes("revision"),
          `${label}: the revision reply's panel lists dispatch and revision`,
          kinds,
        );
        check(
          (await panel.locator('.team-panel__check[data-check="loop_stopped"]').count()) === 1,
          `${label}: the revision reply's panel shows the stop reason`,
        );
        check(
          (await turn.innerText()).trim() === words.turn(4),
          `${label}: the panel labels turn 4`,
          await turn.innerText(),
        );
        await page.screenshot({ path: `${out}/${label}-turn-4.png` });

        await dismiss();
        await openLatest();
        check(
          (await panel.locator('.team-panel__assignment[data-kind="handoff"]').count()) === 1,
          `${label}: hovering the button still shows the latest run`,
        );
        check((await turn.count()) === 0, `${label}: the latest run carries no earlier-turn label`);
        await dismiss();

        await summaryOf(page, 1).click();
        await panel.waitFor();
        await turn.waitFor();
        await send(page, `@${stay} find another stay`);
        const live = {
          panels: await panel.count(),
          turns: await turn.count(),
          statuses: await panel
            .locator(".team-panel__row")
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-status"))),
        };
        check(
          live.panels === 1 && live.turns === 0 && live.statuses.includes("none"),
          `${label}: the next live turn switches the open panel back to the latest run`,
          live,
        );
        await dismiss();
        await openLatest();
        check(
          (await turn.count()) === 0,
          `${label}: a closed summary run does not return on the next hover`,
        );
        await dismiss();

        await summaryOf(page, 1).click();
        await panel.waitFor();
        await turn.waitFor();
        await page
          .getByRole("button", { name: locale === "zh" ? "最新对话" : "Latest turn" })
          .click();
        const latest = {
          turns: await turn.count(),
          none: await panel.locator('.team-panel__row[data-status="none"]').count(),
        };
        check(
          latest.turns === 0 && latest.none > 0,
          `${label}: the latest-turn button returns to the latest run`,
          latest,
        );
        await dismiss();
      }

      await rename(page, width, CUSTOM[locale]);
      check(
        (await summaryOf(page, 2).innerText()).trim() === words.mention(CUSTOM[locale]),
        `${label}: a custom specialist name shows in the summary`,
        await summaryOf(page, 2).innerText(),
      );
      await summaryOf(page, 2).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${label}-custom-name.png` });

      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      check(fits, `${label}: the page does not overflow`);
      const summaryFits = await page.evaluate(() =>
        [...document.querySelectorAll(".team-summary")].every((node) => {
          const reply = node.closest(".msg-item")?.getBoundingClientRect();
          const box = node.getBoundingClientRect();
          return reply && box.right <= reply.right + 1 && box.left >= reply.left - 1;
        }),
      );
      check(summaryFits, `${label}: every summary stays inside its reply`);
      if (width <= 520) {
        const hit = await summaryOf(page, 2).evaluate((node) => {
          const box = node.getBoundingClientRect();
          const x = box.left + box.width / 2;
          const hits = (y) => node.contains(document.elementFromPoint(x, y));
          return {
            height: Math.round(box.height),
            top: hits(box.top - 4),
            bottom: hits(box.bottom + 4),
          };
        });
        check(
          hit.top && hit.bottom && hit.height + 8 >= 44,
          `${label}: the summary hit area is at least 44 px high`,
          hit,
        );
      }
      check(errors.length === 0, `${label}: no page errors`, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/result.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((entry) => !entry.ok)) process.exit(1);
