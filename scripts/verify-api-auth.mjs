#!/usr/bin/env node
// Fails when an API route's authentication status is not the one this repository declared, so a new
// endpoint cannot reach production unclassified and a widened public matcher cannot quietly expose
// endpoints that used to need a session.
//
//   node --test scripts/verify-api-auth.test.mjs
//
// EXPECTED lists every route handler under apps/web/app/api with the status it must have and why.
// A route is public when apps/web/lib/auth/public-routes.ts matches its path; the patterns are read
// from that file so the check follows the middleware rather than a second copy of the policy.
//
// Public does not mean unguarded: `requestDataMode` downgrades signed-out callers of the public
// endpoints to mock data, so the workspace can be demonstrated without spending provider quota.
//
// Failure inventory this check was written from:
// - a blanket "/api(.*)" entry exempts every endpoint, including the one that spends the allowance;
// - a new endpoint ships with no entry here and nobody decides whether it needs a session;
// - a route is renamed and its old classification silently stops applying;
// - an endpoint is added to the public list without the review that status deserves.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

/** Every API route, with the status it must have and the reason that status is correct. */
export const EXPECTED = new Map(
  /** @type {[string, { status: "public" | "protected"; reason: string }][]} */ ([
    ["/api/account", { status: "protected", reason: "reads and writes the signed-in account" }],
    ["/api/account/export", { status: "protected", reason: "exports the account's own data" }],
    ["/api/account/settings", { status: "protected", reason: "changes account settings" }],
    ["/api/account/sync", { status: "protected", reason: "syncs the account's trips and chats" }],
    [
      "/api/agent-lab/benchmark",
      {
        status: "public",
        reason: "Agent Lab is a public teaching surface; live runs have their own gate",
      },
    ],
    [
      "/api/agent-lab/runs",
      {
        status: "public",
        reason: "Agent Lab is a public teaching surface; live runs have their own gate",
      },
    ],
    [
      "/api/chat",
      {
        status: "public",
        reason: "planning is the demo; signed-out callers are downgraded to mock",
      },
    ],
    ["/api/data-mode", { status: "public", reason: "reports which mode the caller may use" }],
    [
      "/api/places/details",
      {
        status: "public",
        reason: "drives the public workspace; downgraded to mock when signed out",
      },
    ],
    [
      "/api/places/photo",
      {
        status: "public",
        reason: "drives the public workspace; downgraded to mock when signed out",
      },
    ],
    [
      "/api/places/search",
      {
        status: "public",
        reason: "drives the public workspace; downgraded to mock when signed out",
      },
    ],
    [
      "/api/routes/from-location",
      {
        status: "public",
        reason: "drives the public workspace; downgraded to mock when signed out",
      },
    ],
    [
      "/api/trip/preview-edit",
      {
        status: "public",
        reason: "drives the public workspace; downgraded to mock when signed out",
      },
    ],
  ]),
);

/** Route paths served by apps/web/app/api, derived from the handler files on disk. */
export function apiRoutes(appDir = join(ROOT, "apps/web/app/api")) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}/${entry}`);
      else if (entry === "route.ts") out.push(prefix);
    }
  };
  walk(appDir, "/api");
  return out;
}

/** The literal matcher patterns declared in the auth policy. */
export function publicPatterns(file = join(ROOT, "apps/web/lib/auth/public-routes.ts")) {
  const source = readFileSync(file, "utf8");
  const list = source.slice(source.indexOf("["), source.lastIndexOf("]"));
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** Whether a path is public, using the same patterns the middleware applies. */
export function isPublic(path, patterns) {
  return patterns.some((pattern) => {
    const source = pattern
      .split("(.*)")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}$`).test(path);
  });
}

/** Routes whose real status differs from EXPECTED, plus routes nobody classified. */
export function problems({ routes = apiRoutes(), patterns = publicPatterns() } = {}) {
  const found = [];
  for (const route of routes) {
    const expected = EXPECTED.get(route);
    const actual = isPublic(route, patterns) ? "public" : "protected";
    if (!expected) {
      found.push(
        `${route} has no entry in EXPECTED. Decide whether a signed-out visitor needs it, then add it with a reason.`,
      );
    } else if (expected.status !== actual) {
      found.push(
        `${route} is ${actual} but EXPECTED says ${expected.status} (${expected.reason}).`,
      );
    }
  }
  for (const route of EXPECTED.keys()) {
    if (!routes.includes(route)) found.push(`${route} is in EXPECTED but no handler serves it.`);
  }
  return found;
}
