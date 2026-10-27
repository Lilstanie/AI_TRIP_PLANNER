import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");
const { PGlite } = require("@electric-sql/pglite");
const { drizzle } = require("drizzle-orm/pglite");
const viteRequire = createRequire(require.resolve("vitest/node"));
const { createServer } = await import(viteRequire.resolve("vite"));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixture = resolve(root, "apps/web/tests/e2e/fixtures/chat-memory-cancellation");
const output = resolve(
  root,
  "apps/web/output/playwright/chat-memory-cancellation",
  process.env.LABEL || "after",
);
await mkdir(output, { recursive: true });
const runtimePath = resolve(fixture, "runtime.mjs");
const aliases = [
  { find: "@trip/orchestrator", replacement: resolve(fixture, "orchestrator.mjs") },
  { find: "@trip/tools", replacement: runtimePath },
  { find: "@trip/services", replacement: runtimePath },
  { find: "next/server", replacement: runtimePath },
  { find: "@clerk/nextjs/server", replacement: runtimePath },
  { find: "@/lib/db/client", replacement: runtimePath },
  { find: "../db/client", replacement: runtimePath },
  { find: "../db/memory-transaction", replacement: runtimePath },
  { find: "@/lib/auth/config", replacement: runtimePath },
  { find: "../auth/config", replacement: runtimePath },
  { find: "@/lib/auth/live-data", replacement: runtimePath },
  { find: "@/lib/account/memory-enabled", replacement: runtimePath },
  { find: "@", replacement: resolve(root, "apps/web") },
];
const vite = await createServer({
  root,
  configFile: false,
  resolve: { alias: aliases },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false },
  appType: "custom",
});
const database = new PGlite();
for (const migration of [
  "0000_fantastic_doomsday.sql",
  "0001_ambitious_micromacro.sql",
  "0002_adorable_namor.sql",
])
  await database.exec(await readFile(resolve(root, "apps/web/drizzle", migration), "utf8"));
const fixtureRuntime = await vite.ssrLoadModule(
  "/apps/web/tests/e2e/fixtures/chat-memory-cancellation/runtime.mjs",
);
fixtureRuntime.configure(drizzle(database));
const { POST } = await vite.ssrLoadModule("/apps/web/app/api/chat/route.ts");
const { readRunCount } = await vite.ssrLoadModule(
  "/apps/web/tests/e2e/fixtures/chat-memory-cancellation/orchestrator.mjs",
);
const preAbortedRequest = new AbortController();
preAbortedRequest.abort(new Error("request already disconnected"));
const runsBeforePreAbortedRequest = readRunCount();
const preAbortedResponse = await POST(
  new Request("http://localhost/api/chat", {
    method: "POST",
    signal: preAbortedRequest.signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tripId: "cancel-memory-e2e",
      message: "Plan this trip",
      mode: "plan",
      brief: {
        tripId: "cancel-memory-e2e",
        destination: "Melbourne",
        dates: ["2026-12-01", "2026-12-03"],
        groupSize: 2,
        budgetTotal: 1000,
      },
    }),
  }),
);
await preAbortedResponse.text();
assert.equal(readRunCount(), runsBeforePreAbortedRequest, "already-aborted request skips planning");
const portServer = createHttpServer();
const cancellationObserved = new Promise((resolve) => {
  portServer.on("request", async (incoming, outgoing) => {
    if (incoming.url === "/") {
      outgoing.writeHead(200, { "content-type": "text/html" });
      outgoing.end(`<!doctype html><meta charset="utf-8"><title>Memory cancellation</title><button onclick="startChat()">Start</button><script>
        window.startChat = () => {
          window.chatController = new AbortController();
          window.chatRequest = fetch('/api/chat', {
            method: 'POST', signal: window.chatController.signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tripId: 'cancel-memory-e2e', message: "I don't eat spicy food", mode: 'plan', assistant: { memory: true }, brief: { tripId: 'cancel-memory-e2e', destination: 'Melbourne', dates: ['2026-12-01', '2026-12-03'], groupSize: 2, budgetTotal: 1000 } })
          }).catch(() => undefined);
        };
        window.abortChat = () => window.chatController.abort();
      </script>`);
      return;
    }
    const requestAbort = new AbortController();
    const response = await POST(
      new Request(`http://localhost${incoming.url}`, {
        method: "POST",
        signal: requestAbort.signal,
        headers: incoming.headers,
        body: await new Promise((resolveBody, reject) => {
          const chunks = [];
          incoming.on("data", (chunk) => chunks.push(chunk));
          incoming.on("end", () => resolveBody(Buffer.concat(chunks)));
          incoming.on("error", reject);
        }),
      }),
    );
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    const reader = response.body.getReader();
    outgoing.once("close", async () => {
      if (outgoing.writableEnded) return;
      requestAbort.abort("browser disconnected");
      await reader.cancel("browser disconnected");
      resolve();
    });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        outgoing.write(Buffer.from(value));
      }
      outgoing.end();
    } catch (error) {
      if (!outgoing.destroyed) outgoing.destroy(error);
    }
  });
});
await new Promise((resolve) => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  const page = await browser.newPage();
  const context = page.context();
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByRole("button", { name: "Start" }).click();
  await fixtureRuntime.waitForWrite();
  await page.evaluate(() => window.abortChat());
  await cancellationObserved;
  fixtureRuntime.releaseBlockedWrite();
  await fixtureRuntime.waitForTransactionFinish();
  const row = await database.query(
    "SELECT value FROM account_memories WHERE user_id='cancellation-user' AND key='dietary'",
  );
  await page.screenshot({ path: resolve(output, "cancelled-chat.png") });
  await writeFile(
    resolve(output, "result.json"),
    JSON.stringify(
      {
        passed: row.rows.length === 0,
        databaseRowsAfterCancellation: row.rows.length,
        browser: browser.version(),
        command: "node apps/web/tests/e2e/chat-memory-cancellation.e2e.mjs",
        assertions: [
          "already-aborted request skips planning",
          "request abort and stream cancellation roll back the in-flight memory write",
        ],
      },
      null,
      2,
    ),
  );
  await context.tracing.stop({ path: resolve(output, "trace.zip") });
  assert.equal(row.rows.length, 0, "cancelled request must roll back its in-flight memory write");
  console.log(`PASS: cancelled chat memory write rolled back in Chromium ${browser.version()}`);
} finally {
  await browser.close();
  await new Promise((resolve) => portServer.close(resolve));
  await vite.close();
  await database.close();
}
