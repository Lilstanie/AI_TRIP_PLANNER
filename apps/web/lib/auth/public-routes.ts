import { createRouteMatcher } from "@clerk/nextjs/server";

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
