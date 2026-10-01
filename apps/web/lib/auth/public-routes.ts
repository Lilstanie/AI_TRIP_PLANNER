import { createRouteMatcher } from "@clerk/nextjs/server";

// Paths a signed-out visitor may open. API routes keep their own authorization and response
// contracts, so only page navigation is redirected to sign-in.
export const isPublicRoute = createRouteMatcher([
  "/agent-lab(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
  "/api(.*)",
  "/trpc(.*)",
]);
