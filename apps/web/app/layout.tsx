import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IosAppBridge } from "@/components/pwa/ios-app-bridge";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { authEnabled } from "@/lib/auth/config";
import { SETTINGS_KEY } from "@/lib/account/settings";
import { savedThemeScript } from "@/lib/account/theme";

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

const APP_SHELL_MARKER = `if (/TripPlannerIOSApp/.test(navigator.userAgent)) document.documentElement.dataset.shell = "ios-app"; else if (/TripPlannerMacApp/.test(navigator.userAgent)) document.documentElement.dataset.shell = "mac-app";`;
const SAVED_THEME = savedThemeScript(SETTINGS_KEY);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_SHELL_MARKER }} />
        <script dangerouslySetInnerHTML={{ __html: SAVED_THEME }} />
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
