import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { chown, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { connect, createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vitest/node"));
const { createServer } = await import(viteRequire.resolve("vite"));
const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const output = resolve(root, "output/e2e/account-deletion", process.env.LABEL || "after");
await mkdir(output, { recursive: true });

function pgBinary(name) {
  for (const dir of (process.env.PATH ?? "").split(":"))
    if (dir && existsSync(join(dir, name))) return join(dir, name);
  const base = "/usr/lib/postgresql";
  if (existsSync(base))
    for (const version of readdirSync(base).sort((a, b) => Number(b) - Number(a))) {
      const candidate = join(base, version, "bin", name);
      if (existsSync(candidate)) return candidate;
    }
  throw new Error(`PostgreSQL ${name} was not found on PATH or under ${base}/*/bin`);
}

const freePort = () =>
  new Promise((done, fail) => {
    const server = createNetServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const asRoot = process.getuid?.() === 0;
const runAs = asRoot ? ["runuser", "-u", "postgres", "--"] : [];
const command = (binary, args) =>
  asRoot ? ["runuser", [...runAs.slice(1), binary, ...args]] : [binary, args];
const dataDir = await mkdtemp(join(tmpdir(), "account-deletion-pg-"));
if (asRoot) {
  const uid = Number(execFileSync("id", ["-u", "postgres"]).toString());
  const gid = Number(execFileSync("id", ["-g", "postgres"]).toString());
  await chown(dataDir, uid, gid);
}
execFileSync(
  ...command(pgBinary("initdb"), [
    "-D",
    dataDir,
    "-U",
    "postgres",
    "--auth=trust",
    "-E",
    "UTF8",
    "--no-sync",
  ]),
  { stdio: "ignore" },
);
const port = await freePort();
const server = spawn(
  ...command(pgBinary("postgres"), [
    "-D",
    dataDir,
    "-p",
    String(port),
    "-k",
    dataDir,
    "-c",
    "listen_addresses=127.0.0.1",
    "-c",
    "fsync=off",
  ]),
  { stdio: "ignore" },
);

const statements = [];
const hooks = [];
const sockets = { opened: 0, closed: 0 };
const checks = [];
const failures = [];
let failure;
let phase = "start PostgreSQL";
if (process.env.DEBUG)
  setInterval(() => console.error("phase:", phase, statements.at(-1)?.slice(0, 80)), 2000).unref();

function statementsIn(buffer) {
  const found = [];
  for (let offset = 0; offset + 5 <= buffer.length;) {
    const type = buffer[offset];
    const length = buffer.readInt32BE(offset + 1);
    const end = offset + 1 + length;
    if (type === 81) found.push(buffer.toString("utf8", offset + 5, end - 1));
    if (type === 80) {
      const nameEnd = buffer.indexOf(0, offset + 5);
      found.push(buffer.toString("utf8", nameEnd + 1, buffer.indexOf(0, nameEnd + 1)));
    }
    offset = end;
  }
  return found;
}

async function runHooks(sql) {
  statements.push(sql);
  for (const hook of [...hooks]) {
    if (!hook.match(sql)) continue;
    hooks.splice(hooks.indexOf(hook), 1);
    if ((await hook.run(sql)) === "fail") return "fail";
  }
}

class BridgeSocket extends EventTarget {
  constructor() {
    super();
    this.readyState = 0;
    this.started = false;
    this.queue = Promise.resolve();
    sockets.opened += 1;
    this.tcp = connect({ host: "127.0.0.1", port });
    this.tcp.on("connect", () => {
      this.readyState = 1;
      this.dispatchEvent(new Event("open"));
    });
    this.tcp.on("data", (chunk) =>
      this.dispatchEvent(
        new MessageEvent("message", {
          data: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
        }),
      ),
    );
    this.tcp.on("error", () => this.dispatchEvent(new Event("error")));
    this.tcp.on("close", () => this.close());
  }
  send(bytes) {
    const buffer = Buffer.from(bytes);
    const startup = !this.started;
    this.started = true;
    this.queue = this.queue.then(async () => {
      if (this.readyState !== 1) return;
      if (!startup)
        for (const sql of statementsIn(buffer))
          if ((await runHooks(sql)) === "fail") return this.close();
      this.tcp.write(buffer);
    });
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    sockets.closed += 1;
    this.tcp.destroy();
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  }
}

const runtime = await createServer({
  root,
  configFile: false,
  resolve: {
    alias: [
      {
        find: "@clerk/nextjs/server",
        replacement: resolve(root, "apps/web/tests/e2e/fixtures/account-deletion/clerk.mjs"),
      },
      { find: "@", replacement: resolve(root, "apps/web") },
    ],
  },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false },
  appType: "custom",
});
const { neonConfig, Client } = await import("@neondatabase/serverless");
const savedConfig = Object.fromEntries(
  ["webSocketConstructor", "pipelineConnect", "coalesceWrites", "fetchFunction"].map((key) => [
    key,
    neonConfig[key],
  ]),
);
const savedEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
};
const connectionString = "postgres://postgres@bridge.invalid/postgres";
const clerk = { userId: undefined, deleted: [], failDelete: false };
globalThis.__accountDeletionClerk = clerk;
let admin;

const check = (name, condition, detail) => {
  if (condition) checks.push(name);
  else
    failures.push(detail === undefined ? name : `${name}: ${JSON.stringify(detail).slice(0, 400)}`);
};

async function scenario(name, run) {
  phase = name;
  hooks.length = 0;
  try {
    await run();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

async function waitFor(condition, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(20))
    if (await condition()) return true;
  return false;
}

const lockWaiters = async () =>
  (
    await admin.query(
      "select count(*)::int as n from pg_stat_activity where wait_event_type = 'Lock'",
    )
  ).rows[0].n;

async function rowCounts(userId) {
  const counts = {};
  for (const table of ["trips", "conversations", "user_settings", "account_memories"])
    counts[table] = (
      await admin.query(`select count(*)::int as n from ${table} where user_id = $1`, [userId])
    ).rows[0].n;
  return counts;
}
const total = (counts) => Object.values(counts).reduce((sum, value) => sum + value, 0);

async function tombstoned(userId) {
  const exists = (await admin.query("select to_regclass('account_deletions') as t")).rows[0].t;
  if (!exists) return false;
  return (
    (
      await admin.query("select count(*)::int as n from account_deletions where user_id = $1", [
        userId,
      ])
    ).rows[0].n > 0
  );
}

async function seed(userId) {
  await admin.query(
    "insert into trips (user_id, id, record, updated_at) values ($1, 'seed-trip', '{\"id\":\"seed-trip\"}', now())",
    [userId],
  );
  await admin.query(
    "insert into conversations (user_id, id, record, updated_at) values ($1, 'seed-chat', '{\"id\":\"seed-chat\"}', now())",
    [userId],
  );
  await admin.query(
    "insert into user_settings (user_id, settings, updated_at) values ($1, '{}', now())",
    [userId],
  );
  await admin.query(
    "insert into account_memories values ($1, 'dietary', 'vegetarian', null, 'seed', now())",
    [userId],
  );
}

const record = (id, contents = {}) => ({
  id,
  updatedAt: new Date().toISOString(),
  revision: 0,
  record: { id, ...contents },
});

function syncRequest(body, headers = {}) {
  const text = JSON.stringify(body);
  return new Request("http://localhost/api/account/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(text)),
      ...headers,
    },
    body: text,
  });
}

function streamedSyncRequest(headers) {
  const stream = { pulled: false };
  stream.request = new Request("http://localhost/api/account/sync", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    duplex: "half",
    body: new ReadableStream(
      {
        pull(controller) {
          stream.pulled = true;
          controller.enqueue(new TextEncoder().encode('{"trips":[],"conversations":[]}'));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    ),
  });
  return stream;
}

const as = (userId, call) => {
  clerk.userId = userId;
  return call();
};

async function respond(response) {
  return { status: response.status, body: await response.json().catch(() => undefined) };
}

async function settle(promise) {
  try {
    return await respond(await promise);
  } catch (error) {
    return { status: "threw", error: error.message };
  }
}

const evidence = {};
try {
  process.env.DATABASE_URL = connectionString;
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fixture";
  neonConfig.webSocketConstructor = BridgeSocket;
  neonConfig.pipelineConnect = false;
  neonConfig.coalesceWrites = false;
  neonConfig.fetchFunction = async (_url, options) => {
    const { query, params } = JSON.parse(options.body);
    if ((await runHooks(query)) === "fail") throw new Error("injected HTTP statement failure");
    const client = new Client(connectionString);
    await client.connect();
    try {
      const result = await client.query({
        text: query,
        values: params,
        rowMode: "array",
        types: { getTypeParser: () => (value) => value },
      });
      return Response.json({
        fields: result.fields,
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      });
    } finally {
      await client.end();
    }
  };

  const listening = () =>
    new Promise((done) => {
      const probe = connect({ host: "127.0.0.1", port });
      probe.once("connect", () => done(true) || probe.destroy());
      probe.once("error", () => done(false));
    });
  assert(await waitFor(listening, 15000), "PostgreSQL did not start listening");
  admin = new Client(connectionString);
  await admin.connect();
  evidence.postgres = (await admin.query("select version() as v")).rows[0].v;
  phase = "apply migrations";
  const journal = JSON.parse(
    await readFile(resolve(root, "apps/web/drizzle/meta/_journal.json"), "utf8"),
  );
  for (const { tag } of journal.entries)
    for (const sql of (await readFile(resolve(root, `apps/web/drizzle/${tag}.sql`), "utf8")).split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await admin.query(sql);
  evidence.migrations = journal.entries.map(({ tag }) => tag);

  const account = await runtime.ssrLoadModule("/apps/web/app/api/account/route.ts");
  const sync = await runtime.ssrLoadModule("/apps/web/app/api/account/sync/route.ts");
  const settings = await runtime.ssrLoadModule("/apps/web/app/api/account/settings/route.ts");
  const memory = await runtime.ssrLoadModule("/apps/web/lib/account/memory.ts");
  const contract = await runtime.ssrLoadModule("/apps/web/lib/account/sync.ts");

  await scenario("sync lands between two delete statements", async () => {
    const userId = "race-between";
    await seed(userId);
    let pending;
    let finished = false;
    hooks.push({
      match: (sql) => /^delete from "conversations"/i.test(sql),
      run: async () => {
        pending = as(userId, () =>
          sync.POST(syncRequest({ trips: [record("late-trip")], conversations: [] })),
        ).finally(() => (finished = true));
        await waitFor(async () => finished || (await lockWaiters()) > 0);
        evidence.betweenStatements = { syncFinishedBeforeDeleteContinued: finished };
      },
    });
    const deleted = await settle(as(userId, () => account.DELETE()));
    const late = await settle(pending);
    const counts = await rowCounts(userId);
    Object.assign(evidence.betweenStatements, { deleted, late, counts });
    check(
      "delete answers ok while a sync races it",
      deleted.status === 200 && deleted.body?.ok,
      deleted,
    );
    check(
      "a sync arriving mid-delete waits for the delete",
      !evidence.betweenStatements.syncFinishedBeforeDeleteContinued,
    );
    check(
      "the waiting sync is refused because the account is being deleted",
      late.status === 410 && late.body?.notice?.key === "thisAccountIsBeingDeleted",
      late,
    );
    check("no rows remain after a sync raced the delete", total(counts) === 0, counts);

    const settingsSave = await settle(
      as(userId, () =>
        settings.PUT(
          new Request("http://localhost/api/account/settings", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              settings: { updatedAt: new Date().toISOString() },
              revision: 0,
            }),
          }),
        ),
      ),
    );
    evidence.afterDeletion = { settingsSave };
    const remembered = await memory
      .rememberAccountPreference(userId, "dietary", "vegan")
      .catch((error) => ({ threw: error.message }));
    evidence.afterDeletion.remembered = remembered ?? null;
    const after = await rowCounts(userId);
    evidence.afterDeletion.counts = after;
    check(
      "a settings save after deletion is refused",
      settingsSave.status === 410 || settingsSave.status === 400,
      settingsSave,
    );
    check(
      "a remembered preference after deletion writes nothing",
      remembered === undefined,
      remembered,
    );
    check("no writes recreate rows after deletion", total(after) === 0, after);
  });

  await scenario("sync already in flight when the delete starts", async () => {
    const userId = "race-inflight";
    await seed(userId);
    let pending;
    let finished = false;
    hooks.push({
      match: (sql) => /^insert into "trips"/i.test(sql),
      run: async () => {
        pending = as(userId, () => account.DELETE()).finally(() => (finished = true));
        await waitFor(async () => finished || (await lockWaiters()) > 0);
        evidence.inFlight = { deleteFinishedBeforeSyncContinued: finished };
      },
    });
    const pushed = await settle(
      as(userId, () =>
        sync.POST(syncRequest({ trips: [record("in-flight-trip")], conversations: [] })),
      ),
    );
    const deleted = await settle(pending);
    const counts = await rowCounts(userId);
    Object.assign(evidence.inFlight, { pushed, deleted, counts });
    check("the in-flight sync commits", pushed.status === 200, pushed);
    check(
      "the delete waits for the in-flight sync",
      !evidence.inFlight.deleteFinishedBeforeSyncContinued,
    );
    check("the delete still answers ok", deleted.status === 200 && deleted.body?.ok, deleted);
    check("the in-flight sync's rows are deleted too", total(counts) === 0, counts);
  });

  await scenario("deletion of one account does not block another", async () => {
    await seed("slow-delete");
    let neighbour;
    hooks.push({
      match: (sql) => /^delete from "trips"/i.test(sql),
      run: async () => {
        const timeout = sleep(5000).then(() => ({ status: "timed out" }));
        neighbour = await Promise.race([
          settle(
            as("neighbour", () =>
              sync.POST(syncRequest({ trips: [record("neighbour-trip")], conversations: [] })),
            ),
          ),
          timeout,
        ]);
      },
    });
    const deleted = await settle(as("slow-delete", () => account.DELETE()));
    evidence.neighbour = { neighbour, deleted, counts: await rowCounts("neighbour") };
    check("another account syncs while a deletion is open", neighbour?.status === 200, neighbour);
    check("the neighbour's row survives", evidence.neighbour.counts.trips === 1);
  });

  await scenario("a failing delete statement", async () => {
    const userId = "fails-midway";
    await seed(userId);
    hooks.push({ match: (sql) => /^delete from "user_settings"/i.test(sql), run: () => "fail" });
    const deleted = await settle(as(userId, () => account.DELETE()));
    const counts = await rowCounts(userId);
    const marked = await tombstoned(userId);
    const retrySync = await settle(
      as(userId, () =>
        sync.POST(syncRequest({ trips: [record("after-failure")], conversations: [] })),
      ),
    );
    evidence.failedDelete = { deleted, counts, tombstone: marked, retrySync };
    check(
      "a failed delete answers the fixed 500 notice",
      deleted.status === 500 &&
        deleted.body?.notice?.key === "yourAccountCouldNotBe" &&
        typeof deleted.body?.error === "string",
      deleted,
    );
    check("a failed delete removes nothing", total(counts) === 4, counts);
    check("a failed delete leaves no tombstone", !marked);
    check("the account still syncs after a failed delete", retrySync.status === 200, retrySync);
  });

  await scenario("Clerk deletion fails after the data is gone", async () => {
    const userId = "clerk-fails";
    await seed(userId);
    clerk.failDelete = true;
    const deleted = await settle(as(userId, () => account.DELETE()));
    clerk.failDelete = false;
    const lagging = await settle(
      as(userId, () =>
        sync.POST(syncRequest({ trips: [record("lagging-tab")], conversations: [] })),
      ),
    );
    const counts = await rowCounts(userId);
    const retried = await settle(as(userId, () => account.DELETE()));
    evidence.clerkFailure = { deleted, lagging, counts, retried };
    check(
      "a Clerk failure still answers 502 after the data is gone",
      deleted.status === 502 && deleted.body?.notice?.key === "yourDataWasDeletedBut",
      deleted,
    );
    check("a lagging tab cannot write after a Clerk failure", lagging.status === 410, lagging);
    check("no rows remain after a Clerk failure", total(counts) === 0, counts);
    check("retrying the delete succeeds", retried.status === 200 && retried.body?.ok, retried);
    check("Clerk received both attempts", clerk.deleted.filter((id) => id === userId).length === 2);
  });

  await scenario("a push is committed as one transaction", async () => {
    const userId = "atomic-push";
    hooks.push({ match: (sql) => /^insert into "conversations"/i.test(sql), run: () => "fail" });
    const pushed = await settle(
      as(userId, () =>
        sync.POST(
          syncRequest({ trips: [record("atomic-trip")], conversations: [record("atomic-chat")] }),
        ),
      ),
    );
    const counts = await rowCounts(userId);
    evidence.atomicPush = { pushed, counts };
    check(
      "a failed push answers a fixed 500 notice",
      pushed.status === 500 && typeof pushed.body?.notice?.key === "string",
      pushed,
    );
    check("a failed push writes none of its records", total(counts) === 0, counts);
  });

  await scenario("sync body limits", async () => {
    const limit = contract.MAX_SYNC_BODY_BYTES;
    evidence.limits = {
      maxSyncBodyBytes: limit ?? null,
      maxRecordChars: contract.MAX_RECORD_CHARS,
    };
    check("the body limit is exported with the sync contract", Number.isInteger(limit), limit);
    const oversized = streamedSyncRequest({ "content-length": String(limit + 1) });
    const tooLarge = await settle(as("limits", () => sync.POST(oversized.request)));
    const unsized = streamedSyncRequest({});
    const missing = await settle(as("limits", () => sync.POST(unsized.request)));
    Object.assign(evidence.limits, { tooLarge, missing });
    check(
      "a declared oversized body is refused with 413",
      tooLarge.status === 413 && tooLarge.body?.notice?.key === "syncRequestIsTooLarge",
      tooLarge,
    );
    check("an oversized body is never read", !oversized.pulled);
    check("a body without Content-Length is refused with 411", missing.status === 411, missing);
    check("an unsized body is never read", !unsized.pulled);

    const wide = "旅".repeat(
      contract.MAX_RECORD_CHARS - JSON.stringify({ id: "wide", t: "" }).length,
    );
    const widest = record("wide", { t: wide });
    check(
      "the widest valid record is exactly at the record limit",
      JSON.stringify(widest.record).length === contract.MAX_RECORD_CHARS,
    );
    const single = contract.syncBatches({ trips: [widest], conversations: [] });
    check(
      "the widest valid record fits one body",
      single.length === 1 && Buffer.byteLength(JSON.stringify(single[0])) <= limit,
      single.map((batch) => Buffer.byteLength(JSON.stringify(batch))),
    );
    const accepted = await settle(as("limits", () => sync.POST(syncRequest(single[0]))));
    check(
      "the widest valid record syncs",
      accepted.status === 200 && accepted.body?.accepted?.trips?.length === 1,
      accepted.status,
    );

    const many = {
      trips: Array.from({ length: 20 }, (_, index) =>
        record(`bulk-trip-${index}`, { t: "x".repeat(400_000) }),
      ),
      conversations: Array.from({ length: 20 }, (_, index) =>
        record(`bulk-chat-${index}`, { t: "y".repeat(400_000) }),
      ),
    };
    const batches = contract.syncBatches(many);
    const sizes = batches.map((batch) => Buffer.byteLength(JSON.stringify(batch)));
    evidence.limits.batches = sizes;
    check("a large catalog splits into several bodies", batches.length > 1, sizes);
    check(
      "every batch fits the body limit",
      sizes.every((size) => size <= limit),
      sizes,
    );
    check(
      "batches keep every record exactly once and in order",
      JSON.stringify(batches.flatMap((batch) => batch.trips.map(({ id }) => id))) ===
        JSON.stringify(many.trips.map(({ id }) => id)) &&
        JSON.stringify(batches.flatMap((batch) => batch.conversations.map(({ id }) => id))) ===
          JSON.stringify(many.conversations.map(({ id }) => id)),
    );
    check(
      "batches keep the per-kind count limit",
      batches.every((batch) => batch.trips.length <= 500 && batch.conversations.length <= 500),
    );
  });
} catch (error) {
  failure ??= `${phase}: ${error.message}`;
  if (process.env.DEBUG) console.error(error);
} finally {
  for (const [key, value] of Object.entries(savedConfig)) neonConfig[key] = value;
  for (const [key, value] of Object.entries(savedEnv))
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  await admin?.end().catch(() => undefined);
  await runtime.close();
  const exited = new Promise((done) =>
    server.exitCode === null ? server.once("exit", done) : done(),
  );
  execFileSync(...command(pgBinary("pg_ctl"), ["stop", "-D", dataDir, "-m", "fast"]), {
    stdio: "ignore",
  });
  await exited;
  await rm(dataDir, { recursive: true, force: true });
  await writeFile(
    resolve(output, "summary.json"),
    JSON.stringify(
      {
        checks,
        failure: failure ?? null,
        failures,
        evidence,
        sockets,
        statements: statements.length,
        limits: [
          "Real local PostgreSQL behind the installed Neon WebSocket and HTTP drivers; no remote Neon",
          "Clerk is a fixture module; no real sign-in or user deletion",
          "Route handlers run in-process; Next.js request parsing and platform body limits are not exercised",
        ],
      },
      null,
      2,
    ),
  );
}
assert.equal(failure, undefined, failure);
assert.deepEqual(failures, [], failures.join("\n"));
console.log(`Account deletion: ${checks.length} checks passed`);
