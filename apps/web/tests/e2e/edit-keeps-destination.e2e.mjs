import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace } from "./trip-setup.mjs";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = resolve("output/playwright/edit-keeps-destination");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (name, test) => {
  checks.push({ name, pass: Boolean(test) });
  console.log(`${test ? "PASS" : "FAIL"} ${name}`);
};

async function send(page, message) {
  const completion = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/chat",
    { timeout: 180_000 },
  );
  await page.getByRole("textbox", { name: "Message AI Trip Planner" }).fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const frames = (await (await completion).text()).trim().split("\n").map(JSON.parse);
  const frame = frames.at(-1);
  assert.equal(frame.type, "complete", JSON.stringify(frame).slice(0, 600));
  await page.locator(".msg-item--agent .msg-item__body").last().waitFor();
  return frame.response;
}

const browser = await chromium.launch({ channel: process.env.CHANNEL });
let page;
try {
  for (const edit of ["Change it to 3 days", "Make it 3 days"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
      locale: "en-AU",
    });
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await openMockWorkspace(page, base);
    const first = await send(
      page,
      "Plan a 4-day trip to Sydney for 2 people from 2026-11-12 to 2026-11-15, total budget 4000.",
    );
    check(`${edit}: first plan is Sydney`, first.plan.brief.destination === "Sydney");
    const edited = await send(page, edit);
    const label = edit.replace(/ 3 days$/, "");
    check(
      `${edit}: destination stays Sydney (got ${edited.plan.brief.destination})`,
      edited.plan.brief.destination === "Sydney",
    );
    check(
      `${edit}: trip is 2026-11-12 to 2026-11-14 (got ${edited.plan.brief.dates.join(" to ")})`,
      edited.plan.brief.dates.join() === "2026-11-12,2026-11-14",
    );
    const reply = await page.locator(".msg-item--agent .msg-item__body").last().innerText();
    check(`${edit}: reply names Sydney`, reply.includes("Sydney"));
    check(`${edit}: reply does not treat "${label}" as a place`, !reply.includes(label));
    check(`${edit}: no page errors (${errors.join("; ")})`, errors.length === 0);
    await page.screenshot({ path: `${out}/${label.replaceAll(" ", "-").toLowerCase()}.png` });
    await context.close();
    page = undefined;
  }

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await openMockWorkspace(page, base);
  const leading = await send(page, "Tokyo 5 days from 2026-12-01 for 2 people, budget AUD 3000");
  check(
    `leading place still parses as Tokyo (got ${leading.plan.brief.destination})`,
    leading.plan.brief.destination === "Tokyo",
  );
  check(`leading place: no page errors (${errors.join("; ")})`, errors.length === 0);
  await page.screenshot({ path: `${out}/leading-place-390.png` });
  await context.close();
  page = undefined;
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    writeFileSync(`${out}/failure.html`, await page.content());
  }
  throw error;
} finally {
  const failed = checks.filter((entry) => !entry.pass).length;
  writeFileSync(
    `${out}/summary.json`,
    `${JSON.stringify({ passed: checks.length - failed, failed, checks }, null, 2)}\n`,
  );
  await browser.close();
}
if (checks.some((entry) => !entry.pass)) process.exit(1);
