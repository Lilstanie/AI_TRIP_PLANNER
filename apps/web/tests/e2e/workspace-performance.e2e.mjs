import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const label = process.env.LABEL ?? "after";
const out = resolve(
  process.env.E2E_OUTPUT_DIR ?? `output/playwright/workspace-performance/${label}`,
);
mkdirSync(out, { recursive: true });
const key = JSON.parse(
  readFileSync(new URL("../../lib/workspace/catalog.ts", import.meta.url), "utf8").match(
    /export const CATALOG_KEY = ("[^"]+")/,
  )[1],
);
const results = [];
const browser = await chromium.launch({ headless: true });

function catalog(size) {
  return {
    version: 4,
    activeConversationId: "conversation:performance",
    conversations: [
      {
        id: "conversation:performance",
        title: "Performance fixture",
        updatedAt: "2026-10-11T00:00:00Z",
        input: "",
        messages: Array.from({ length: size }, (_, i) => ({
          role: i % 2 ? "agent" : "user",
          text:
            i % 2
              ? `## Route ${i}\n\nA **synthetic** travel answer with [details](https://example.invalid).\n\n- Museum\n- Garden\n\n\`\`\`text\nlocal fixture\n\`\`\``
              : `Question ${i}`,
          at: 1791676800000 + i * 1000,
        })),
      },
    ],
    trips: [],
    layout: {
      sidebar: { collapsed: false },
      preferences: { width: 280 },
      trip: { width: 340 },
      view: "chat",
      editorView: "map",
    },
  };
}

