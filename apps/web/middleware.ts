import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authEnabled } from "./lib/auth/config";

const publicRoutes = createRouteMatcher([
  "/agent-lab(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
  "/api(.*)",
  "/trpc(.*)",
]);

// API routes keep their own authorization and response contracts. Only page navigation redirects.
// Without Clerk keys the app remains a local workspace.
export default authEnabled
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();
      if (!userId && !publicRoutes(request)) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      if (
        userId &&
        (request.nextUrl.pathname === "/sign-in" || request.nextUrl.pathname === "/sign-up")
      ) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    })
  : () => NextResponse.next();

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
