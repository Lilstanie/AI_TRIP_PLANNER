import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { touchSized } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(process.env.CHAT_UI_OUT ?? "output/playwright/chat-ui-triage");
mkdirSync(out, { recursive: true });
const issue = process.env.CHAT_UI_CASE ?? "429";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: {
    width: issue === "420" || issue === "430" ? 1024 : issue === "432" ? 390 : 375,
    height: 812,
  },
});
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const checks = [];
const check = (ok, name, details) => {
  checks.push({ ok, name, details });
  console.log(`${ok ? "ok" : "FAIL"} ${name} ${JSON.stringify(details ?? "")}`);
};
try {
  await page.goto(process.env.BASE_URL ?? "http://localhost:3000", {
    timeout: 180000,
    waitUntil: "domcontentloaded",
  });
  await page.locator(".workspace-app").waitFor();
  await page.locator(".composer__input").waitFor();
  if (issue === "429") {
    const gap = await page.locator(".chat-suggestions").evaluate((el) => {
      const form = el.closest(".chat__form");
      const composer = form?.querySelector(".composer");
      if (!composer) return 0;
      return composer.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
    });
    check(gap >= 4, "429 suggestions and composer have token spacing", { gap });
  }
  if (issue === "432") {
    const sizes = await page
      .locator(".composer__add, .composer__primary, .chat-empty__suggestions button")
      .evaluateAll((els) =>
        els.map((el) => ({
          text: el.getAttribute("aria-label") ?? el.textContent,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
      );
    check(
      sizes.length >= 6 && sizes.every((s) => touchSized(s.width) && touchSized(s.height)),
      "432 phone controls have 44px targets",
      sizes,
    );
  }
  if (issue === "433") {
    await page.getByRole("tab", { name: "Mine", exact: true }).click();
    await page.locator(".phone-mine__settings").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: "Personalization" }).click();
    await dialog.evaluate(async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished));
    });
    const sizes = await dialog
      .locator(
        ".settings-tab, .settings-select, .settings-switch, .memory-row__answer, .dialog__head button",
      )
      .evaluateAll((els) =>
        els.map((el) => ({
          text: el.getAttribute("aria-label") ?? el.textContent,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
          minHeight: getComputedStyle(el).minHeight,
          computedHeight: getComputedStyle(el).height,
          dialogTransform: getComputedStyle(el.closest("dialog")).transform,
        })),
      );
    check(
      sizes.length >= 15 && sizes.every((s) => touchSized(s.width) && touchSized(s.height)),
      "433 phone settings controls have 44px targets",
      sizes,
    );
    const memory = dialog.getByRole("switch", { name: "Long-term memory" });
    await memory.click();
    check(
      (await memory.getAttribute("aria-checked")) === "false",
      "433 memory switch remains operable",
    );
  }
  if (issue === "420") {
    const destination = "Sydney" + "y".repeat(167);
    await page.getByRole("button", { name: "Where", exact: true }).click();
    await page.getByRole("textbox", { name: "Add a destination" }).fill(destination);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const chip = page.getByRole("button", { name: `Destination: ${destination}`, exact: true });
    const box = await chip.boundingBox();
    check(box.width <= 240, "420 long destination has bounded presentation", box);
    check(
      (await chip.getAttribute("title")) === destination,
      "420 full destination remains accessible",
    );
    await page.getByRole("button", { name: "Budget", exact: true }).click();
    check(
      await page.getByRole("dialog", { name: "Budget", exact: true }).isVisible(),
      "420 Budget is reachable after long destination",
    );
  }
  if (issue === "430") {
    let release;
    let arrived;
    let ready = new Promise((resolve) => {
      arrived = resolve;
    });
    await page.route("**/api/chat", async (route) => {
      arrived();
      await new Promise((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fixture unavailable" }),
      });
    });
    const input = page.getByRole("textbox", { name: "Message AI Trip Planner" });
    await input.fill("hello");
    await input.press("Enter");
    await ready;
    check((await input.inputValue()) === "", "430 accepted message clears during pending turn", {
      value: await input.inputValue(),
    });
    release();
    await input.waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector(".composer__input").disabled);
    check((await input.inputValue()) === "hello", "430 failed send restores retry draft", {
      value: await input.inputValue(),
    });
    ready = new Promise((resolve) => {
      arrived = resolve;
    });
    await page.getByRole("button", { name: "Retry update", exact: true }).click();
    await ready;
    check((await input.inputValue()) === "", "430 retry clears restored draft while pending");
    release();
    await page.waitForFunction(() => !document.querySelector(".composer__input").disabled);
    check((await input.inputValue()) === "hello", "430 repeated failure retains retry draft");
  }
  await page.screenshot({ path: `${out}/${issue}.png`, fullPage: true });
} catch (error) {
  check(false, "journey completed", { error: String(error) });
} finally {
  await context.tracing.stop({ path: `${out}/${issue}-trace.zip` });
  writeFileSync(`${out}/${issue}.json`, JSON.stringify({ issue, checks }, null, 2));
  await browser.close();
}
process.exitCode = checks.some((check) => !check.ok) ? 1 : 0;