async function settle(page) {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

async function run(size, viewport) {
  const context = await browser.newContext({ viewport, locale: "en-AU", reducedMotion: "reduce" });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === new URL(base).origin ? route.continue() : route.abort();
  });
  await context.addInitScript(
    ({ key, seed }) => {
      if (!sessionStorage.getItem("performance-seeded")) {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify(seed));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({ language: "en", dataMode: "mock" }),
        );
        sessionStorage.setItem("performance-seeded", "true");
      }
      const original = Storage.prototype.setItem;
      window.__workspaceWrites = [];
      window.__failCatalog = false;
      Storage.prototype.setItem = function (name, value) {
        const start = performance.now();
        if (this === localStorage && name === key && window.__failCatalog)
          throw new DOMException("Synthetic quota", "QuotaExceededError");
        const result = original.call(this, name, value);
        if (this === localStorage && name === key)
          window.__workspaceWrites.push({
            bytes: value.length,
            durationMs: performance.now() - start,
          });
        return result;
      };
    },
    { key, seed: catalog(size) },
  );
  const client = await context.newCDPSession(page);
  await client.send("Profiler.enable");
  await client.send("Debugger.enable");
  await client.send("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
  try {
    await page.goto(base);
    const input = page.locator(".composer textarea");
    await input.waitFor();
    await page.waitForFunction(
      ({ key, size }) => {
        const value = JSON.parse(localStorage.getItem(key) ?? "null");
        return (
          value?.conversations[0]?.messages.length === size &&
          value.conversations[0].updatedAt !== "2026-10-11T00:00:00Z" &&
          window.__workspaceWrites.length > 0
        );
      },
      { key, size },
    );
    await settle(page);
    const initial = await client.send("Profiler.takePreciseCoverage");
    let target;
    for (const script of initial.result.filter(
      (script) => script.url.startsWith(base) && script.url.includes("/_next/"),
    )) {
      const { scriptSource } = await client.send("Debugger.getScriptSource", {
        scriptId: script.scriptId,
      });
      const marker = scriptSource.indexOf('"msg-item--agent"');
      const alternate = scriptSource.indexOf('"msg-item msg-item--agent"');
      const position = marker >= 0 ? marker : alternate;
      if (position < 0) continue;
      const candidates = script.functions.filter(
        (fn) => fn.ranges[0].startOffset <= position && fn.ranges[0].endOffset > position,
      );
      candidates.sort(
        (a, b) =>
          a.ranges[0].endOffset -
          a.ranges[0].startOffset -
          (b.ranges[0].endOffset - b.ranges[0].startOffset),
      );
      if (candidates[0])
        target = {
          url: script.url,
          functionName: candidates[0].functionName,
          ...candidates[0].ranges[0],
        };
    }
    assert.ok(
      target,
      "Production MessageItem function coverage is available; absent metrics must not pass",
    );
    await page.evaluate(() => {
      window.__workspaceWrites = [];
    });
    await client.send("Profiler.takePreciseCoverage");
    await client.send("Profiler.start");
    const start = performance.now();
    await input.fill("performance draft");
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).conversations[0].input === "performance draft",
      key,
    );
    await settle(page);
    const typed = await client.send("Profiler.takePreciseCoverage");
    const functionCalls = typed.result
      .find((script) => script.url === target.url)
      ?.functions.find((fn) => fn.ranges[0].startOffset === target.startOffset)?.ranges[0].count;
    assert.notEqual(functionCalls, undefined, "Measured production function remains identifiable");
    const writes = await page.evaluate(() => window.__workspaceWrites);
    if (!label.startsWith("before"))
      assert.equal(writes.length, 1, "One settled input save writes catalog once");
    const entry = {
      size,
      viewport,
      typingAndSaveMs: performance.now() - start,
      historicalMessageFunctionCalls: functionCalls,
      target,
      catalogWrites: writes,
    };
    results.push(entry);
    await page.screenshot({ path: resolve(out, `${size}-${viewport.width}.png`) });
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body:
          [
            {
              type: "coordinator",
              phase: "dispatch",
              round: 1,
              summary: "Synthetic stream progress.",
            },
            { type: "error", message: "Synthetic end of stream." },
          ]
            .map((frame) => JSON.stringify(frame))
            .join("\n") + "\n",
      }),
    );
    await client.send("Profiler.takePreciseCoverage");
    await input.press("Enter");
    await page.getByRole("button", { name: "Retry update", exact: true }).waitFor();
    await settle(page);
    const streamed = await client.send("Profiler.takePreciseCoverage");
    entry.streamMessageFunctionCalls = streamed.result
      .find((script) => script.url === target.url)
      ?.functions.find((fn) => fn.ranges[0].startOffset === target.startOffset)?.ranges[0].count;
    assert.notEqual(
      entry.streamMessageFunctionCalls,
      undefined,
      "Stream rendering coverage is available",
    );
    const { profile } = await client.send("Profiler.stop");
    writeFileSync(resolve(out, `${size}-${viewport.width}.cpuprofile`), JSON.stringify(profile));
    await input.fill("performance draft");
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key)).conversations[0].input === "performance draft",
      key,
    );
    await page.reload();
    await input.waitFor();
    assert.equal(await input.inputValue(), "performance draft", "Input and history survive reload");
    await page.evaluate(() => {
      window.__failCatalog = true;
    });
    await input.fill("quota failure draft");
    await page
      .getByRole("alert")
      .filter({ hasText: "Browser storage is unavailable or full." })
      .waitFor();
    assert.notEqual(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).conversations[0].input,
        key,
      ),
      "quota failure draft",
    );
    await page.evaluate(() => {
      window.__failCatalog = false;
    });
    await page
      .getByRole("button", { name: "Retry / replace workspace storage", exact: true })
      .click();
    await page.waitForFunction(
      (key) =>
        JSON.parse(localStorage.getItem(key)).conversations[0].input === "quota failure draft",
      key,
    );
    if (viewport.width > 1000) {
      await page
        .getByRole("button", { name: /^Chats\b/ })
        .first()
        .click();
      await page.getByRole("button", { name: "New chat", exact: true }).waitFor();
      await page.clock.install();
      await input.fill("flushed before switching");
      await page.clock.runFor(50);
      await page.getByRole("button", { name: "New chat", exact: true }).click();
      assert.equal(
        await page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key)).conversations.find(
              (c) => c.id === "conversation:performance",
            ).input,
          key,
        ),
        "flushed before switching",
        "Conversation switch flushes pending input before debounce",
      );
      await page.clock.runFor(400);
      await page
        .getByRole("button", { name: /^Chats\b/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Actions for Performance fixture", exact: true })
        .click();
      await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
      const renameDialog = page.getByRole("dialog", { name: "Rename chat" });
      await renameDialog.getByRole("textbox").fill("Renamed performance fixture");
      await renameDialog.getByRole("button", { name: "Save", exact: true }).click();
      await page.waitForFunction(
        (key) =>
          JSON.parse(localStorage.getItem(key)).conversations.some(
            (c) => c.title === "Renamed performance fixture",
          ),
        key,
      );
    } else {
      await page.getByRole("tab", { name: "Mine", exact: true }).click();
      await page.waitForFunction(
        (key) => JSON.parse(localStorage.getItem(key)).layout.view === "mine",
        key,
      );
    }
    assert.deepEqual(errors, [], "No browser exceptions");
    entry.outcome = "passed";
  } finally {
    await context.tracing.stop({ path: resolve(out, `${size}-${viewport.width}.trace.zip`) });
    await context.close();
  }
}

