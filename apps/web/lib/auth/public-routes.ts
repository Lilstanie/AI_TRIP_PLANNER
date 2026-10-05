import { createRouteMatcher } from "@clerk/nextjs/server";

// Paths a signed-out visitor may open. API routes keep their own authorization and response
// contracts, so only page navigation is redirected to sign-in.
// `/.well-known` holds the Android app's Digital Asset Links, which Android fetches signed out.
export const isPublicRoute = createRouteMatcher([
  "/.well-known(.*)",
  "/agent-lab(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
  "/api(.*)",
  "/trpc(.*)",
]);
