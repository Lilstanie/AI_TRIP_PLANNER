#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

export const EXPECTED = new Map([
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
]);

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

export function publicPatterns(file = join(ROOT, "apps/web/lib/auth/public-routes.ts")) {
  const source = readFileSync(file, "utf8");
  const list = source.slice(source.indexOf("["), source.lastIndexOf("]"));
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

export function isPublic(path, patterns) {
  return patterns.some((pattern) => {
    const source = pattern
      .split("(.*)")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}$`).test(path);
  });
}

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
