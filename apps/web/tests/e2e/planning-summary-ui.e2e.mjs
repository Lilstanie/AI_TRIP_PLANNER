import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const OUT = resolve(
  process.cwd(),
  "output/playwright/planning-summary-ui",
  process.env.RUN_ID ?? "latest",
);
mkdirSync(OUT, { recursive: true });
const checks = [];
const check = (ok, message) => {
  checks.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["phone", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await page.locator(".workspace-app").waitFor();
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const live = page.getByRole("button", { name: /^Live data/ });
    if (await live.count()) await live.click();
    if (name === "phone")
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Chat/ }).click();
    await page
      .getByLabel("Message AI Trip Planner")
      .fill(
        "Plan a trip to Sydney from 2026-12-01 to 2027-12-31 for 2 travellers, budget AUD 3000",
      );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.locator(".msg-item--agent .msg-item__body").first().waitFor({ timeout: 240000 });
    if (name === "phone")
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Trip/ }).click();
    else await page.getByRole("button", { name: "Open your trip", exact: true }).click();
    const tips = page.locator(".trip-tips").filter({ visible: true });
    await tips.waitFor();
    if (!(await tips.evaluate((element) => element.open))) await tips.locator("summary").click();
    await tips.locator(".trip-tips__list").waitFor({ state: "visible" });
    const text = await tips.innerText();
    writeFileSync(`${OUT}/${name}-tips.txt`, text);
    check(
      text.includes("December 2026 only") && text.includes("December 2027"),
      `${name}: visible tips disclose first-month scope`,
    );
    await tips.screenshot({ path: `${OUT}/${name}-tips.png` });
    check(errors.length === 0, `${name}: no browser errors`);
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify({ checks }, null, 2));
}
if (checks.some((item) => !item.ok)) process.exitCode = 1;
