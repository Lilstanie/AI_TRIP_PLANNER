import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const output = resolve(root, "output/e2e/real-clerk-route-inventory", process.env.LABEL || "after");
const fixture = await mkdtemp(resolve(tmpdir(), "trip-auth-inventory-"));
const checks = [];
let failure;
const file = async (name, source) => {
  const target = resolve(fixture, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
};
try {
  await file("functions/route.ts", "export async function GET() {}\nexport function POST() {}\n");
  await file(
    "constants/route.ts",
    "export const PUT = async () => {};\nexport const DELETE = () => {};\n",
  );
  await file("aliases/route.ts", "const handler = () => {};\nexport { handler as PATCH };\n");
  await file(
    "handlers.ts",
    "throw new Error('Route discovery must not execute handlers');\nexport const head = () => {};\nexport const OPTIONS = () => {};\n",
  );
  await file("reexports/route.ts", "export { head as HEAD, OPTIONS } from '../handlers';\n");
  await file("stars/route.ts", "export * from '../reexports/route';\n");
  await file("types/route.ts", "export type * from '../reexports/route';\n");
  await file(
    "noise/route.ts",
    "// export function GET() {}\nconst text = 'export function POST() {}';\nexport const runtime = 'nodejs';\nexport type DELETE = string;\nexport type { head as GET } from '../handlers';\n",
  );
  await file("(group)/grouped/route.ts", "export const GET = () => {};\n");
  await file("_private/route.ts", "export const GET = () => {};\n");
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "apps/web/tests/e2e/real-clerk-auth.e2e.mjs"),
      "--list-routes",
      "--api-dir",
      fixture,
    ],
    { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH }, timeout: 60000 },
  );
  checks.push({
    name: "inventory runs without credentials or provisioning",
    passed: result.status === 0,
  });
  assert.equal(result.status, 0, `Inventory must run without Clerk credentials: ${result.stderr}`);
  const actual = JSON.parse(result.stdout);
  const expected = [
    { path: "/api/aliases", method: "PATCH" },
    { path: "/api/constants", method: "DELETE" },
    { path: "/api/constants", method: "PUT" },
    { path: "/api/functions", method: "GET" },
    { path: "/api/functions", method: "POST" },
    { path: "/api/grouped", method: "GET" },
    { path: "/api/reexports", method: "HEAD" },
    { path: "/api/reexports", method: "OPTIONS" },
    { path: "/api/stars", method: "HEAD" },
    { path: "/api/stars", method: "OPTIONS" },
  ];
  checks.push({
    name: "every runtime HTTP export is discovered, without source-text false positives",
    passed: JSON.stringify(actual) === JSON.stringify(expected),
  });
  assert.deepEqual(actual, expected);
  const { isAnonymousRefusal } = await import("../e2e/support/api-route-methods.mjs");
  const refusedHead = { status: 401, headers: { "cache-control": "no-store" }, body: null };
  checks.push({
    name: "HEAD refusal requires uncached 401 without a JSON response body",
    passed: isAnonymousRefusal(refusedHead, "HEAD"),
  });
  assert.equal(isAnonymousRefusal(refusedHead, "HEAD"), true);
  assert.equal(isAnonymousRefusal(refusedHead, "GET"), false);
  assert.equal(isAnonymousRefusal({ ...refusedHead, status: 200 }, "HEAD"), false);
  assert.equal(isAnonymousRefusal({ ...refusedHead, headers: {} }, "HEAD"), false);
  assert.equal(
    isAnonymousRefusal(
      { ...refusedHead, body: { notice: { key: "Sign in to use your account." } } },
      "GET",
    ),
    true,
  );
  checks.push({
    name: "body-bearing methods retain the JSON notice and no-store requirements",
    passed: true,
  });
  console.log(
    "PASS: credential-free route inventory covers functions, constants, aliases, re-exports, HEAD/OPTIONS and route groups",
  );
} catch (error) {
  failure = error.message;
  process.exitCode = 1;
  console.error(failure);
} finally {
  await rm(fixture, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await writeFile(
    resolve(output, "summary.json"),
    JSON.stringify({ checks, failure: failure || null }, null, 2),
  );
}
