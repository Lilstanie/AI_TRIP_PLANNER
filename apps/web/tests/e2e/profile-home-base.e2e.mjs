import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace } from "./trip-setup.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/profile-home-base", process.env.EVIDENCE_LABEL ?? "after");
mkdirSync(out, { recursive: true });
const checks = [];
const check = (ok, name, detail) => {
  checks.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, locale: "en-AU" });
  const sent = [];
  await page.route("**/api/chat", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, json: { error: "Fixture unavailable" } });
  });
  await openMockWorkspace(page, base);
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "View profile" }).click();
  const dialog = page.getByRole("dialog");
  const location = dialog.getByRole("textbox", { name: /^Location/ });
  await location.fill("Perth, Australia");
  await location.press("Enter");
  await dialog.getByText("Saved.").waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /^Where/ })
    .first()
    .click();
  const live = await page.locator("#fact-origin").inputValue();
  check(live === "Perth, Australia", "the open blank chat picks up the saved location", live);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator(".workspace-app").waitFor();
  await page
    .getByRole("button", { name: /^Where/ })
    .first()
    .click();
  const restored = await page.locator("#fact-origin").inputValue();
  check(
    restored === "Perth, Australia",
    "the restored blank chat starts from the profile location",
    restored,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Chats/ }).click();
  await page
    .locator(".sidebar-nav, .chats-panel__section-head")
    .getByRole("button", { name: "New chat" })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /^Where/ })
    .first()
    .click();
  const origin = await page.locator("#fact-origin").inputValue();
  check(
    origin === "Perth, Australia",
    "New chat Where editor starts from the profile location",
    origin,
  );
  await page.screenshot({ path: `${out}/where.png` });
  await page.keyboard.press("Escape");
  await page
    .locator(".composer textarea")
    .fill("Plan 3 days in Hobart from 10 Mar 2027 for 2 adults, budget 2500 AUD");
  await page.locator(".composer textarea").press("Enter");
  await page.locator(".error-banner").waitFor();
  const known = sent.at(-1)?.known ?? sent.at(-1)?.brief;
  check(
    known?.origin === "Perth, Australia",
    "the chat request carries the profile location as origin",
    known,
  );
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "View profile" }).click();
  const again = page.getByRole("dialog").getByRole("textbox", { name: /^Location/ });
  await again.fill("Adelaide, Australia");
  await again.press("Enter");
  await page.getByRole("dialog").getByText("Saved.").waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /^Where/ })
    .first()
    .click();
  const kept = await page.locator("#fact-origin").inputValue();
  check(kept === "Perth, Australia", "a chat that has started keeps its own origin", kept);
} catch (error) {
  check(false, "journey completed", String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(checks, null, 2));
}
if (checks.some(({ ok }) => !ok)) process.exit(1);
