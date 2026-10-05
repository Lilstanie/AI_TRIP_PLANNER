import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { authEnabled } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "AI Trip Planner",
  description: "Plan trips with an AI travel planning workspace.",
  // iPhone ignores the manifest's icons and standalone display; these tags cover Add to Home Screen.
  appleWebApp: { capable: true, title: "Trip Planner", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Matches the `--page` token in each theme so the installed app's title bar blends in.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* ClerkProvider sits inside <body>; without keys the workspace stays local-only. */}
      <body>
        <ServiceWorkerRegistration />
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
