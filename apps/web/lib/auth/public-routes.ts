import { createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes a signed-out visitor may reach.
 *
 * The workspace and the endpoints it drives are public so the product can be demonstrated without
 * an account, but `requestDataMode` downgrades those callers to mock data. Everything absent from
 * this list requires a session; add an entry only when a signed-out visitor genuinely needs it.
 */
export const isPublicRoute = createRouteMatcher([
  "/",
  "/.well-known(.*)",
  "/agent-lab(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
  "/api/agent-lab(.*)",
  "/api/chat",
  "/api/data-mode",
  "/api/places(.*)",
  "/api/routes(.*)",
  "/api/trip(.*)",
]);
