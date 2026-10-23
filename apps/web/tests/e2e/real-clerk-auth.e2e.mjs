// requires-env: CLERK_SECRET_KEY, DATABASE_URL
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.env.BASE_URL;
const secret = process.env.CLERK_SECRET_KEY;
assert(secret?.startsWith("sk_test_"), "Requires a Clerk test instance");
assert(process.env.DATABASE_URL, "Requires DATABASE_URL for scoped cleanup");
assert(
  base && ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Requires local BASE_URL",
);
const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(web, "output/playwright/real-clerk-auth", process.env.LABEL || "after");
await mkdir(output, { recursive: true });
const checks = [];
const users = [];
const contexts = [];
const cleanup = [];
const run = randomUUID();
const browser = await chromium.launch({ channel: process.env.CHANNEL || "chrome" });
const clerk = async (path, body, method = "POST") => {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(
    response.ok,
    `Clerk ${method} ${path.replace(/user_[^/]+/g, "user_REDACTED")}: ${response.status}`,
  );
  return response.status === 204 ? null : response.json();
};
const request = async (context, path, method = "GET", data) => {
  const response = await context.request.fetch(`${base}${path}`, {
    method,
    ...(data ? { data } : {}),
    maxRedirects: 0,
  });
  return {
    status: response.status(),
    headers: response.headers(),
    body: await response.json().catch(() => null),
  };
};
const check = (condition, name) => {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
};
let failure;
let phase = "anonymous API boundary";
try {
  const anonymous = await browser.newContext();
  contexts.push(anonymous);
  const routes = [];
  const walk = async (directory, segments = []) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory())
        await walk(resolve(directory, entry.name), [...segments, entry.name]);
      else if (entry.name === "route.ts") {
        const source = await readFile(resolve(directory, entry.name), "utf8");
        for (const match of source.matchAll(
          /export (?:async )?function (GET|POST|PUT|DELETE|PATCH)\(/g,
        )) {
          routes.push({ path: `/api/${segments.join("/")}`, method: match[1] });
        }
      }
    }
  };
  await walk(resolve(web, "app/api"));
  const publicRoutes = new Set([
    "/api/agent-lab/benchmark",
    "/api/agent-lab/runs",
    "/api/chat",
    "/api/data-mode",
    "/api/places/details",
    "/api/places/photo",
    "/api/places/search",
    "/api/routes/from-location",
    "/api/trip/preview-edit",
  ]);
  for (const { path, method } of routes) {
    if (publicRoutes.has(path)) continue;
    const result = await request(anonymous, path, method);
    check(
      result.status === 401 &&
        result.body?.notice?.key === "Sign in to use your account." &&
        result.headers["cache-control"] === "no-store",
      `anonymous ${method} ${path} returns uncached 401 JSON`,
    );
  }
  const protectedPage = await request(anonymous, "/trips");
  check(
    protectedPage.status === 307 &&
      new URL(protectedPage.headers.location, base).pathname === "/sign-in",
    "anonymous protected browser page redirects to sign-in",
  );
  const mode = await request(anonymous, "/api/data-mode");
  check(
    mode.status === 200 && mode.body.liveAvailable === false,
    "anonymous live mode unavailable",
  );
  phase = "database preflight";
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  const tables =
    await sql`SELECT count(*)::int AS ready FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('trips', 'conversations', 'user_settings') AND column_name = 'revision' AND data_type = 'integer' AND is_nullable = 'NO'`;
  check(tables[0].ready === 3, "account revision migration applied before provisioning test users");
  phase = "Clerk testing token";
  const testing = await clerk("/testing_tokens", {});
  for (let index = 0; index < 2; index++) {
    phase = `create test account ${index + 1}`;
    const user = await clerk("/users", {
      email_address: [`trip-e2e-${run}-${index}+clerk_test@example.com`],
      password: `${randomUUID()}Aa1!`,
      skip_password_checks: true,
    });
    users.push(user.id);
    const context = await browser.newContext();
    contexts.push(context);
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.hostname.endsWith(".clerk.accounts.dev") &&
        !url.searchParams.has("__clerk_testing_token")
      ) {
        url.searchParams.set("__clerk_testing_token", testing.token);
        await route.continue({ url: url.href });
      } else await route.continue();
    });
    phase = `browser Clerk sign-in ${index + 1}`;
    const page = await context.newPage();
    await page.goto(`${base}/sign-in`, { waitUntil: "commit" });
    await page.waitForFunction(() => window.Clerk?.loaded, undefined, { timeout: 60000 });
    const ticket = await clerk("/sign_in_tokens", { user_id: user.id, expires_in_seconds: 60 });
    await page.evaluate(async (token) => {
      const result = await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: token });
      await window.Clerk.setActive({ session: result.createdSessionId });
    }, ticket.token);
    await page.waitForFunction(() => Boolean(window.Clerk?.session));
    const signedInMode = await request(context, "/api/data-mode");
    check(
      signedInMode.status === 200 && signedInMode.body.liveAvailable === true,
      `real session ${index + 1} enables live access`,
    );
  }
  const [, accountA, accountB] = contexts;
  phase = "account storage isolation";
  const id = `auth-e2e-${run}`;
  const record = {
    id,
    revision: 0,
    updatedAt: new Date().toISOString(),
    record: { marker: "account-a" },
  };
  const created = await request(accountA, "/api/account/sync", "POST", {
    trips: [record],
    conversations: [],
  });
  check(
    created.status === 200 && created.body?.accepted?.trips.length === 1,
    `account A creates a trip in real storage (HTTP ${created.status})`,
  );
  const bInitial = await request(accountB, "/api/account/sync");
  check(
    bInitial.status === 200 && !bInitial.body.trips.some((trip) => trip.id === id),
    "account B cannot read A's trip",
  );
  const forged = await request(accountB, "/api/account/sync", "POST", {
    userId: users[0],
    trips: [{ ...record, revision: 1, record: { marker: "forged" } }],
    conversations: [],
  });
  check(
    forged.status === 200 && forged.body.accepted.trips.length === 0,
    "forged owner cannot overwrite another account's revision",
  );
  const unchanged = await request(accountA, "/api/account/sync");
  check(
    unchanged.body.trips.find((trip) => trip.id === id)?.record.marker === "account-a",
    "A's persisted trip remains unchanged",
  );
  const exported = await request(accountB, "/api/account/export");
  check(
    exported.status === 200 && !JSON.stringify(exported.body).includes(id),
    "B export excludes A's trip",
  );
  const invalid = await browser.newContext({
    extraHTTPHeaders: { authorization: "Bearer invalid.session.signature" },
  });
  contexts.push(invalid);
  check((await request(invalid, "/api/account/sync")).status === 401, "tampered session rejected");
  await contexts[1].pages()[0].evaluate(() => window.Clerk.signOut());
  check(
    (await request(accountA, "/api/account/sync")).status === 401,
    "signed-out real session rejected",
  );
} catch (error) {
  failure =
    error instanceof assert.AssertionError
      ? error.message
      : `${phase}: ${error.name} (${error.cause?.code || "no transport code"})`;
} finally {
  for (let index = 0; index < users.length; index++) {
    let recordsDeleted = false;
    let userDeleted = false;
    try {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      await sql.transaction([
        sql`DELETE FROM trips WHERE user_id = ${users[index]}`,
        sql`DELETE FROM conversations WHERE user_id = ${users[index]}`,
        sql`DELETE FROM user_settings WHERE user_id = ${users[index]}`,
      ]);
      recordsDeleted = true;
    } catch {
      recordsDeleted = false;
    }
    try {
      await clerk(`/users/${users[index]}`, undefined, "DELETE");
      userDeleted = true;
    } catch {
      userDeleted = false;
    }
    cleanup.push({ account: index + 1, recordsDeleted, userDeleted });
  }
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
  await writeFile(
    resolve(output, "summary.json"),
    JSON.stringify(
      {
        run,
        checks,
        cleanup,
        failure: failure || null,
        limits: [
          "Daily quota enforcement pending #440",
          "Expired valid JWT and missing-Clerk production boot not covered",
          "Public mock policy from PR #443",
          "No production-key execution",
        ],
      },
      null,
      2,
    ),
  );
}
assert(!failure, failure);
assert(
  cleanup.every((item) => item.recordsDeleted && item.userDeleted),
  "Temporary account cleanup incomplete",
);
console.log(
  `Real Clerk acceptance: ${checks.length} checks passed; ${cleanup.length} temporary accounts removed`,
);
