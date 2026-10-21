import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const { PGlite } = require("@electric-sql/pglite");
const { drizzle } = require("drizzle-orm/pglite");
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const output = resolve(root, "apps/web/output/playwright/accommodation-memory");
await mkdir(output, { recursive: true });
const viteRequire = createRequire(require.resolve("vitest/node"));
const { createServer } = await import(viteRequire.resolve("vite"));
const runtime = await createServer({
  root,
  configFile: false,
  resolve: {
    alias: [
      {
        find: /^(?:@\/lib\/db\/client|\.\.\/db\/client|@\/lib\/auth\/config|\.\.\/auth\/config|@clerk\/nextjs\/server)$/,
        replacement: resolve(root, "apps/web/tests/e2e/fixtures/memory-server/runtime.mjs"),
      },
      { find: "@", replacement: resolve(root, "apps/web") },
    ],
  },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
const db = new PGlite();
for (const migration of [
  "0000_fantastic_doomsday.sql",
  "0001_ambitious_micromacro.sql",
  "0002_adorable_namor.sql",
])
  await db.exec(await readFile(resolve(root, "apps/web/drizzle", migration), "utf8"));
const schema = await runtime.ssrLoadModule("/apps/web/lib/db/schema.ts");
const fixture = await runtime.ssrLoadModule(
  "/apps/web/tests/e2e/fixtures/memory-server/runtime.mjs",
);
const database = drizzle(db, { schema });
const agents = await runtime.ssrLoadModule("/packages/agents/src/index.ts");
const chat = await runtime.ssrLoadModule("/apps/web/app/api/chat/route.ts");
const undo = await runtime.ssrLoadModule("/apps/web/app/api/account/memory/undo/route.ts");
const { readPreferences } = await runtime.ssrLoadModule(
  "/packages/agents/src/accommodation/planning.ts",
);
const account = "accommodation-memory-user";
const brief = {
  tripId: "accommodation-memory-e2e",
  userId: "spoofed-account",
  destination: "Melbourne",
  dates: ["2026-12-01", "2026-12-03"],
  groupSize: 2,
  budgetTotal: 10000,
};
let browser;
let phase = "browser-startup";
let observedRows = [];
let observedTokens = {};

function databaseThatChangesAfterSelect(database, change) {
  let changed = false;
  const racingDatabase = new Proxy(database, {
    get(target, property) {
      if (property === "select")
        return (...args) => {
          const wrapQuery = (query) =>
            new Proxy(query, {
              get(builder, member) {
                if (member === "then")
                  return (resolve, reject) =>
                    builder.then(async (selected) => {
                      if (!changed) {
                        changed = true;
                        await change();
                      }
                      return resolve(selected);
                    }, reject);
                const value = Reflect.get(builder, member, builder);
                return typeof value === "function"
                  ? (...methodArgs) => wrapQuery(value.apply(builder, methodArgs))
                  : value;
              },
            });
          return wrapQuery(target.select(...args));
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { database: racingDatabase, changed: () => changed };
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage();
  await page.route("http://memory.local/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Memory E2E</title>" }),
  );
  await page.route("**/api/chat", async (route) => {
    fixture.configureMemoryFixture(database, account);
    const request = route.request();
    const lines = await agents.runWithModelsDisabled(async () => {
      const response = await chat.POST(
        new Request(request.url(), {
          method: "POST",
          headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
          body: request.postData(),
        }),
      );
      return { status: response.status, body: await response.text() };
    });
    await route.fulfill({
      status: lines.status,
      contentType: "application/x-ndjson",
      body: lines.body,
    });
  });
  await page.goto("http://memory.local/");
  await page.setContent(`
    <form>
      <label>Message <input aria-label="Message" /></label>
      <button>Send</button>
      <output aria-live="polite"></output>
    </form>
    <script>
      document.querySelector("form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.querySelector("input").value;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tripId: ${JSON.stringify(brief.tripId)},
            message,
            mode: "plan",
            assistant: { style: "neutral", memory: true },
            interfaceLanguage: "en",
            displayCurrency: "AUD",
            brief: ${JSON.stringify(brief)},
          }),
        });
        const frames = (await response.text()).trim().split("\\n").map((line) => JSON.parse(line));
        document.querySelector("output").textContent = JSON.stringify(frames);
      });
    </script>
  `);
  const submit = async (message) => {
    await page.locator("output").evaluate((element) => {
      element.textContent = "";
    });
    await page.getByRole("textbox", { name: "Message" }).fill(message);
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForFunction(
      () => document.querySelector("output").textContent !== "",
      undefined,
      { timeout: 180_000 },
    );
    const frames = JSON.parse(await page.locator("output").textContent());
    const completed = frames.filter((frame) => frame.type === "complete");
    const change = completed.at(-1)?.response?.memoryChange;
    if (message === "I need a rating of at least 10")
      observedTokens.stream = completed.map((frame) => frame.response?.memoryChange?.token);
    if (!change) console.error(`No memory change for ${message}: ${JSON.stringify(frames)}`);
    assert.ok(change, `Expected a memory change for: ${message}`);
    return change;
  };
  const saved = async () =>
    (
      await db.query("SELECT key, value FROM account_memories WHERE user_id=$1 ORDER BY key", [
        account,
      ])
    ).rows;

  phase = "recognize-and-merge-three-accommodation-fields";
  const first = await submit("I prefer hotels");
  await submit("I need a rating of at least 8");
  await submit("I need free cancellation");
  let rows = await saved();
  observedRows = rows;
  assert.equal(rows.length, 1, "Accommodation preferences occupy one category row");
  assert.notEqual(
    rows[0].value,
    "free cancellation",
    "The latest statement overwrote earlier accommodation fields",
  );
  assert.deepEqual(JSON.parse(rows[0].value), {
    stayType: "hotel",
    minRating: 8,
    freeCancellation: true,
  });
  assert.deepEqual(
    readPreferences([{ key: "accommodation", value: rows[0].value, source: "chat_confirmed" }]),
    {
      roomAllocation: "shared",
      minRating: 8,
      freeCancellation: true,
      stayType: "hotel",
    },
  );

  const update = await submit("I need a rating of at least 10");
  rows = await saved();
  observedRows = rows;
  const undoState = (
    await db.query("SELECT undo_token, previous_value FROM account_memories WHERE user_id=$1", [
      account,
    ])
  ).rows[0];
  observedTokens.persisted = undoState.undo_token;
  assert.equal(
    undoState.undo_token,
    update.token,
    "Persisted undo token must match the streamed memory change token",
  );
  assert.deepEqual(JSON.parse(undoState.previous_value), {
    stayType: "hotel",
    minRating: 8,
    freeCancellation: true,
  });
  assert.deepEqual(JSON.parse(rows[0].value), {
    stayType: "hotel",
    minRating: 10,
    freeCancellation: true,
  });
  fixture.configureMemoryFixture(database, account);
  const undone = await undo.POST(
    new Request("http://localhost/api/account/memory/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: update.token }),
    }),
  );
  assert.deepEqual(
    await undone.json(),
    { undone: true },
    `Undo token ${update.token} did not match the current account memory`,
  );
  rows = await saved();
  observedRows = rows;
  assert.deepEqual(JSON.parse(rows[0].value), {
    stayType: "hotel",
    minRating: 8,
    freeCancellation: true,
  });

  phase = "undo-reports-zero-row-race-as-not-undone";
  await db.query(
    `INSERT INTO account_memories (user_id, key, value, previous_value, undo_token, updated_at)
     VALUES ($1, 'dietary', 'vegetarian', 'vegan', 'undo-race-token', now())
     ON CONFLICT (user_id, key) DO UPDATE SET value=excluded.value,
       previous_value=excluded.previous_value, undo_token=excluded.undo_token`,
    [account],
  );
  const updateRace = databaseThatChangesAfterSelect(database, () =>
    db.query(
      "UPDATE account_memories SET undo_token='concurrent-replacement', value='gluten-free' WHERE user_id=$1 AND key='dietary'",
      [account],
    ),
  );
  fixture.configureMemoryFixture(updateRace.database, account);
  const racedUndo = await undo.POST(
    new Request("http://localhost/api/account/memory/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "undo-race-token" }),
    }),
  );
  assert.equal(updateRace.changed(), true, "The test must replace the token after its read");
  const raceResponse = await racedUndo.json();
  assert.deepEqual(raceResponse, { undone: false });
  assert.deepEqual(
    (
      await db.query(
        "SELECT value, undo_token FROM account_memories WHERE user_id=$1 AND key='dietary'",
        [account],
      )
    ).rows,
    [{ value: "gluten-free", undo_token: "concurrent-replacement" }],
  );
  observedTokens.race = {
    submitted: "undo-race-token",
    replacement: "concurrent-replacement",
    response: raceResponse,
  };

  await db.query(
    `INSERT INTO account_memories (user_id, key, value, previous_value, undo_token, updated_at)
     VALUES ($1, 'pace', 'relaxed pace', null, 'delete-race-token', now())
     ON CONFLICT (user_id, key) DO UPDATE SET value=excluded.value,
       previous_value=excluded.previous_value, undo_token=excluded.undo_token`,
    [account],
  );
  const deleteRace = databaseThatChangesAfterSelect(database, () =>
    db.query(
      "UPDATE account_memories SET undo_token='concurrent-delete-replacement', value='packed pace' WHERE user_id=$1 AND key='pace'",
      [account],
    ),
  );
  fixture.configureMemoryFixture(deleteRace.database, account);
  const racedDeleteUndo = await undo.POST(
    new Request("http://localhost/api/account/memory/undo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "delete-race-token" }),
    }),
  );
  assert.equal(deleteRace.changed(), true, "The test must replace the token after its read");
  assert.deepEqual(await racedDeleteUndo.json(), { undone: false });
  assert.deepEqual(
    (
      await db.query(
        "SELECT value, undo_token FROM account_memories WHERE user_id=$1 AND key='pace'",
        [account],
      )
    ).rows,
    [{ value: "packed pace", undo_token: "concurrent-delete-replacement" }],
  );
  observedTokens.deleteRace = {
    submitted: "delete-race-token",
    replacement: "concurrent-delete-replacement",
    response: { undone: false },
  };

  assert.deepEqual(
    readPreferences([{ key: "accommodation", value: "apartment", source: "chat_confirmed" }])
      .stayType,
    "apartment",
  );
  assert.equal(
    readPreferences([
      { key: "accommodation", value: "minimum rating: 10", source: "chat_confirmed" },
    ]).minRating,
    10,
  );
  assert.equal(
    readPreferences([
      { key: "accommodation", value: "free cancellation", source: "chat_confirmed" },
    ]).freeCancellation,
    true,
  );
  await page.screenshot({
    path: resolve(output, "merged-accommodation-memory.png"),
    fullPage: true,
  });
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        outcome: "passed",
        account,
        rows: await saved(),
        checks: [
          "one accommodation row",
          "partial preference merge",
          "planner reads structured and legacy values",
          "undo restores prior merged value",
          "concurrent token replacement yields undone=false and preserves replacement",
          "concurrent token replacement before first-write delete yields undone=false and preserves replacement",
        ],
        undoTokenSource: "streamed memoryChange token, verified equal to the persisted row token",
        browser: browser.version(),
        boundary:
          "Browser-driven custom form posts through the production chat route, account-memory storage, undo route and accommodation preference reader. Both undo races are deterministically interleaved at the database-client boundary after the real token-select query; PGlite, Clerk identity and database client are fixture substitutions. No deployed Clerk/Neon, live models, provider integration or production workspace UI is exercised.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Accommodation memory E2E passed; first memory action: ${first.action}; screenshot: ${resolve(output, "merged-accommodation-memory.png")}`,
  );
} catch (error) {
  const report = {
    outcome: "failed",
    phase,
    observedRows,
    observedTokens,
    error: String(error),
    boundary:
      "Browser-driven custom form posts through the production chat route, account-memory storage, undo route and accommodation preference reader; PGlite, Clerk identity and database client are fixture substitutions. No deployed Clerk/Neon, live models, provider integration or production workspace UI is exercised.",
  };
  await writeFile(resolve(output, "result.json"), JSON.stringify(report, null, 2) + "\n");
  if (
    phase === "recognize-and-merge-three-accommodation-fields" &&
    observedRows.length === 1 &&
    observedRows[0].value === "free cancellation"
  ) {
    await writeFile(resolve(output, "red-result.json"), JSON.stringify(report, null, 2) + "\n");
  }
  throw error;
} finally {
  await browser?.close();
  await db.close();
  await runtime.close();
}
