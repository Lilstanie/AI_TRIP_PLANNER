"use client";

import { useEffect } from "react";

type NativePlugins = {
  Haptics?: {
    selectionChanged?: () => Promise<void>;
    impact?: (options: { style: "LIGHT" | "MEDIUM" }) => Promise<void>;
  };
  Keyboard?: { setAccessoryBarVisible?: (options: { isVisible: boolean }) => Promise<void> };
};

function nativePlugins(): NativePlugins | undefined {
  if (document.documentElement.dataset.shell !== "ios-app") return undefined;
  return (globalThis as { Capacitor?: { Plugins?: NativePlugins } }).Capacitor?.Plugins;
}

/** Adds iOS haptics and hides the keyboard accessory bar; does nothing outside the iOS app. */
export function IosAppBridge() {
  useEffect(() => {
    const plugins = nativePlugins();
    if (!plugins) return;
    plugins.Keyboard?.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {});

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[role="tab"]:not([aria-selected="true"])')) {
        plugins.Haptics?.selectionChanged?.().catch(() => {});
      } else if (target.closest('button[type="submit"]:not(:disabled)')) {
        plugins.Haptics?.impact?.({ style: "LIGHT" }).catch(() => {});
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
