// Failure inventory, written before the module:
// - the public Agent Lab page or its run endpoint falls behind the sign-in gate;
// - a workspace page (home, a trip, settings) becomes public by accident;
// - the Clerk sign-in and sign-up pages stop being reachable while signed out.
//
// The browser E2E runs without Clerk keys, where the middleware lets everything through, so it cannot
// see any of these. Route matching is the only part of the gate that can be checked without keys.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isPublicRoute } from "@/lib/auth/public-routes";

const at = (path: string) => new NextRequest(`http://localhost:3000${path}`);

describe("public routes", () => {
  it.each([
    "/agent-lab",
    "/agent-lab/",
    "/api/agent-lab/runs",
    "/sign-in",
    "/sign-up/sso-callback",
  ])("lets signed-out visitors reach %s", (path) => {
    expect(isPublicRoute(at(path))).toBe(true);
  });

  it.each(["/", "/settings", "/trips/abc"])("keeps %s behind sign-in", (path) => {
    expect(isPublicRoute(at(path))).toBe(false);
  });
});