async function runPlannedStorage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    locale: "en-AU",
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const entry = { scenario: "planned-storage-and-stale-tab", outcome: "running" };
  results.push(entry);
  const seed = catalog(10);
  const draft = {
    destination: "Tokyo",
    start: "2030-10-01",
    end: "2030-10-02",
    groupSize: "2",
    budgetTotal: "2000",
    nationality: "",
    minRating: "0",
    roomAllocation: "shared",
    freeCancellation: false,
    preferences: [],
  };
  const plan = {
    tripId: "performance-trip",
    brief: {
      tripId: "performance-trip",
      destination: "Tokyo",
      dates: [draft.start, draft.end],
      groupSize: 2,
      budgetTotal: 2000,
    },
    round: 0,
    budgetTotal: 2000,
    estTotal: 0,
    overrunPct: -100,
    sections: [],
  };
  const snapshot = {
    version: 4,
    id: "performance",
    savedAt: "2026-10-11T00:00:00Z",
    draft,
    plan,
    messages: seed.conversations[0].messages,
    input: "",
  };
  seed.conversations[0].snapshot = snapshot;
  seed.conversations[0].tripId = "trip:performance-trip";
  seed.trips = [
    {
      id: "trip:performance-trip",
      title: "Tokyo",
      updatedAt: snapshot.savedAt,
      conversationIds: [seed.conversations[0].id],
      snapshot,
    },
  ];
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort(),
  );
  await context.route("**/api/places/**", (route) => route.fulfill({ json: { places: [] } }));
  await context.addInitScript(
    ({ key, seed }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(seed));
        localStorage.setItem(
          "trip.settings.v1",
          JSON.stringify({ language: "en", dataMode: "mock" }),
        );
      }
      const original = Storage.prototype.setItem;
      window.__plannedWrites = [];
      Storage.prototype.setItem = function (name, value) {
        const result = original.call(this, name, value);
        if (this === localStorage && (name === key || name === "trip-workspace-v1"))
          window.__plannedWrites.push(name === key ? "catalog" : "mirror");
        return result;
      };
    },
    { key, seed },
  );
  try {
    await page.goto(base);
    await page.getByRole("tab", { name: "Mine", exact: true }).click();
    await page
      .getByRole("region", { name: "Chats", exact: true })
      .getByRole("button", { name: /^Performance fixture/ })
      .click();
    await page.getByRole("tab", { name: "Chat", exact: true }).click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1") ?? "null")?.plan.tripId ===
        "performance-trip",
    );
    await settle(page);
    await page.evaluate(() => {
      window.__plannedWrites = [];
    });
    const input = page.locator(".composer textarea");
    await input.fill("planned draft saved once");
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("trip-workspace-v1")).input === "planned draft saved once",
    );
    await settle(page);
    const saved = await page.evaluate(
      (key) => ({
        writes: window.__plannedWrites,
        catalog: JSON.parse(localStorage.getItem(key)),
        mirror: JSON.parse(localStorage.getItem("trip-workspace-v1")),
      }),
      key,
    );
    assert.deepEqual(
      saved.writes,
      ["mirror", "catalog"],
      "Planned autosave retains one mirror and one catalog write",
    );
    assert.equal(
      saved.catalog.conversations.find((c) => c.id === "conversation:performance").snapshot.input,
      saved.mirror.input,
    );
    assert.equal(saved.catalog.trips[0].snapshot.input, saved.mirror.input);
    entry.writes = saved.writes;

    const writer = await context.newPage();
    await writer.goto(base);
    await writer.getByRole("tab", { name: "Chat", exact: true }).waitFor();
    await writer.clock.install();
    await writer.clock.runFor(500);
    await page.clock.install();
    await page.clock.runFor(500);
    const canonical = await writer.evaluate((key) => {
      const mirror = JSON.parse(localStorage.getItem("trip-workspace-v1"));
      mirror.plan = { ...mirror.plan, round: mirror.plan.round + 1 };
      mirror.input = "canonical second-tab draft";
      const catalog = JSON.parse(localStorage.getItem(key));
      catalog.conversations.find((c) => c.id === "conversation:performance").snapshot = mirror;
      catalog.trips[0].snapshot = mirror;
      localStorage.setItem(`trip.revision:${mirror.plan.tripId}`, JSON.stringify(mirror.plan));
      localStorage.setItem("trip-workspace-v1", JSON.stringify(mirror));
      localStorage.setItem(key, JSON.stringify(catalog));
      return {
        mirror: localStorage.getItem("trip-workspace-v1"),
        catalog: localStorage.getItem(key),
      };
    }, key);
    await page.evaluate(() => {
      window.__plannedWrites = [];
    });
    await input.fill("stale tab draft must stay local");
    await page.clock.runFor(500);
    assert.deepEqual(
      await page.evaluate(() => window.__plannedWrites),
      [],
      "Stale autosave makes no storage writes",
    );
    await page.getByRole("tab", { name: "Mine", exact: true }).click();
    await page.clock.runFor(500);
    assert.deepEqual(
      await page.evaluate(
        (key) => ({
          mirror: localStorage.getItem("trip-workspace-v1"),
          catalog: localStorage.getItem(key),
        }),
        key,
      ),
      canonical,
      "Stale catalog-only effects cannot overwrite the current tab's data",
    );
    entry.staleTabPreserved = true;
    await page.screenshot({
      path: resolve(out, "planned-storage-stale-tab.png"),
      animations: "disabled",
    });
    entry.outcome = "passed";
  } catch (error) {
    entry.outcome = "failed";
    entry.error = String(error);
    await page.screenshot({
      path: resolve(out, "planned-storage-failure.png"),
      animations: "disabled",
    });
    throw error;
  } finally {
    await context.tracing.stop({ path: resolve(out, "planned-storage.trace.zip") });
    await context.close();
  }
}

try {
  await run(10, { width: 1440, height: 1000 });
  await run(200, { width: 1440, height: 1000 });
  await run(200, { width: 390, height: 844 });
  if (!label.startsWith("before")) await runPlannedStorage();
} finally {
  writeFileSync(
    resolve(out, "summary.json"),
    `${JSON.stringify({ label, base, results }, null, 2)}\n`,
  );
  await browser.close();
}
console.log(JSON.stringify({ outcome: "passed", evidence: out, results }, null, 2));
