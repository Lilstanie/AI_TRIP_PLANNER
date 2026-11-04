import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IosAppBridge } from "@/components/pwa/ios-app-bridge";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { authEnabled } from "@/lib/auth/config";
import { SETTINGS_KEY } from "@/lib/account/settings";

export const metadata: Metadata = {
  title: "AI Trip Planner",
  description: "Plan trips with an AI travel planning workspace.",

  appleWebApp: { capable: true, title: "Trip Planner", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const IOS_APP_MARKER = `if (/TripPlannerIOSApp/.test(navigator.userAgent)) document.documentElement.dataset.shell = "ios-app";`;
const SAVED_APPEARANCE = `try { const appearance = JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)}) ?? "null")?.appearance; if (appearance === "dark" || appearance === "light") document.documentElement.dataset.theme = appearance; } catch {}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: IOS_APP_MARKER }} />
        <script dangerouslySetInnerHTML={{ __html: SAVED_APPEARANCE }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <IosAppBridge />
        {authEnabled ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInForceRedirectUrl="/"
            signUpForceRedirectUrl="/"
            localization={{ signIn: { start: { title: "Sign in to AI Trip Planner" } } }}
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
