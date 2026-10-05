"use client";

import { useEffect } from "react";

// Registers /sw.js so the site is installable and shows the offline page without a network.
// Development builds skip it: a service worker there would outlive hot reloads and confuse them.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failing only costs installability and the offline page; the site still works.
    });
  }, []);
  return null;
}
