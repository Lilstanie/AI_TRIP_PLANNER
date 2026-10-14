import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const output = resolve("output/playwright/chinese-party-size");
mkdirSync(output, { recursive: true });

const results = [];
const check = (ok, name) => {
  results.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
};
const storedPlan = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan);

const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const width of [1440, 390]) {
    const phone = width === 390;
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: { width, height: phone ? 844 : 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(base);
    await page.locator(".workspace-app").waitFor();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const live = page.getByRole("button", { name: /^Live data/ });
      if (!(await live.count())) break;
      await live.click();
    }

    await page
      .getByRole("textbox", { name: "Message AI Trip Planner" })
      .fill("Tokyo, 2026-11-02 to 2026-11-06, 十二个人, budget AUD 24000.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan?.brief?.groupSize ===
        12,
      undefined,
      { timeout: 180_000 },
    );

    const plan = await storedPlan(page);
    check(plan?.brief?.groupSize === 12, `${width}: Chinese party size reaches the saved plan`);
    const dining = plan?.sections?.find((section) => section.id === "dining");
    const pricedDining =
      dining?.proposal?.items?.filter((item) => item.estCost !== undefined) ?? [];
    check(
      pricedDining.length > 0 &&
        pricedDining.every((item) => item.detail.includes("12 traveller(s)") && item.estCost > 0),
      `${width}: dining prices use the 12-traveller party size`,
    );

    if (phone) {
      await page
        .getByRole("tablist", { name: "Workspace sections" })
        .getByRole("tab", { name: /^Trip/ })
        .click();
    } else {
      await page.getByRole("button", { name: "Open your trip" }).click();
    }
    const trip = page.locator(phone ? "#phone-panel-trip" : ".workspace-drawer--trip");
    await trip.waitFor();
    check(
      /12\s+travellers/.test(await trip.innerText()),
      `${width}: the trip view displays 12 travellers`,
    );
    check(errors.length === 0, `${width}: no browser errors (${errors.join(" | ")})`);
    await page.screenshot({ path: `${output}/${width}-trip.png`, fullPage: true });
    writeFileSync(resolve(output, `${width}-plan.json`), JSON.stringify(plan, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(resolve(output, "report.json"), JSON.stringify(results, null, 2));
}
if (results.some((result) => !result.ok)) process.exit(1);
