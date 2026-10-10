import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/source-budget");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok" : "FAIL"} ${name}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: width === 390 ? 844 : 1000 },
    });

    await context.addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = "nextjs-portal { display: none !important; }";
        document.head.append(style);
      }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const phone = width === 390;
    const mine = page.locator(".phone-mine");
    const selectTab = async (name) => {
      await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: new RegExp(`^${name}`) })
        .click();
      await page.waitForTimeout(400);
    };
    const factsSheet = page.getByRole("dialog", { name: "Trip details", exact: true });
    const openFacts = async () => {
      await page.locator(".phone-topbar__title-button").click();
      await factsSheet.waitFor();
    };
    const openSettings = async () => {
      if (phone) {
        await selectTab("Mine");
        await mine.getByRole("button", { name: "Settings & account", exact: true }).click();
      } else await page.locator('button[aria-label^="Account settings:"]:visible').first().click();
    };

    const openBudget = async (empty = false) => {
      if (phone) {
        await openFacts();
        await factsSheet.locator('.facts-sheet__row[data-fact="budget"]').click();
      } else if (empty) await page.getByRole("button", { name: "Budget", exact: true }).click();
      else await page.getByRole("button", { name: /^Budget:/ }).click();
    };

    const budgetText = async () => {
      if (!phone) return page.getByRole("button", { name: /^Budget:/ }).textContent();
      await openFacts();
      const text = await factsSheet
        .locator('.facts-sheet__row[data-fact="budget"] .facts-sheet__value')
        .textContent();
      await page.keyboard.press("Escape");
      await factsSheet.waitFor({ state: "detached" });
      return text;
    };
    const showChats = async () => {
      if (phone) await selectTab("Mine");
      else await page.getByRole("button", { name: /^Chats/ }).click();
    };
    const chats = phone ? mine : page;
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    await openSettings();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Language & region" }).click();
    await dialog.getByRole("button", { name: "Change Display currency" }).click();
    await dialog
      .getByRole("group", { name: "Display currency", exact: true })
      .getByRole("button", { name: "CNY", exact: true })
      .click();
    await page.keyboard.press("Escape");
    if (phone) await selectTab("Chat");
    await openBudget(true);
    await page.getByLabel("Or enter an amount (CNY)").fill("5000");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    check(
      (await budgetText()).replace(/\s/g, " ").includes("CNY 5,000.00"),
      `${width}: source budget shown verbatim`,
    );
    const input = page.getByRole("textbox", { name: "Message AI Trip Planner" });
    await input.fill("Plan Sydney, 2026-11-10 to 2026-11-13, 2 travellers.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief?.budgetSource
          ?.amount === 5000,
    );
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1")));
    check(
      stored.plan.brief.budgetTotal === 1050 && stored.plan.brief.budgetSource.currency === "CNY",
      `${width}: brief stores CNY 5000 and AUD 1050`,
    );
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    await showChats();

    await (
      phone
        ? mine.locator('.history-item__open[title^="Plan Sydney"]')
        : page.locator(".history-item__open")
    )
      .first()
      .click();
    await openBudget();
    check(
      (await page.getByLabel("Or enter an amount (CNY)").inputValue()) === "5000",
      `${width}: reload preserves original input`,
    );
    await page.screenshot({ path: `${out}/${width}-budget.png`, fullPage: true });
    await page.keyboard.press("Escape");
    check(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("trip.settings.v1")).displayCurrency === "CNY",
      ),
      `${width}: settings unchanged`,
    );

    await openSettings();
    await dialog.getByRole("tab", { name: "Language & region" }).click();
    await dialog.getByRole("button", { name: "Change Display currency" }).click();
    await dialog
      .getByRole("group", { name: "Display currency", exact: true })
      .getByRole("button", { name: "USD", exact: true })
      .click();
    await page.keyboard.press("Escape");
    if (phone) await selectTab("Chat");
    check((await budgetText()).includes("CNY"), `${width}: trip source overrides new USD setting`);
    await openBudget();
    const replacement = page.getByLabel("Or enter an amount (CNY)");
    await replacement.fill("");
    await replacement.fill("6000");
    check(
      (await replacement.inputValue()) === "6000",
      `${width}: replacing source budget keeps CNY despite USD setting`,
    );
    await page.keyboard.press("Escape");
    await showChats();
    await chats
      .locator(".chats-panel__actions")
      .getByRole("button", { name: "New trip", exact: true })
      .click();
    await page.getByRole("dialog", { name: "Where", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Where", exact: true }).waitFor({ state: "hidden" });
    await openBudget(true);
    check(
      await page.getByLabel("Or enter an amount (USD)").isVisible(),
      `${width}: new trip returns to USD settings`,
    );
    await page.keyboard.press("Escape");
    await input.fill(
      "Plan a 4-day trip to Sydney for 2 people from 2026-11-10 to 2026-11-14, total budget 10000 CNY.",
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief?.budgetSource
          ?.amount === 10000,
    );
    check((await budgetText()).includes("CNY"), `${width}: chat source controls trip display`);
    check(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("trip.settings.v1")).displayCurrency === "USD",
      ),
      `${width}: chat source leaves Settings USD unchanged`,
    );
    check(errors.length === 0, `${width}: no page errors ${errors.join(" | ")}`);
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no overflow`,
    );
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
