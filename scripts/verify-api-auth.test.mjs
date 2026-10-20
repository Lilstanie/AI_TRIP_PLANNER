import assert from "node:assert/strict";
import test from "node:test";
import { EXPECTED, apiRoutes, isPublic, problems, publicPatterns } from "./verify-api-auth.mjs";

test("every API route has the authentication status this repository declared", () => {
  assert.deepEqual(problems(), []);
});

test("the account endpoints are not public", () => {
  const patterns = publicPatterns();
  for (const route of apiRoutes().filter((path) => path.startsWith("/api/account"))) {
    assert.equal(isPublic(route, patterns), false, `${route} must require a session`);
  }
});

test("a blanket /api matcher is reported", () => {
  const found = problems({ patterns: ["/api(.*)"] });
  assert.ok(
    found.some((line) => line.startsWith("/api/account")),
    `widening the matcher must fail the check, got ${JSON.stringify(found)}`,
  );
});

test("an unclassified route is reported", () => {
  const found = problems({ routes: [...EXPECTED.keys(), "/api/admin"] });
  assert.ok(
    found.some((line) => line.includes("/api/admin") && line.includes("no entry in EXPECTED")),
    `a new route must fail until it is classified, got ${JSON.stringify(found)}`,
  );
});

test("a classified route that no longer exists is reported", () => {
  const found = problems({ routes: apiRoutes().filter((path) => path !== "/api/chat") });
  assert.ok(
    found.some((line) => line.includes("/api/chat") && line.includes("no handler")),
    `a removed route must fail until EXPECTED is updated, got ${JSON.stringify(found)}`,
  );
});
