import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authEnabled } from "./lib/auth/config";
import { isPublicRoute } from "./lib/auth/public-routes";
import { noticeBody } from "./lib/i18n/notice";

export default authEnabled
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();
      if (!userId && !isPublicRoute(request)) {
        if (/^\/(?:api|trpc)(?:\/|$)/.test(request.nextUrl.pathname)) {
          return NextResponse.json(noticeBody({ key: "signInToUseYour" }), {
            status: 401,
            headers: { "Cache-Control": "no-store" },
          });
        }
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
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",

    "/(api|trpc)(.*)",

    "/__clerk/:path*",
  ],
};
