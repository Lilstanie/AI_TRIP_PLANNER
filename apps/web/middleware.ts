import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authEnabled } from "./lib/auth/config";

// Without Clerk keys the app runs local-only, so the middleware steps aside rather than failing
// every request on a missing key. Routes are public either way; server code that needs a user
// checks for one itself (lib/auth/session.ts).
export default authEnabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk's Frontend API proxy
    "/__clerk/:path*",
  ],
};
