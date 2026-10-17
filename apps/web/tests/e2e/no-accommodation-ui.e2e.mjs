import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/no-accommodation", process.env.RUN_ID ?? "latest");
mkdirSync(out, { recursive: true });
const checks = [];
const requests = [];
const check = (ok, name) => {
  checks.push({ ok: Boolean(ok), name });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};
const fixtureRoot = resolve(process.env.FIXTURE_ROOT ?? "../../output/e2e/no-accommodation/green");
const terminal = (name) =>
  readFileSync(`${fixtureRoot}/${name}.ndjson`, "utf8").trim().split("\n").map(JSON.parse).at(-1);
const browser = await chromium.launch();
try {
  for (const width of [375, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const openPreferences = async () => {
      const chip = page.getByRole("button", { name: "Open trip preferences" });
      if (await chip.isVisible()) await chip.click();
      else {
        await page.getByRole("button", { name: /^Trip details:/ }).click();
        await page.locator('[data-fact="preferences"]').click();
      }
    };
    await context.tracing.start({ screenshots: true, snapshots: true });
    await page.route("**/api/chat", async (route) => {
      const request = route.request().postDataJSON();
      requests.push(request);
      const brief = request.brief ?? request.known;
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: JSON.stringify(terminal(brief?.noAccommodation ? "none" : "normal")) + "\n",
      });
    });
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
    await openPreferences();
    const choice = page.getByRole("checkbox", { name: "No accommodation needed" });
    check(!(await choice.isChecked()), `${width}: accommodation remains the default`);
    await choice.check();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.waitForTimeout(700);
    await page.reload();
    await openPreferences();
    check(await choice.isChecked(), `${width}: no-accommodation preference survives reload`);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Message AI Trip Planner" });
    await input.fill("Plan four days in Sydney for two people from 2026-12-01, budget AUD 5000");
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".composer__input")?.disabled);
    await page.waitForTimeout(500);
    check(
      requests.at(-1)?.known?.noAccommodation === true ||
        requests.at(-1)?.brief?.noAccommodation === true,
      `${width}: chat receives the explicit preference`,
    );
    await openPreferences();
    check(await choice.isChecked(), `${width}: completed plan retains the preference`);
    await choice.uncheck();
    await page.getByRole("button", { name: "Update trip", exact: true }).click();
    await page.waitForTimeout(700);
    check(
      requests.at(-1)?.brief?.noAccommodation === false,
      `${width}: turning accommodation back on submits false`,
    );
    await page.screenshot({ path: `${out}/${width}.png`, fullPage: true });
    await context.tracing.stop({ path: `${out}/${width}-trace.zip` });
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/summary.json`, JSON.stringify({ checks, requests }, null, 2));
}
process.exitCode = checks.some((check) => !check.ok) ? 1 : 0;
