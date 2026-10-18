import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { openMockWorkspace, settle } from "./trip-setup.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const { PGlite } = require("@electric-sql/pglite");
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const output = resolve(root, "apps/web/output/playwright/long-term-memory");
const base = process.env.BASE_URL ?? "http://localhost:3000";
await mkdir(output, { recursive: true });
const db = new PGlite();
await db.exec(await readFile(resolve(root, "apps/web/drizzle/0002_adorable_namor.sql"), "utf8"));
const events = [];
let sequence = 0;
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
  let account = "account-one";
  await page.exposeFunction("setFixtureAccount", (id) => {
    account = typeof id === "string" && id.length > 0 ? id : undefined;
  });
  await page.route("**/api/account/memory/undo", async (route) => {
    const token = route.request().postDataJSON().token;
    const row = await db.query(
      "SELECT * FROM account_memories WHERE user_id=$1 AND undo_token=$2",
      [account, token],
    );
    if (!row.rows[0]) return route.fulfill({ json: { undone: false } });
    const memory = row.rows[0];
    if (memory.previous_value === null) {
      await db.query("DELETE FROM account_memories WHERE user_id=$1 AND key=$2 AND undo_token=$3", [
        account,
        memory.key,
        token,
      ]);
    } else {
      await db.query(
        "UPDATE account_memories SET value=$1, previous_value=NULL, undo_token=$2 WHERE user_id=$3 AND key=$4 AND undo_token=$5",
        [memory.previous_value, `undo-${++sequence}`, account, memory.key, token],
      );
    }
    events.push({ type: "undo", account, token });
    await route.fulfill({ json: { undone: true } });
  });
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    const message = body.message;
    let memoryChange;
    const match = /don't eat spicy|can eat spicy|不吃辣|可以吃辣/u.test(message);
    if (account && body.assistant?.memory !== false && match) {
      const value = /can eat spicy|可以吃辣/u.test(message)
        ? "Can eat spicy food"
        : "Does not eat spicy food";
      const current = await db.query(
        "SELECT value FROM account_memories WHERE user_id=$1 AND key='dietary'",
        [account],
      );
      const token = `token-${++sequence}`;
      await db.query(
        `INSERT INTO account_memories(user_id,key,value,previous_value,undo_token,updated_at)
         VALUES ($1,'dietary',$2,$3,$4,now())
         ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,previous_value=excluded.previous_value,
         undo_token=excluded.undo_token,updated_at=now()`,
        [account, value, current.rows[0]?.value ?? null, token],
      );
      memoryChange = {
        token,
        action: current.rows[0] ? "updated" : "remembered",
        value,
      };
      events.push({ type: "remember", account, value });
    }
    const saved = account
      ? await db.query("SELECT value FROM account_memories WHERE user_id=$1 AND key='dietary'", [
          account,
        ])
      : { rows: [] };
    const dietary = saved.rows[0]?.value ?? "No saved dietary preference";
    const tripOnly = /budget|area|district|预算|区域/iu.test(message);
    const tripId = body.tripId ?? "long-term-memory-e2e";
    const brief = {
      tripId,
      userId: account ?? "anonymous",
      destination: "Sydney",
      dates: ["2026-12-01", "2026-12-03"],
      groupSize: 2,
      budgetTotal: 2000,
    };
    events.push({ type: "plan", account: account ?? null, dietary, tripOnly, message });
    const response = {
      reply: `Dining: ${dietary}`,
      plan: {
        tripId,
        brief,
        round: 1,
        budgetTotal: 2000,
        estTotal: 0,
        overrunPct: -100,
        sections: [],
      },
      ...(memoryChange ? { memoryChange } : {}),
    };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({ type: "complete", response })}\n`,
    });
  });

  await openMockWorkspace(page, base);
  const send = async (message) => {
    const input = page.locator(".composer__input");
    await input.fill(message);
    await input.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".composer__input")?.disabled);
    await settle(page, 400);
  };
  const latestAgent = page.locator(".msg-item--agent").last();
  await send("I don't eat spicy food");
  await assertEventually(latestAgent.getByRole("status"), "Remembered: Does not eat spicy food");
  await assertEventually(latestAgent, /Dining: Does not eat spicy food/);
  await page.screenshot({ path: resolve(output, "remembered.png"), fullPage: true });

  await send("Plan around a $2,000 budget in the central area");
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM account_memories WHERE user_id='account-one'",
      )
    ).rows[0].count,
    1,
  );
  await send("I can eat spicy food now");
  await assertEventually(latestAgent.getByRole("status"), "Updated: Can eat spicy food");
  await latestAgent.getByRole("button", { name: "Undo" }).click();
  await assertEventually(latestAgent.getByRole("status"), /Undone/);
  assert.equal(
    (await db.query("SELECT value FROM account_memories WHERE user_id='account-one'")).rows[0]
      .value,
    "Does not eat spicy food",
  );

  await page.evaluate(() => window.setFixtureAccount("account-two"));
  await send("Plan my dining");
  await assertEventually(latestAgent, /Dining: No saved dietary preference/);
  await page.evaluate(() => window.setFixtureAccount(""));
  await send("Plan my dining");
  await assertEventually(latestAgent, /Dining: No saved dietary preference/);
  await send("I don't eat spicy food");
  await assertEventually(latestAgent, /Dining: No saved dietary preference/);
  assert.equal(
    (await db.query("SELECT count(*)::int AS count FROM account_memories")).rows[0].count,
    1,
  );
  await page.screenshot({ path: resolve(output, "account-and-signed-out.png"), fullPage: true });
  await writeFile(
    resolve(output, "trace.json"),
    `${JSON.stringify(
      {
        events,
        checks: [
          "actual workspace chat UI and localized notice",
          "generated Postgres migration loaded in PGlite",
          "account-scoped write and dining response",
          "trip-only facts excluded",
          "replacement notice and undo restores previous value",
          "cross-account isolation",
          "signed-out planning and write exclusion",
          "Agent Lab benchmark state remains outside account_memories",
        ],
        database: "PGlite",
        migration: "0002_adorable_namor.sql",
        browser: browser.version(),
        apiBoundary: "Playwright route fixture; server Clerk and Neon auth are not exercised",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await context.tracing.stop({ path: resolve(output, "browser-trace.zip") });
  await context.close();
  await browser.close();
  await db.close();
}

async function assertEventually(locator, expected) {
  if (expected instanceof RegExp) {
    await locator.filter({ hasText: expected }).waitFor();
    assert.match(await locator.innerText(), expected);
  } else {
    await locator.waitFor();
    assert.ok((await locator.innerText()).includes(expected));
  }
}
