import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(viteRequire.resolve("vite")).href);
const { chromium } = require("playwright");
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = resolve(web, "tests/e2e/fixtures/account-revisions");
const output = resolve(web, "output/playwright/account-revisions");
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
      { find: "@", replacement: web },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
});
await server.listen();
const browser = await chromium.launch({ channel: process.env.CHANNEL });
const traces = [];
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => {
      errors.push(String(error));
      console.error(error);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) console.error(response.status(), response.url());
    });
    page.on("console", (message) => {
      if (message.type() === "error") console.error(message.text());
    });
    const records = { trips: new Map(), conversations: new Map() };
    let settings = null;
    let settingsRevision = 0;
    let release;
    let held = false;
    await page.route("**/api/account/sync", async (route) => {
      const request = route.request();
      if (request.method() === "GET")
        return route.fulfill({
          json: Object.fromEntries(
            Object.entries(records).map(([kind, map]) => [kind, [...map.values()]]),
          ),
        });
      const changes = request.postDataJSON();
      traces.push({ viewport, changes });
      if (changes.trips.some((item) => item.record?.title === "First edit")) {
        held = true;
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      const result = {
        accepted: { trips: [], conversations: [] },
        conflicts: { trips: [], conversations: [] },
      };
      for (const kind of ["trips", "conversations"])
        for (const item of changes[kind]) {
          const current = records[kind].get(item.id);
          if (item.record?.title === "Rejected edit" || (current?.revision ?? 0) !== item.revision)
            result.conflicts[kind].push(item);
          else {
            const saved = { ...item, revision: item.revision + 1 };
            records[kind].set(item.id, saved);
            result.accepted[kind].push(saved);
          }
        }
      await route.fulfill({ json: result });
    });
    await page.route("**/api/account/settings", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { settings, revision: settingsRevision } });
      const body = route.request().postDataJSON();
      if (body.revision !== settingsRevision)
        return route.fulfill({ status: 409, json: { conflict: true } });
      settings = body.settings;
      settingsRevision += 1;
      await route.fulfill({ json: { settings, revision: settingsRevision } });
    });
    const waitStatus = (name, value) =>
      page
        .getByRole("status", { name })
        .filter({ hasText: new RegExp(`^${value}$`) })
        .waitFor();
    await page.goto(
      `${server.resolvedUrls.local[0]}tests/e2e/fixtures/account-revisions/index.html`,
    );
    await waitStatus("Catalog sync", "synced").catch(async (error) => {
      console.error(await page.locator("body").innerText());
      throw error;
    });
    await waitStatus("Settings sync", "synced");
    await page.getByRole("button", { name: "First edit", exact: true }).click();
    while (!held) await page.waitForTimeout(50);
    await page.getByRole("button", { name: "Second edit", exact: true }).click();
    await page.waitForTimeout(1800);
    assert.equal(
      traces.filter(
        (trace) =>
          trace.viewport === viewport &&
          trace.changes.trips.some((item) => item.record?.title === "Second edit"),
      ).length,
      0,
    );
    release();
    await waitStatus("Catalog sync", "synced");
    const saved = [...records.trips.values()][0];
    assert.equal(saved.revision, 3);
    assert.equal(saved.record.title, "Second edit");
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.waitForTimeout(1800);
    await waitStatus("Settings sync", "synced");
    assert.equal(settings.appearance, "light");
    await page.getByRole("button", { name: "Rejected edit", exact: true }).click();
    await waitStatus("Catalog sync", "offline");
    await page.reload();
    await waitStatus("Catalog sync", "offline");
    assert.equal(await page.getByText("Trip: Rejected edit", { exact: true }).count(), 1);
    const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem("trip.sync.v1")));
    assert.equal(checkpoint.synced.trips[saved.id].revision, 3);
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: resolve(output, `${viewport.width}-pending.png`),
      fullPage: true,
    });
    await context.close();
  }
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        passed: true,
        boundaries:
          "production React sync clients; fixture identity and HTTP server; no live Clerk/Neon",
        browser: browser.version(),
        traces,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS desktop and phone: serialized edits, settings, rejected edit survives reload. Artifacts: ${output}`,
  );
} finally {
  await browser.close();
  await server.close();
}
