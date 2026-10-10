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
