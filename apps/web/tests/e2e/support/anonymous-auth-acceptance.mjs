import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { apiRouteMethods, isAnonymousRefusal, publicApiRoutes } from "./api-route-methods.mjs";

export async function anonymousAcceptance({ base, directory, localProduction, output, modelStub }) {
  const checks = [];
  const exercised = [];
  let failure;
  let origin = null;
  let phase = "input validation";
  const check = (condition, name) => {
    checks.push({ name, passed: Boolean(condition) });
    assert(condition, name);
  };
  const request = async (path, method = "GET", body) => {
    const response = await fetch(new URL(path, base), {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: {
        "x-trip-data-mode": "live",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {}
    exercised.push({ path, method, status: response.status });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: json,
      text,
    };
  };
  try {
    const url = new URL(base);
    origin = url.origin;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    assert(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/");
    assert(url.protocol === "https:" || (url.protocol === "http:" && loopback));
    assert(!localProduction || loopback, "Production write probes require a loopback server");
    if (localProduction) {
      const stub = new URL(modelStub);
      assert(["localhost", "127.0.0.1", "[::1]"].includes(stub.hostname));
      assert(stub.protocol === "http:" && !stub.username && !stub.password && !stub.search);
    }
    phase = "anonymous public workspace";
    check((await request("/")).status === 200, "public fixture workspace remains reachable");
    const mode = await request("/api/data-mode");
    const withoutClerk = mode.body?.liveBlock === "auth-not-configured";
    check(
      mode.status === 200 &&
        mode.body?.liveAvailable === false &&
        ["auth-not-configured", "sign-in-required"].includes(mode.body?.liveBlock) &&
        mode.headers["cache-control"] === "no-store",
      "anonymous live access is disabled with an uncached explicit reason",
    );
    if (localProduction)
      check(withoutClerk, "production server reports that Clerk is not configured");
    phase = "protected API inventory";
    const routes = await apiRouteMethods(directory);
    const protectedMethods = routes.filter(({ path }) => !publicApiRoutes.has(path));
    const selected = localProduction
      ? protectedMethods
      : protectedMethods.filter(({ method }) => method === "GET");
    check(selected.length > 0, "protected API probes are not empty");
    for (const { path, method } of selected) {
      const result = await request(path, method);
      check(
        withoutClerk
          ? result.status === 503 && result.headers["cache-control"] === "no-store"
          : isAnonymousRefusal(result, method),
        `anonymous ${method} ${path} fails closed with ${withoutClerk ? 503 : 401}`,
      );
    }
    if (!withoutClerk) {
      const page = await request("/trips");
      check(
        page.status === 307 && new URL(page.headers.location, base).pathname === "/sign-in",
        "protected page redirects to sign-in",
      );
    }
    if (localProduction) {
      phase = "production model boundary";
      const count = async () => {
        const response = await fetch(new URL("/count", modelStub), {
          signal: AbortSignal.timeout(5000),
        });
        assert(response.ok);
        const { count } = await response.json();
        assert(Number.isSafeInteger(count) && count >= 0);
        return count;
      };
      const before = await count();
      const tripId = `auth-public-${randomUUID()}`;
      const chat = await request("/api/chat", "POST", {
        tripId,
        message: "Plan this trip",
        mode: "plan",
        brief: {
          tripId,
          destination: "Tokyo",
          origin: "Sydney",
          dates: ["2030-10-01", "2030-10-04"],
          groupSize: 2,
          budgetTotal: 5000,
        },
      });
      const frames = chat.text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      check(
        chat.status === 200 &&
          frames.some((frame) => frame.type === "complete") &&
          !frames.some((frame) => frame.type === "error"),
        "anonymous production planning completes using the fixture fallback",
      );
      const lab = await request("/api/agent-lab/runs", "POST", {
        scenarioId: "tokyo-couple",
        strategyId: "multi-agent-no-revision",
        dataMode: "live",
      });
      const rejected = JSON.parse(lab.text.trim());
      check(
        lab.status === 401 && rejected.type === "rejected" && rejected.reason === "live_disabled",
        "anonymous live Agent Lab execution is refused",
      );
      check((await count()) === before, "anonymous production probes make zero model calls");
    }
  } catch (error) {
    failure =
      error instanceof assert.AssertionError
        ? error.message
        : `${phase}: ${error.name} (${error.cause?.code || "no transport code"})`;
  } finally {
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(output, "summary.json"),
      JSON.stringify(
        {
          profile: localProduction
            ? "local-production-without-clerk"
            : "anonymous-deployment-get-only",
          origin,
          checks,
          exercised,
          failure: failure || null,
          limits: localProduction
            ? ["No genuine Clerk sessions", "Local production server, not a hosted deployment"]
            : [
                "GET requests only",
                "Hosted revision not independently verified",
                "No signed-in or expiry coverage",
              ],
        },
        null,
        2,
      ),
    );
  }
  assert(!failure, failure);
  console.log(`Anonymous auth acceptance: ${checks.length} checks passed`);
}
