import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const out = resolve(
  process.cwd(),
  `output/playwright/triage-accessibility/${process.env.LABEL ?? "run"}`,
);
mkdirSync(out, { recursive: true });
const results = [];
const check = (ok, message) => {
  results.push({ ok: Boolean(ok), message });
  console.log(`${ok ? "ok" : "FAIL"} ${message}`);
};
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {}),
});
try {
  for (const width of [1280, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 812 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await context.tracing.start({ screenshots: true, snapshots: true });
    await page.route("**/api/places/search*", (route) => route.fulfill({ json: { places: [] } }));
    await page.goto(process.env.BASE_URL ?? "http://localhost:3000", {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".workspace-app").waitFor();
    if (width === 375)
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Mine/ }).click();
    else
      await page
        .locator(".sidebar-nav")
        .getByRole("button", { name: /^Chats/ })
        .click();
    const search = page.getByRole("searchbox", { name: "Search chats and trips" });
    await search.fill("zzzqq");
    await page.getByText("No matching chats.", { exact: true }).waitFor();
    check(
      (await page.getByRole("status").filter({ hasText: "No matching chats." }).count()) > 0,
      `${width}: search emptiness has polite status`,
    );
    check(
      (await page.getByRole("status").filter({ hasText: "No matching trips." }).count()) > 0,
      `${width}: trip search emptiness has polite status`,
    );
    await page.screenshot({ path: `${out}/${width}-search.png` });
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    check(
      (await page.getByRole("status").filter({ hasText: "No matching chats." }).count()) === 0,
      `${width}: clear removes stale search status`,
    );
    if (width === 375) {
      await page.locator(".phone-tabbar").getByRole("tab", { name: /^Map/ }).click();
      const handle = page.locator(".phone-map-sheet__handle");
      const visible = (await handle.innerText()).trim();
      const name = (await handle.getAttribute("aria-label")) ?? visible;
      check(
        name.toLowerCase().includes(visible.toLowerCase()),
        "421: map accessible name contains visible label ignoring case",
      );
      await handle.press("Home");
      check(
        (await handle.getAttribute("aria-expanded")) === "false",
        "421: Home collapses map sheet",
      );
      await handle.press("End");
      check((await handle.getAttribute("aria-expanded")) === "true", "421: End expands map sheet");
      writeFileSync(`${out}/map-name.json`, JSON.stringify({ visible, name }, null, 2));
    } else {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Who", exact: true }).click();
      let sheet = page.getByRole("dialog", { name: "Who", exact: true });
      await sheet.getByRole("button", { name: "Add a pet", exact: true }).click();
      await sheet.getByRole("button", { name: "Save", exact: true }).click();
      const error = sheet.locator("#fact-groupSize-error");
      await error.waitFor();
      check(
        (await error.innerText()) === "Enter a whole number of travellers, 1 or more.",
        "431: exact pets-only validation reproduced",
      );
      check(
        await error.evaluate(
          (e) =>
            !!e.closest(
              '[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]',
            ),
        ),
        "431: Who error has live semantics",
      );
      check(
        (
          (await sheet
            .getByRole("button", { name: "Add an adult", exact: true })
            .getAttribute("aria-describedby")) ?? ""
        ).includes("fact-groupSize-error"),
        "431: stepper references error",
      );
      await sheet.screenshot({ path: `${out}/who.png` });
      await sheet.getByRole("button", { name: "Add an adult", exact: true }).click();
      await sheet.getByRole("button", { name: "Save", exact: true }).click();
      await sheet.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: /^Budget/ }).click();
      sheet = page.getByRole("dialog", { name: /^Budget/ });
      const input = sheet.locator("#fact-budgetTotal");
      await input.fill("1000001");
      await sheet.getByRole("button", { name: "Save", exact: true }).click();
      const budgetError = sheet.locator("#fact-budgetTotal-error");
      await budgetError.waitFor();
      check(
        (await budgetError.innerText()).includes("1,000,000 or less"),
        "434: exact over-limit validation reproduced",
      );
      check(
        await budgetError.evaluate(
          (e) =>
            !!e.closest(
              '[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]',
            ),
        ),
        "434: Budget error has live semantics",
      );
      check(
        ((await input.getAttribute("aria-describedby")) ?? "").includes("fact-budgetTotal-error") &&
          (await input.getAttribute("aria-invalid")) === "true",
        "434: budget retains invalid state and error reference",
      );
      await sheet.screenshot({ path: `${out}/budget.png` });
      await input.fill("3000");
      await sheet.getByRole("button", { name: "Save", exact: true }).click();
      await sheet.waitFor({ state: "hidden" });
    }
    await context.tracing.stop({ path: `${out}/${width}-trace.zip` });
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
}
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
