import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/historical-date-confirmation");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
let page;
const requests = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-AU",
    hasTouch: true,
    isMobile: true,
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const tripId = body.tripId;
    const brief = {
      tripId,
      userId: "e2e",
      destination: "Sydney",
      dates: ["2020-01-01", "2020-01-04"],
      groupSize: 2,
      party: { adults: 2, children: 0, infants: 0, seniors: 0, pets: 0 },
      budgetTotal: 2000,
      displayCurrency: "AUD",
    };
    const response = await route.fetch({
      postData: JSON.stringify(
        requests.length === 1
          ? { tripId, mode: "plan", message: "Plan this trip", brief }
          : { tripId, mode: "plan", message: body.message, brief },
      ),
      headers: { ...route.request().headers(), "x-trip-data-mode": "mock" },
    });
    const text = await response.text();
    if (requests.length === 1) {
      const frames = text.trim().split("\n").map(JSON.parse);
      const ask = frames.at(-1);
      assert.equal(ask.type, "ask_user", text);
      ask.questions.push({
        id: "trip-dates-followup-fixture",
        header: "Trip dates",
        question: "How should the dates be handled?",
        options: [{ label: "no preference" }],
      });
      await route.fulfill({
        response,
        contentType: "application/x-ndjson",
        body: `${JSON.stringify(ask)}\n`,
      });
      return;
    }
    await route.fulfill({ response, body: text });
  });
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important }" });
  await page
    .getByRole("textbox", { name: "Message AI Trip Planner" })
    .fill("Plan Sydney from 1 Jan 2020 to 4 Jan 2020 for 2 adults, budget AUD 2000.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("radio", { name: "Confirm historical trip", exact: true }).click();
  await page.getByRole("radio", { name: "no preference", exact: true }).click();
  const completion = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/chat" && response.request().method() === "POST",
    { timeout: 120_000 },
  );
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const response = await completion;
  const frames = (await response.text()).trim().split("\n").map(JSON.parse);
  const final = frames.at(-1);
  writeFileSync(`${out}/reply.json`, JSON.stringify(requests.at(-1), null, 2));
  writeFileSync(`${out}/response.ndjson`, `${JSON.stringify(final)}\n`);
  assert.equal(requests.length, 2);
  assert.equal(
    requests.at(-1).message,
    "Dates: Confirm historical trip\nTrip dates: no preference",
  );
  assert.equal(final.type, "complete", JSON.stringify(frames));
  assert.deepEqual(final.response.plan.brief.dates, ["2020-01-01", "2020-01-04"]);
  assert.deepEqual(errors, []);
  writeFileSync(
    `${out}/result.json`,
    JSON.stringify({ ok: true, requests: requests.length }, null, 2),
  );
  await page.getByText(final.response.reply, { exact: false }).waitFor({ state: "visible" });
  await page.screenshot({ path: `${out}/success.png`, fullPage: true });
  await context.close();
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => undefined);
    writeFileSync(`${out}/failure.html`, await page.content().catch(() => ""));
    writeFileSync(
      `${out}/failure.json`,
      JSON.stringify({ error: String(error), requests }, null, 2),
    );
  }
  throw error;
} finally {
  await browser.close();
}
