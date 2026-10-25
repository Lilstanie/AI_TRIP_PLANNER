import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PGlite } = require("@electric-sql/pglite");
const viteRequire = createRequire(require.resolve("vitest/node"));
const { createServer } = await import(viteRequire.resolve("vite"));
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const output = resolve(root, "output/e2e/neon-memory-driver", process.env.LABEL || "after");
await mkdir(output, { recursive: true });
const runtime = await createServer({
  root,
  configFile: false,
  resolve: { alias: [{ find: "@", replacement: resolve(root, "apps/web") }] },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false },
  appType: "custom",
});
const db = new PGlite();
await db.exec(await readFile(resolve(root, "apps/web/drizzle/0002_adorable_namor.sql"), "utf8"));
const neonModule = await import("@neondatabase/serverless");
const { neonConfig, Client } = neonModule;
const savedConfig = Object.fromEntries(
  ["webSocketConstructor", "pipelineConnect", "coalesceWrites", "fetchFunction"].map((key) => [
    key,
    neonConfig[key],
  ]),
);
const savedUrl = process.env.DATABASE_URL;
const originalEnd = Client.prototype.end;
const statements = [];
const checks = [];
let opened = 0;
let closed = 0;
let ended = 0;
let connectFailure = false;
let endFailure = false;
let failure;
let phase = "remember through the production driver";
class FixtureSocket extends EventTarget {
  constructor(url) {
    super();
    assert.equal(new URL(url).hostname, "memory.invalid");
    this.readyState = 0;
    this.queue = Promise.resolve();
    opened += 1;
    queueMicrotask(() => {
      if (connectFailure) {
        this.dispatchEvent(new Event("error"));
        this.close();
      } else {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
      }
    });
  }
  send(bytes) {
    this.queue = this.queue
      .then(async () => {
        const buffer = Buffer.from(bytes);
        if (buffer[0] === 0) {
          this.emit(Buffer.from([82, 0, 0, 0, 8, 0, 0, 0, 0, 90, 0, 0, 0, 5, 73]));
          return;
        }
        if (buffer[0] === 88) return this.close();
        if (buffer[0] === 81) statements.push(buffer.toString("utf8", 5, buffer.length - 1));
        const result = await db.execProtocolRaw(buffer);
        if (result.length) this.emit(result);
      })
      .catch((error) => {
        failure ??= error.message;
        this.dispatchEvent(new Event("error"));
        this.close();
      });
  }
  emit(buffer) {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      }),
    );
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    closed += 1;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  }
}
const check = (name, condition) => {
  assert(condition, name);
  checks.push(name);
};
try {
  process.env.DATABASE_URL = "postgres://fixture:fixture@memory.invalid/fixture";
  neonConfig.webSocketConstructor = FixtureSocket;
  neonConfig.pipelineConnect = false;
  neonConfig.coalesceWrites = false;
  neonConfig.fetchFunction = async (url, options) => {
    assert.equal(new URL(url).hostname, "api.invalid");
    const { query, params } = JSON.parse(options.body);
    const result = await db.query(query, params, { rowMode: "array" });
    return Response.json({
      fields: result.fields,
      rows: result.rows.map((row) => row.map((value) => (value === null ? null : String(value)))),
      rowCount: result.affectedRows ?? result.rows.length,
      command: query.trim().split(/\s/)[0].toUpperCase(),
    });
  };
  Client.prototype.end = async function (...args) {
    ended += 1;
    await originalEnd.apply(this, args);
    if (endFailure) throw new Error("injected client cleanup failure");
  };
  const memory = await runtime.ssrLoadModule("/apps/web/lib/account/memory.ts");
  const first = await memory.rememberAccountPreference("owner-a", "dietary", "vegetarian");
  check("first write commits through the installed Neon driver", first?.action === "remembered");
  check(
    "first-write undo deletes only its owner",
    !(await memory.undoAccountMemory("owner-b", first.token)),
  );
  check(
    "first-write undo deletes the saved row",
    await memory.undoAccountMemory("owner-a", first.token),
  );

  for (const [legacy, expected] of [
    ["hotels", { stayType: "hotel" }],
    ["minimum rating: 8", { minRating: 8 }],
    ["free cancellation", { freeCancellation: true }],
    ['{"stayType":"hotel","custom":"preserved"}', { stayType: "hotel", custom: "preserved" }],
  ]) {
    await db.query(
      "INSERT INTO account_memories VALUES ($1, 'accommodation', $2, null, 'initial', now()) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value",
      ["owner-a", legacy],
    );
    const changed = await memory.rememberAccountPreference(
      "owner-a",
      "accommodation",
      '{"minRating":9}',
    );
    assert.deepEqual(JSON.parse(changed.value), { ...expected, minRating: 9 });
    check(`legacy ${legacy} merges without losing fields`, changed.action === "updated");
    check(
      `legacy ${legacy} undo restores its exact text`,
      await memory.undoAccountMemory("owner-a", changed.token),
    );
    const restored = await memory.getAccountMemories("owner-a");
    assert.equal(restored.find(({ key }) => key === "accommodation").value, legacy);
  }
  const before = (await db.query("SELECT * FROM account_memories ORDER BY user_id,key")).rows;
  for (const patch of [
    '{"minRating":11}',
    '{"freeCancellation":"yes"}',
    '{"other":true}',
    "[]",
    "broken",
  ]) {
    await assert.rejects(memory.rememberAccountPreference("invalid-owner", "accommodation", patch));
  }
  assert.deepEqual(
    (await db.query("SELECT * FROM account_memories ORDER BY user_id,key")).rows,
    before,
  );
  check("invalid patches roll back first-write placeholders", true);
  const openedBeforeGuards = opened;
  check(
    "unrecognized keys cannot open a connection",
    (await memory.rememberAccountPreference("owner-a", "budget", "100")) === undefined &&
      opened === openedBeforeGuards,
  );
  check(
    "no owner cannot open a connection",
    (await memory.rememberAccountPreference(undefined, "dietary", "vegan")) === undefined &&
      opened === openedBeforeGuards,
  );
  delete process.env.DATABASE_URL;
  check(
    "disabled database cannot open a connection",
    (await memory.rememberAccountPreference("owner-a", "dietary", "vegan")) === undefined &&
      opened === openedBeforeGuards,
  );
  process.env.DATABASE_URL = "postgres://fixture:fixture@memory.invalid/fixture";
  for (const stored of ["[]", "null", "42", '\"hotel\"']) {
    await db.query(
      "UPDATE account_memories SET value=$1 WHERE user_id='owner-a' AND key='accommodation'",
      [stored],
    );
    await assert.rejects(
      memory.rememberAccountPreference("owner-a", "accommodation", '{"minRating":9}'),
    );
    assert.equal(
      (
        await db.query(
          "SELECT value FROM account_memories WHERE user_id='owner-a' AND key='accommodation'",
        )
      ).rows[0].value,
      stored,
    );
  }
  check("non-object stored JSON retains validation and rollback", true);
  await db.query(
    "UPDATE account_memories SET value='{' WHERE user_id='owner-a' AND key='accommodation'",
  );
  assert.deepEqual(
    JSON.parse(
      (await memory.rememberAccountPreference("owner-a", "accommodation", '{"minRating":9}')).value,
    ),
    { minRating: 9 },
  );
  check("malformed legacy text keeps the existing empty-object fallback", true);
  const { withMemoryTransaction } = await runtime.ssrLoadModule(
    "/apps/web/lib/db/memory-transaction.ts",
  );
  await assert.rejects(
    withMemoryTransaction(async (tx) => tx.execute("select * from missing_memory_driver_table")),
  );
  check("SQL failures roll back and close the installed client", opened === closed);
  const primary = new Error("primary callback failure");
  endFailure = true;
  await assert.rejects(
    withMemoryTransaction(async () => {
      throw primary;
    }),
    (error) => error === primary,
  );
  check("cleanup failure preserves the primary callback error", true);
  await assert.rejects(
    withMemoryTransaction(async () => "committed"),
    /injected client cleanup failure/,
  );
  check("successful operation reports cleanup failure", true);
  endFailure = false;
  phase = "failed connection lifecycle";
  const endBefore = ended;
  connectFailure = true;
  await assert.rejects(memory.rememberAccountPreference("owner-a", "dietary", "vegan"));
  connectFailure = false;
  check("failed connect still ends its client", ended === endBefore + 1);
  check(
    "wire protocol executes begin, commit and rollback",
    ["begin", "commit", "rollback"].every((verb) =>
      statements.some((sql) => sql.toLowerCase().startsWith(verb)),
    ),
  );
  check("all per-operation sockets are closed", opened === closed);
} catch (error) {
  failure ??= `${phase}: ${error.message}; cause: ${error.cause?.message ?? "none"}; nested: ${error.cause?.cause?.message ?? "none"}`;
} finally {
  for (const [key, value] of Object.entries(savedConfig)) neonConfig[key] = value;
  Client.prototype.end = originalEnd;
  if (savedUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedUrl;
  await runtime.close();
  await db.close();
  await writeFile(
    resolve(output, "summary.json"),
    JSON.stringify(
      {
        checks,
        opened,
        closed,
        ended,
        statements,
        failure: failure ?? null,
        limits: [
          "In-process PostgreSQL wire/HTTP transport only; no remote Neon or Clerk",
          "Sequential real-driver coverage; existing fixture owns concurrency/undo races",
        ],
      },
      null,
      2,
    ),
  );
}
assert.equal(failure, undefined, failure);
console.log(`Neon memory driver: ${checks.length} checks passed; all ${opened} sockets closed`);
