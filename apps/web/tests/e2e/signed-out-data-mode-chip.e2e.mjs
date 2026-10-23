import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { openMockWorkspace, settle } from "./trip-setup.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve("output/playwright/signed-out-data-mode-chip");
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, name, detail) => {
  results.push({ ok: Boolean(ok), name, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
};
const browser = await chromium.launch({ channel: process.env.CHANNEL });
try {
  for (const signedOut of [true, false]) {
    const label = signedOut ? "signed out" : "live available";
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    if (signedOut)
      await page.route("**/api/data-mode", async (route) => {
        const response = await route.fetch();
        if (route.request().method() !== "GET") return route.fulfill({ response });
        route.fulfill({ response, json: { ...(await response.json()), liveAvailable: false } });
      });
    await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
    const chip = page.locator("button.data-mode");
    await chip.waitFor();
    const state = await chip.evaluate((button) => {
      button.focus();
      return {
        disabled: button.disabled,
        ariaDisabled: button.getAttribute("aria-disabled"),
        focused: document.activeElement === button,
        text: button.textContent.trim(),
      };
    });
    if (signedOut) {
      check(
        !state.disabled && state.ariaDisabled === "true" && state.focused,
        `${label}: chip is aria-disabled and still reachable by keyboard`,
        state,
      );
      check(
        state.text.includes("Sign in to plan with live hotel and flight prices") &&
          !state.text.includes("Activate"),
        `${label}: hidden text gives the sign-in reason and no activate instruction`,
        state.text,
      );
      await page.keyboard.press("Enter");
      await chip.click({ force: true });
      await settle(page, 600);
      check(
        (await chip.getAttribute("aria-pressed")) === "false" &&
          (await chip.innerText()).includes("Mock data"),
        `${label}: Enter and click leave the chip on mock data`,
      );
      await page.screenshot({ path: `${out}/signed-out-topbar.png` });
    } else {
      check(
        !state.disabled && state.ariaDisabled === null && state.focused,
        `${label}: chip is enabled and focusable`,
        state,
      );
      check(
        state.text.includes("Activate to switch to live provider data"),
        `${label}: hidden text keeps the activate instruction`,
        state.text,
      );
    }
    check(errors.length === 0, `${label}: no page errors`, errors);
    await context.close();
  }
} catch (error) {
  check(false, String(error));
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
}
if (results.some((x) => !x.ok)) process.exit(1);
