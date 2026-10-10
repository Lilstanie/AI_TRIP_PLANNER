import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/display-currency");
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
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.route("**/api/places/search", (route) => route.fulfill({ json: { places: [] } }));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    await page.locator(".chat-empty__suggestions button").first().click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 180000 });
    const setCurrency = async (currency) => {
      if (width <= 520) {
        await page.getByRole("tab", { name: "Mine", exact: true }).click();
        await page.locator(".phone-mine__settings").click();
      } else await page.locator('button[aria-label^="Account settings:"]:visible').first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("tab", { name: "Language & region" }).click();
      await dialog.getByRole("button", { name: "Change Display currency" }).click();
      await dialog
        .getByRole("group", { name: "Display currency", exact: true })
        .getByRole("button", { name: currency, exact: true })
        .click();
      await page.keyboard.press("Escape");
    };
    for (const currency of ["CNY", "USD", "JPY"]) {
      await setCurrency(currency);
      if (width <= 520)
        await page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ }).click();
      else await page.getByRole("button", { name: "Open your trip" }).click();
      const total = page.locator(".trip__budget strong");
      const plan = await page.evaluate(
        () => JSON.parse(localStorage.getItem("trip-workspace-v1")).plan,
      );
      const rate = { CNY: 0.21, USD: 1.5, JPY: 0.01 }[currency];
      const expected = (amount) =>
        new Intl.NumberFormat("en-AU", {
          style: "currency",
          currency,
          currencyDisplay: "code",
          minimumFractionDigits: currency === "JPY" ? 0 : 2,
          maximumFractionDigits: currency === "JPY" ? 0 : 2,
        }).format(amount / rate);
      await total.waitFor();
      check(
        (await total.textContent()).includes(currency),
        `${width}: trip total uses ${currency}`,
      );
      check(
        (await total.textContent()) === expected(plan.estTotal),
        `${width}: numeric total uses shared ${currency} direction`,
      );
      if (width <= 520) await page.locator(".phone-topbar__title-button").click();
      const chip =
        width <= 520
          ? page.locator('.facts-sheet__row[data-fact="budget"]')
          : page.getByRole("button", { name: /^Budget:/ });
      check(
        (await chip.textContent()).includes(expected(plan.brief.budgetTotal)),
        `${width}: original AUD budget converts to expected ${currency} number`,
      );
      check(
        (await chip.textContent()).includes(currency),
        `${width}: budget chip uses ${currency}`,
      );
      if (width <= 520) {
        await page.keyboard.press("Escape");
        await page.locator(".facts-sheet").waitFor({ state: "detached" });
      }
      check(
        await page.locator(".trip-panel .currency-notice").isVisible(),
        `${width}: dated estimate notice visible`,
      );
      check(
        (await page.locator(".trip-panel .currency-notice").textContent()).includes("2026-09-20"),
        `${width}: rate date shown`,
      );

      const amounts =
        (await page.locator(".trip-panel").first().innerText()).match(
          /\b(?:AUD|CNY|USD|JPY)[\s\u00a0][\d,]+(?:\.\d+)?/g,
        ) ?? [];
      check(
        amounts.length > 0 && amounts.every((amount) => amount.startsWith(currency)),
        `${width}: every drawer amount is converted (${amounts.slice(0, 6).join(", ")})`,
      );
      if (currency === "JPY")
        check(!/\.\d/.test(await total.textContent()), `${width}: JPY has no decimals`);
      await page.screenshot({ path: `${out}/${width}-${currency}.png`, fullPage: true });
      await page.keyboard.press("Escape");
    }
    await page.reload();
    await page.locator(".workspace-app").waitFor();
    check(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("trip.settings.v1")).displayCurrency === "JPY",
      ),
      `${width}: choice persists`,
    );
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width}: no horizontal overflow`,
    );
    check(errors.length === 0, `${width}: no page errors ${errors.join(" | ")}`);
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((item) => !item.ok)) process.exit(1);
