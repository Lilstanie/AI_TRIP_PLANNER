import type { MetadataRoute } from "next";

// The web app manifest makes the site installable: from Chrome or Edge on a computer, from
// Safari's Add to Home Screen on iPhone, and as the Android app in apps/android-twa, which opens
// this same origin. Colours match the `--page` token so the splash screen and title bar blend in.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AI Trip Planner",
    short_name: "Trip Planner",
    description: "Plan trips with an AI travel planning workspace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
