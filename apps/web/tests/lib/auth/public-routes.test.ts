import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isPublicRoute } from "@/lib/auth/public-routes";

const at = (path: string) => new NextRequest(`http://localhost:3000${path}`);

describe("public routes", () => {
  it.each([
    "/",
    "/agent-lab",
    "/agent-lab/",
    "/api/agent-lab/runs",
    "/api/chat",
    "/api/data-mode",
    "/api/places/search",
    "/api/routes/from-location",
    "/api/trip/preview-edit",
    "/sign-in",
    "/sign-up/sso-callback",
  ])("lets signed-out visitors reach %s", (path) => {
    expect(isPublicRoute(at(path))).toBe(true);
  });

  it.each([
    "/settings",
    "/trips/abc",
    "/debug/map",
    "/api/account",
    "/api/account/export",
    "/api/account/settings",
    "/api/account/sync",
  ])("keeps %s behind sign-in", (path) => {
    expect(isPublicRoute(at(path))).toBe(false);
  });
});
