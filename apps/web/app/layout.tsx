import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { ReactNode } from "react";
import { authEnabled } from "@/lib/auth/config";

export const metadata = {
  title: "AI Trip Planner",
  description: "Plan trips with an AI travel planning workspace.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* ClerkProvider sits inside <body>; without keys the workspace stays local-only. */}
      <body>
        {authEnabled ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInForceRedirectUrl="/"
            signUpForceRedirectUrl="/"
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
