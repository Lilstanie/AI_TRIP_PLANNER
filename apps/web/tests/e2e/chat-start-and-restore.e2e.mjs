import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? "output/playwright/chat-start-and-restore",
  process.env.EVIDENCE_LABEL ?? "after",
);
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const footer = (page) => page.locator(".save-state").first();
const watchComposer = (page) =>
  page.evaluate(() => {
    window.__composerFrames = [];
    const sample = () => {
      const form = document.querySelector("form.chat__form");
      if (form)
        window.__composerFrames.push([
          form.getAnimations().length,
          Math.round(form.getBoundingClientRect().top),
        ]);
      if (window.__composerFrames.length < 120) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
const tripToggle = (page) =>
  page.locator('button:has-text("Trip"):right-of(:text("Mock data"))').first();

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(BASE, { waitUntil: "networkidle" });

  const form = page.locator("form.chat__form");
  await form.waitFor();
  const blank = await form.boundingBox();
  check(
    blank && blank.y + blank.height / 2 < 1000 * 0.6 && blank.y > 1000 * 0.25,
    "blank chat centres the composer",
    blank,
  );
  await page.screenshot({ path: resolve(out, "01-blank-centred.png") });

  await page.locator("textarea").first().fill("Plan 4 days in Sydney");
  await page.waitForTimeout(300);
  const typing = await form.boundingBox();
  check(
    typing && Math.abs(typing.y + typing.height / 2 - (blank.y + blank.height / 2)) < 80,
    "typing keeps the composer near the centre",
    typing,
  );
  await page.locator("textarea").first().fill("");

  await watchComposer(page);
  await page.getByRole("button", { name: "Sydney · 4 days" }).click();
  await page.screenshot({ path: resolve(out, "02-composer-moving.png") });
  await page.waitForTimeout(800);
  const BLANK_Y = blank.y;
  const frames = await page.evaluate(() => window.__composerFrames);
  check(
    frames.some(([animations, top]) => animations > 0 && Math.abs(top - BLANK_Y) < 40) &&
      frames.some(([animations, top]) => animations > 0 && top > BLANK_Y + 100),
    "sending glides the composer from the centre to the bottom",
    frames.slice(0, 12),
  );
  const sent = await form.boundingBox();
  check(
    sent && sent.y + sent.height > 1000 * 0.85,
    "composer rests at the bottom after send",
    sent,
  );

  const reply = page.locator(".msg-item").last();
  await page
    .getByText(/Estimated total/)
    .first()
    .waitFor({ timeout: 60_000 });
  const text = (await reply.innerText()).replace(/\s+/g, " ");
  check(
    !/per day [A-Z]/.test(text),
    "fallback reply ends each summary sentence before the next",
    text.slice(0, 160),
  );
  await page.screenshot({ path: resolve(out, "03-planned.png") });

  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Chats/ }).click();
  await page
    .getByRole("button", { name: /Sydney · / })
    .first()
    .click();
  await page.waitForTimeout(1500);
  check(
    (await footer(page).innerText()).includes("Saved"),
    "reopening a restored chat settles on Saved",
    await footer(page).innerText(),
  );

  await tripToggle(page).click();
  const stop = page.getByRole("button", { name: /^Actions for / }).first();
  await stop.waitFor();
  await stop.click();
  await page.getByRole("menuitem", { name: "Move to next day" }).click();
  await page.waitForTimeout(2000);
  check(
    (await page.getByText("This edit is stale").count()) === 0,
    "editing a restored trip is not rejected as stale",
  );
  check(
    (await page.getByRole("button", { name: /Undo/ }).count()) > 0,
    "the restored-trip edit applies with Undo",
  );
  await page.waitForTimeout(1000);
  check(
    (await footer(page).innerText()).includes("Saved"),
    "the edit is saved",
    await footer(page).innerText(),
  );
  await page.screenshot({ path: resolve(out, "04-restored-edit.png") });

  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const still = await reduced.newPage();
  await still.goto(BASE, { waitUntil: "networkidle" });
  await watchComposer(still);
  await still.getByRole("button", { name: "Sydney · 4 days" }).click();
  await still.waitForTimeout(500);
  const stillFrames = await still.evaluate(() => window.__composerFrames);
  check(
    stillFrames.every(([animations]) => animations === 0),
    "reduced motion moves the composer without animation",
    stillFrames.slice(0, 6),
  );
  await reduced.close();

  check(pageErrors.length === 0, "no page errors", pageErrors);
  await context.close();
} finally {
  await browser.close();
  writeFileSync(resolve(out, "summary.json"), JSON.stringify({ base: BASE, checks }, null, 2));
}
const failed = checks.filter((item) => !item.ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed; evidence in ${out}`);
if (failed.length) process.exit(1);
