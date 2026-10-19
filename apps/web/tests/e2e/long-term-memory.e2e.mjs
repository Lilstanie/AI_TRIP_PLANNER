import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { openMockWorkspace, settle } from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const { PGlite } = require("@electric-sql/pglite");
const { drizzle } = require("drizzle-orm/pglite");
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const output = resolve(root, "apps/web/output/playwright/long-term-memory");
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
const { SETTINGS_KEY, defaultSettings } = await runtime.ssrLoadModule(
  "/apps/web/lib/account/settings.ts",
);
const schema = await runtime.ssrLoadModule("/apps/web/lib/db/schema.ts");
const fixture = await runtime.ssrLoadModule(
  "/apps/web/tests/e2e/fixtures/memory-server/runtime.mjs",
);
const database = drizzle(db, { schema });
const agents = await runtime.ssrLoadModule("/packages/agents/src/index.ts");
const chat = await runtime.ssrLoadModule("/apps/web/app/api/chat/route.ts");
const memory = await runtime.ssrLoadModule("/apps/web/app/api/account/memory/route.ts");
const undo = await runtime.ssrLoadModule("/apps/web/app/api/account/memory/undo/route.ts");
const accountSettings = await runtime.ssrLoadModule("/apps/web/app/api/account/settings/route.ts");
let account = "account-one";
const evidence = [];
const brief = {
  tripId: "memory-e2e",
  userId: "spoofed-account",
  destination: "Melbourne",
  dates: ["2026-12-01", "2026-12-03"],
  groupSize: 2,
  budgetTotal: 10000,
};
async function callChat(body) {
  console.log(`memory-e2e: ${body.message}`);
  fixture.configureMemoryFixture(database, account);
  const lines = await agents.runWithModelsDisabled(async () => {
    const response = await chat.POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-trip-data-mode": "mock" },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 200);
    return (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  });
  evidence.push({ account: account ?? null, message: body.message, lines });
  return lines;
}
const saved = async () =>
  (
    await db.query(
      "SELECT key, value FROM account_memories WHERE user_id='account-one' ORDER BY key",
    )
  ).rows;
const proposal = (response, id) =>
  response.plan.sections.find((section) => section.id === id).proposal;
const dietary = (response) => JSON.stringify(proposal(response, "dining"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.tracing.start({ screenshots: true, snapshots: true });
try {
  const page = await context.newPage();
  let latestResponse;
  await page.route("**/api/account/memory/undo", async (route) => {
    fixture.configureMemoryFixture(database, account);
    const response = await undo.POST(
      new Request(route.request().url(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: route.request().postData(),
      }),
    );
    await route.fulfill({ status: response.status, json: await response.json() });
  });
  await page.route("**/api/account/memory", async (route) => {
    fixture.configureMemoryFixture(database, account);
    const response =
      route.request().method() === "GET"
        ? await memory.GET()
        : await memory.DELETE(
            new Request(route.request().url(), {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: route.request().postData(),
            }),
          );
    await route.fulfill({ status: response.status, json: await response.json() });
  });
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    const requestBrief = { ...brief, tripId: body.tripId ?? brief.tripId };
    if (body.message.includes("profile precedence"))
      requestBrief.preferences = ["Dietary: vegetarian"];
    if (body.message.includes("trip precedence")) {
      requestBrief.preferences = ["Dietary: vegetarian"];
      requestBrief.learnedPreferences = ["Dietary: pescatarian"];
    }
    if (body.message.includes("learned-only precedence"))
      requestBrief.learnedPreferences = ["Dietary: pescatarian"];
    const lines = await callChat({ ...body, mode: "plan", brief: requestBrief });
    latestResponse = lines.find((line) => line.type === "complete")?.response;
    assert.ok(latestResponse, JSON.stringify(lines));
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: lines.map((line) => JSON.stringify(line)).join("\n") + "\n",
    });
  });
  await openMockWorkspace(page, process.env.BASE_URL ?? "http://localhost:3000");
  const send = async (message) => {
    latestResponse = undefined;
    const input = page.locator(".composer__input");
    await input.fill(message);
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".composer__input")?.disabled);
    await settle(page, 400);
    assert.ok(latestResponse, message);
    return latestResponse;
  };
  const latestAgent = page.locator(".msg-item--agent").last();
  const notice = async (expected) => {
    await latestAgent.getByRole("status").filter({ hasText: expected }).waitFor();
  };
  await send("I don't eat spicy food");
  await notice("Remembered: Does not eat spicy food");
  await page.screenshot({ path: resolve(output, "remembered.png"), fullPage: true });
  assert.match(
    dietary(await send("Plan around a $2,000 budget in the central area")),
    /Does not eat spicy food/,
  );
  assert.equal((await saved()).length, 1);
  for (const [enabled, revision] of [
    [false, 0],
    [true, 1],
  ]) {
    const settings = defaultSettings();
    settings.assistant.memory = enabled;
    const response = await accountSettings.PUT(
      new Request("http://localhost/api/account/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings, revision }),
      }),
    );
    assert.equal(response.status, 200);
    if (!enabled) {
      const events = await callChat({
        tripId: "server-opt-out",
        mode: "plan",
        brief,
        message: "I can eat spicy food now",
        assistant: { style: "neutral", memory: true },
      });
      const result = events.find(({ type }) => type === "complete")?.response;
      assert.ok(result, JSON.stringify(events));
      assert.equal(
        result.memoryChange,
        undefined,
        "persisted opt-out must override a client opt-in",
      );
      assert.doesNotMatch(dietary(result), /dietary=Does not eat spicy food/);
      assert.equal((await saved())[0].value, "Does not eat spicy food");
    }
  }

  for (const [message, value] of [
    ["We prefer a relaxed pace", "relaxed pace"],
    ["I love museums", "museum"],
    ["We need wheelchair access", "wheelchair access"],
    ["I prefer apartments", "apartment"],
    ["My usual departure city is Sydney", "Sydney"],
  ]) {
    await send(message);
    await notice(`Remembered: ${value}`);
  }
  await send("For this trip, I prefer a packed pace");
  assert.deepEqual(Object.fromEntries((await saved()).map(({ key, value }) => [key, value])), {
    accessibility: "wheelchair access",
    accommodation: JSON.stringify({ stayType: "apartment" }),
    departure_city: "Sydney",
    dietary: "Does not eat spicy food",
    interests: "museum",
    pace: "relaxed pace",
  });
  const final = await send("Plan my dining");
  await writeFile(resolve(output, "specialist-plan.json"), JSON.stringify(final, null, 2));
  const itinerary = proposal(final, "itinerary");
  assert.match(JSON.stringify(itinerary), /relaxed pace/);
  assert.match(JSON.stringify(itinerary), /wheelchair access/);
  assert.match(JSON.stringify(itinerary), /remembered interests \(museum\)/);
  assert.ok(
    itinerary.items.every(
      ({ day }, _, items) => items.filter((item) => item.day === day).length === 1,
    ),
  );
  const guide = proposal(final, "destination-guide");
  assert.match(JSON.stringify(guide), /remembered interests \(museum\)/);
  assert.match(JSON.stringify(guide), /remembered relaxed pace/);
  const transport = proposal(final, "transport");
  assert.ok(transport.items.some(({ location }) => location?.includes("Sydney")));
  assert.match(JSON.stringify(transport), /wheelchair access/);
  assert.match(JSON.stringify(proposal(final, "accommodation")), /apartment/);
  assert.ok(
    proposal(final, "accommodation").stays.every((stay) =>
      stay.candidates.every((candidate) => /apartment/i.test(candidate.name)),
    ),
    "Remembered stay type must reach the booking search",
  );
  assert.match(
    dietary(await send("Check learned-only precedence")),
    /dietary=Dietary: pescatarian/,
  );
  assert.match(dietary(await send("Check profile precedence")), /dietary=Dietary: vegetarian/);
  const trip = dietary(await send("Check trip precedence"));
  assert.match(trip, /dietary=Dietary: pescatarian/);
  assert.doesNotMatch(trip, /dietary=Dietary: vegetarian/);
  await page.screenshot({ path: resolve(output, "specialist-plan.png"), fullPage: true });
  async function toggleMemory(enabled) {
    await page.evaluate(
      ({ key, enabled, defaults }) => {
        const settings = JSON.parse(localStorage.getItem(key) ?? "null") ?? defaults;
        settings.assistant.memory = enabled;
        localStorage.setItem(key, JSON.stringify(settings));
      },
      { key: SETTINGS_KEY, enabled, defaults: defaultSettings() },
    );
    await page.reload();
    await page.locator(".workspace-app").waitFor();
  }
  await toggleMemory(false);
  const disabled = await send("I can eat spicy food now");
  assert.equal(disabled.memoryChange, undefined);
  assert.doesNotMatch(dietary(disabled), /dietary=Does not eat spicy food/);
  assert.equal(
    (await saved()).find(({ key }) => key === "dietary").value,
    "Does not eat spicy food",
  );
  await toggleMemory(true);
  assert.match(dietary(await send("Plan my dining")), /dietary=Does not eat spicy food/);
  await send("I can eat spicy food now");
  await notice("Updated: Can eat spicy food");
  await latestAgent.getByRole("button", { name: "Undo" }).click();
  await notice("Undone");
  assert.equal(
    (await saved()).find(({ key }) => key === "dietary").value,
    "Does not eat spicy food",
  );
  account = "account-two";
  assert.doesNotMatch(dietary(await send("Plan my dining")), /dietary=Does not eat spicy food/);
  account = undefined;
  assert.doesNotMatch(dietary(await send("Plan my dining")), /dietary=Does not eat spicy food/);
  assert.equal((await send("I don't eat spicy food")).memoryChange, undefined);
  assert.equal(
    (await db.query("SELECT count(*)::int AS count FROM account_memories")).rows[0].count,
    6,
  );
  await page.screenshot({ path: resolve(output, "account-and-signed-out.png"), fullPage: true });
  account = "account-one";
  fixture.configureMemoryFixture(database, account);
  assert.equal((await (await memory.GET()).json()).memories.length, 6);
  const deletion = await memory.DELETE(
    new Request("http://localhost/api/account/memory", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "dietary" }),
    }),
  );
  assert.deepEqual(await deletion.json(), { deleted: true });
  assert.doesNotMatch(dietary(await send("Plan my dining")), /dietary=Does not eat spicy food/);
  const failed = await callChat({
    tripId: "failed-memory",
    message: "I don't eat spicy food",
    mode: "plan",
    brief: { ...brief, accommodation: { minRating: 10 } },
  });
  assert.ok(failed.some(({ type }) => type === "error"));
  assert.equal(
    (await saved()).some(({ key }) => key === "dietary"),
    false,
  );
  const incomplete = await callChat({
    tripId: "incomplete-memory",
    message: "I don't eat spicy food",
  });
  assert.ok(incomplete.some(({ type }) => type === "needs_info" || type === "ask_user"));
  assert.equal(
    (await saved()).some(({ key }) => key === "dietary"),
    false,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM account_memories WHERE user_id='spoofed-account'",
      )
    ).rows[0].count,
    0,
  );
  await writeFile(
    resolve(output, "trace.json"),
    JSON.stringify(
      {
        evidence,
        checks: [
          "six category persistence and specialist consumers",
          "trip/profile/memory precedence",
          "opt-out read and write exclusion",
          "replacement and undo",
          "account isolation and signed-out exclusion",
          "server identity overrides spoofed userId",
          "delete affects next plan",
          "failed and incomplete planning do not write memory",
        ],
        database: "PGlite",
        migration: "0002_adorable_namor.sql",
        browser: browser.version(),
        boundary:
          "Production route handlers, storage, orchestrator and deterministic specialists; Clerk identity and database client substituted. Deployed Clerk/Neon and live models untested.",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await context.tracing.stop({ path: resolve(output, "browser-trace.zip") });
  await context.close();
  await browser.close();
  await db.close();
  await runtime.close();
}
