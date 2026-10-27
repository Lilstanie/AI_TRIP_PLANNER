import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = resolve(web, "tests/e2e/fixtures/memory-settings");
const output = resolve(web, "output/playwright/memory-settings");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: web,
  server: { host: "127.0.0.1", port: 0, fs: { allow: [resolve(web, "../..")] } },
  resolve: {
    alias: [
      {
        find: /^(?:@\/components\/account\/AccountProvider|\.\/AccountProvider)$/,
        replacement: resolve(fixture, "account.ts"),
      },
      {
        find: /^(?:@\/lib\/db\/(?:client|memory-transaction)|\.\.\/db\/(?:client|memory-transaction)|@\/lib\/auth\/config|\.\.\/auth\/config|@clerk\/nextjs\/server)$/,
        replacement: resolve(web, "tests/e2e/fixtures/memory-server/runtime.mjs"),
      },
      { find: "@", replacement: web },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
});
await server.listen();
const memoryFixture = await server.ssrLoadModule("/tests/e2e/fixtures/memory-server/runtime.mjs");
const memoryStore = await server.ssrLoadModule("/lib/account/memory.ts");
const memoryRoute = await server.ssrLoadModule("/app/api/account/memory/route.ts");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 1000, tag: "desktop" },
    { width: 390, height: 844, tag: "phone" },
  ]) {
    for (const locale of ["en", "zh"]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      await context.tracing.start({ screenshots: true, snapshots: true });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.text().includes("server responded with a status of 503")
        )
          errors.push(message.text());
      });
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          !(response.url().endsWith("/api/account/memory") && response.status() === 503)
        )
          errors.push(`${response.status()} ${response.url()}`);
      });
      const settings = {
        version: 1,
        travel: { homeCity: "", preferences: [], interests: [], dietary: [] },
        memberships: [],
        assistant: { style: "neutral", memory: false },
        dataMode: "default",
        appearance: "system",
        displayCurrency: "AUD",
        language: locale,
        updatedAt: "2026-10-19T00:00:00.000Z",
      };
      await page.addInitScript((value) => {
        localStorage.setItem("trip.settings.v1", JSON.stringify(value));
      }, settings);
      const memories = new Map([
        ["dietary", "Vegetarian"],
        ["pace", "Relaxed"],
      ]);
      let failMemoryRead = true;
      const memoryDb = {
        select() {
          return {
            from() {
              return {
                where: async () => {
                  if (failMemoryRead) throw new Error("simulated account memory read failure");
                  return [...memories].map(([key, value]) => ({ key, value }));
                },
              };
            },
          };
        },
      };
      memoryFixture.configureMemoryFixture(memoryDb, "memory-settings-user");
      let expectedReadFailures = 0;
      assert.deepEqual(
        await memoryStore.accountMemoryStore("memory-settings-user", true).getLongTerm(),
        [],
        "planner memory reads should fail open when the account-memory database read fails",
      );
      await page.route("**/api/account/settings", async (route) => {
        if (route.request().method() === "GET")
          return route.fulfill({ json: { settings, revision: 0 } });
        const body = route.request().postDataJSON();
        Object.assign(settings, body.settings);
        return route.fulfill({ json: { settings, revision: 1 } });
      });
      await page.route("**/api/account/memory", async (route) => {
        if (route.request().method() === "GET") {
          memoryFixture.configureMemoryFixture(memoryDb, "memory-settings-user");
          const response = await memoryRoute.GET();
          const body = await response.json();
          if (failMemoryRead) {
            expectedReadFailures += 1;
            assert.equal(response.status, 503);
            assert.equal(body.notice?.key, "Could not load remembered preferences.");
          }
          return route.fulfill({ status: response.status, json: body });
        }
        if (route.request().method() === "DELETE") {
          const { key } = route.request().postDataJSON();
          const deleted = memories.delete(key);
          return route.fulfill({ json: { deleted } });
        }
        return route.fallback();
      });
      await page.goto(
        `${server.resolvedUrls.local[0]}tests/e2e/fixtures/memory-settings/index.html`,
      );
      const dialog = page.getByRole("dialog", { name: "Settings" });
      const loadFailure =
        locale === "zh" ? "无法加载已记住的偏好。" : "Could not load remembered preferences.";
      await dialog.getByRole("alert").getByText(loadFailure, { exact: true }).waitFor();
      assert.ok(expectedReadFailures >= 1, "the initial Settings memory read should fail");
      failMemoryRead = false;
      await dialog.getByRole("button", { name: /Retry|重试/ }).click();
      const expectedLabel = locale === "zh" ? "饮食需求" : "Dietary needs";
      await dialog.getByText(expectedLabel, { exact: true }).waitFor();
      const memorySwitch = dialog.getByRole("switch", { name: /long-term memory|长期记忆/i });
      await page.screenshot({
        path: resolve(output, `${viewport.tag}-${locale}-remembered.png`),
        fullPage: true,
      });
      await memorySwitch.click();
      assert.equal(await memorySwitch.getAttribute("aria-checked"), "true");
      const memoryRows = dialog.locator(
        'section[aria-labelledby="settings-long-term-memory"] .memory-list .memory-row',
      );
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/account/memory") &&
          response.request().method() === "DELETE",
      );
      await dialog
        .getByRole("button", { name: /delete memory|删除记忆/i })
        .first()
        .click();
      assert.equal((await deleteResponse).ok(), true);
      await page.waitForFunction(
        () =>
          document.querySelectorAll(
            'section[aria-labelledby="settings-long-term-memory"] .memory-list .memory-row',
          ).length === 1,
        undefined,
        { timeout: 10000 },
      );
      assert.equal(memories.size, 1);
      assert.equal(await memoryRows.count(), 1);
      await page.getByRole("button", { name: "Sign out fixture account" }).click();
      await dialog
        .getByText(locale === "zh" ? "目前还没有记住任何偏好。" : "Nothing is remembered yet.", {
          exact: true,
        })
        .waitFor();
      assert.equal(await memoryRows.count(), 0);
      assert.equal(await memorySwitch.isDisabled(), true);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      const tag = `${viewport.tag}-${locale}`;
      await page.screenshot({ path: resolve(output, `${tag}.png`), fullPage: true });
      results.push({ viewport: viewport.tag, locale, passed: true });
      await context.tracing.stop({ path: resolve(output, `${tag}-trace.zip`) });
      await context.close();
    }
  }
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        coverage:
          "SettingsDialog, production memory GET with failing/recovering database fixture; mocked settings/delete APIs; planner read fallback, retry/list/delete/toggle/sign-out",
        browser: browser.version(),
        results,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: signed-in memory settings desktop and phone in English and Chinese. Artifacts: ${output}`,
  );
} finally {
  await browser.close();
  await server.close();
}
