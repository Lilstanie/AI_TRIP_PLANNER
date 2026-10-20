import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/destination-conjunction");
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: process.env.CHANNEL });
let page;
try {
  for (const width of [1440, 390]) {
    for (const multiple of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        reducedMotion: "reduce",
        locale: "en-AU",
      });
      page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
      const destination = multiple ? "Sydney and Wollongong" : "Trinidad and Tobago";
      await page
        .getByRole("textbox", { name: "Message AI Trip Planner" })
        .fill(
          `Plan a 3-day trip to ${destination} from 2026-12-01 to 2026-12-03 for 2 people, budget AUD 3000.`,
        );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const choice = page.getByRole("radio", {
        name: multiple ? "Sydney & Wollongong" : "Trinidad and Tobago",
        exact: true,
      });
      await choice.waitFor({ timeout: 60000 });
      await page.screenshot({
        path: `${out}/${width}-${multiple ? "multiple" : "single"}-question.png`,
        fullPage: true,
      });
      await choice.click();
      const completion = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/chat",
        { timeout: 120000 },
      );
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      const response = await completion;
      const frames = (await response.text()).trim().split("\n").map(JSON.parse);
      const frame = frames.at(-1);
      assert.equal(frame.type, "complete", JSON.stringify(frames));
      await choice.waitFor({ state: "hidden" });
      assert.equal(
        frame.response.plan.brief.destination,
        multiple ? "Sydney & Wollongong" : destination,
      );
      assert.deepEqual(frame.response.plan.brief.dates, ["2026-12-01", "2026-12-03"]);
      assert.equal(frame.response.plan.brief.groupSize, 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `${out}/${width}-${multiple ? "multiple" : "single"}-complete.png`,
        fullPage: true,
      });
      results.push({ width, multiple, destination: frame.response.plan.brief.destination });
      await context.close();
      page = undefined;
    }
  }
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.html`, await page.content());
  }
  throw error;
} finally {
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
