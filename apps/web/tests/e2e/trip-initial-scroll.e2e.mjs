import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/trip-initial-scroll", process.env.LABEL ?? "first");
mkdirSync(out, { recursive: true });
const rows = [];
const browser = await chromium.launch({ channel: "chrome" });
let failure;
let activePage;
try {
  for (const [width, height] of [
    [1280, 800],
    [1440, 1000],
    [390, 844],
  ]) {
    const phone = width < 520;
    const context = await browser.newContext({
      viewport: { width, height },
      locale: phone ? "zh-CN" : "en-AU",
      reducedMotion: "reduce",
      ...(phone ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push({ text: message.text(), location: message.location() });
    });
    const phoneNames = { Chat: "聊天", Trip: "行程", Mine: "我的" };
    const tab = (name) =>
      page
        .locator(".phone-tabbar")
        .getByRole("tab", { name: new RegExp(`^${phone ? phoneNames[name] : name}`) });
    const assertDayTabPanel = async () => {
      const semantics = await page.locator(".day-strip").evaluate((strip) => {
        const tabs = [...strip.querySelectorAll('[role="tab"]')];
        const selected = tabs.find((node) => node.getAttribute("aria-selected") === "true");
        const panelId = selected?.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        return {
          ids: tabs.map((node) => node.id),
          controls: tabs.map((node) => node.getAttribute("aria-controls")),
          selectedId: selected?.id,
          panelId,
          panelRole: panel?.getAttribute("role"),
          labelledBy: panel?.getAttribute("aria-labelledby"),
          containsDay: !!panel?.querySelector(".timeline-day h3"),
          containsTimeline: !!panel?.querySelector(".timeline, .timeline-empty"),
        };
      });
      assert.ok(semantics.ids.every(Boolean), "Every day tab has an id");
      assert.equal(new Set(semantics.ids).size, semantics.ids.length, "Day tab IDs are unique");
      assert.ok(
        semantics.controls.every((id) => id === semantics.panelId),
        "Every day tab controls the day panel",
      );
      assert.ok(semantics.panelId, "The selected day tab controls a panel");
      assert.equal(semantics.panelRole, "tabpanel");
      assert.equal(
        semantics.labelledBy,
        semantics.selectedId,
        "The panel is labelled by the selected tab",
      );
      assert.equal(semantics.containsDay, true, "The selected day heading is inside its panel");
      assert.equal(
        semantics.containsTimeline,
        true,
        "The selected day timeline is inside its panel",
      );
    };
    const open = async () => {
      if (phone) await tab("Trip").click();
      else
        await page
          .locator(".workspace-app")
          .getByRole("button", { name: "Open your trip", exact: true })
          .click();
      await page
        .locator(phone ? "#phone-panel-trip .trip-editor" : ".drawer.is-open .trip-editor")
        .waitFor();
    };
    const measure = async (stage) => {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const row = await page
        .locator(phone ? ".workspace-panel--trip" : ".drawer.is-open .drawer__body")
        .evaluate((node) => ({
          scrollTop: node.scrollTop,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          top: node.getBoundingClientRect().top,
          bottom: node.getBoundingClientRect().bottom,
          headings: [
            ...node.querySelectorAll('h2,h3,.trip-budget,[aria-label="Trip timeline"]'),
          ].map((e) => ({
            text: e.textContent?.slice(0, 100),
            label: e.getAttribute("aria-label"),
            top: e.getBoundingClientRect().top,
            bottom: e.getBoundingClientRect().bottom,
          })),
        }));
      rows.push({ width, height, stage, ...row, errors: [...errors] });
      console.log(JSON.stringify(rows.at(-1)));
      await page.screenshot({ path: `${out}/${width}-${stage}.png` });
    };
    await page.route(`${process.env.BASE_URL}/favicon.ico`, (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(process.env.BASE_URL);
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
    if (phone) await tab("Mine").click();
    const live = page.getByRole("button", { name: /^Live data/ });
    if (await live.count()) await live.first().click();
    if (phone) await tab("Chat").click();
    await page
      .locator(".composer__input")
      .fill("Sydney, 2026-11-02 to 2026-11-05, 2 people, budget AUD 2000");
    await page.getByRole("button", { name: phone ? "发送" : "Send", exact: true }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    await open();
    if (phone) await page.waitForFunction(() => document.documentElement.lang === "zh-CN");
    await assertDayTabPanel();
    await measure("initial");
    if (phone) await tab("Chat").click();
    else await page.locator(".drawer.is-open .drawer__close").click();
    await open();
    await measure("reopen");
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
    if (phone) await tab("Mine").click();
    else
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Chats/ })
        .click();
    const saved = page
      .locator(".history-item:not(.history-item--trip) .history-item__open")
      .first();
    await saved.waitFor();
    const savedTitle = await saved.innerText();
    await saved.click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor();
    await open();
    await measure("saved-reload");
    rows.at(-1).savedTitle = savedTitle;
    const panel = page.locator(phone ? ".workspace-panel--trip" : ".drawer.is-open .drawer__body");
    await panel.evaluate((node) => {
      node.scrollTop = 140;
    });
    if (phone) await tab("Chat").click();
    else await page.locator(".drawer.is-open .drawer__close").click();
    await open();
    assert.equal(
      await panel.evaluate((node) => node.scrollTop),
      140,
      "User scroll survives reopening",
    );
    const strip = page.locator(
      phone ? "#phone-panel-trip .day-strip" : ".drawer.is-open .day-strip",
    );
    await strip.scrollIntoViewIfNeeded();
    await strip.getByRole("tab").first().focus();
    await page.keyboard.press("End");
    const last = strip.getByRole("tab").last();
    await assertDayTabPanel();
    assert.equal(await last.getAttribute("aria-selected"), "true");
    assert.equal(await last.evaluate((node) => document.activeElement === node), true);
    assert.equal(
      await last.evaluate((node) => {
        const a = node.getBoundingClientRect(),
          b = node.parentElement.getBoundingClientRect();
        return a.left >= b.left - 1 && a.right <= b.right + 1;
      }),
      true,
      "Last day remains visible after End",
    );
    await page.screenshot({ path: `${out}/${width}-keyboard-end.png` });
    await page.keyboard.press("Home");
    await assertDayTabPanel();
    assert.equal(await strip.getByRole("tab").first().getAttribute("aria-selected"), "true");
    await page.keyboard.press("ArrowRight");
    await assertDayTabPanel();
    assert.equal(await strip.getByRole("tab").nth(1).getAttribute("aria-selected"), "true");
    await page.keyboard.press("ArrowLeft");
    await assertDayTabPanel();
    assert.equal(await strip.getByRole("tab").first().getAttribute("aria-selected"), "true");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "No horizontal page overflow",
    );
    assert.deepEqual(errors, [], "No page or console errors");
    await context.close();
  }
  assert.equal(rows.length, 9);
  assert.deepEqual(
    rows.map((row) => row.scrollTop),
    Array(9).fill(0),
    "Fresh Trip opens at the top",
  );
  for (const row of rows) {
    const budgetLabel = row.width < 520 ? "行程预算" : "Trip budget";
    const budget = row.headings.find((h) => h.text.startsWith(budgetLabel));
    assert.ok(
      budget.top >= row.top && budget.bottom <= row.bottom,
      "Budget summary is fully visible",
    );
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${out}/failure.png` });
    writeFileSync(`${out}/failure-body.txt`, await activePage.locator("body").innerText());
  }
  failure = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(
    `${out}/summary.json`,
    JSON.stringify({ browser: browser.version(), faviconFixture: 204, rows, failure }, null, 2),
  );
  await browser.close();
}
