"use client";

import { useEffect } from "react";

type ShellTab = { id: string; label: string; badge: boolean };
type ShellState = { tabs: ShellTab[]; selected?: string; hidden: boolean };

type NativePlugins = {
  Haptics?: {
    selectionChanged?: () => Promise<void>;
    impact?: (options: { style: "LIGHT" | "MEDIUM" }) => Promise<void>;
  };
  Keyboard?: { setAccessoryBarVisible?: (options: { isVisible: boolean }) => Promise<void> };
  TripShell?: { setTabs?: (state: ShellState) => Promise<{ height: number }> };
};

function nativePlugins(): NativePlugins | undefined {
  if (document.documentElement.dataset.shell !== "ios-app") return undefined;
  return (globalThis as { Capacitor?: { Plugins?: NativePlugins } }).Capacitor?.Plugins;
}

function readTabs(): ShellState {
  const bar = document.querySelector<HTMLElement>(".workspace-app[data-phone] .phone-tabbar");
  const buttons = bar ? [...bar.querySelectorAll<HTMLElement>(".phone-tabbar__tab")] : [];
  const tabs = buttons.map((button) => ({
    id: button.id.replace(/^phone-tab-/, ""),
    label: button.querySelector(".phone-tabbar__label")?.textContent?.trim() ?? "",
    badge: Boolean(button.querySelector(".phone-tabbar__dot")),
  }));
  const selected = buttons.find((button) => button.getAttribute("aria-selected") === "true");
  return {
    tabs,
    selected: selected?.id.replace(/^phone-tab-/, ""),
    hidden: !bar || bar.hasAttribute("data-hidden"),
  };
}

function mirrorTabBar(setTabs: NonNullable<NonNullable<NativePlugins["TripShell"]>["setTabs"]>) {
  const root = document.documentElement;
  let sent = "";
  let frame = 0;
  const sync = () => {
    frame = 0;
    const state = readTabs();
    const key = JSON.stringify(state);
    if (key === sent) return;
    sent = key;
    setTabs(state)
      .then(({ height }) => {
        root.dataset.nativeTabbar = "";
        if (height > 0) root.style.setProperty("--native-tabbar-height", `${height}px`);
      })
      .catch(() => {
        delete root.dataset.nativeTabbar;
      });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected", "data-hidden", "data-phone"],
  });
  schedule();
  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}

export function IosAppBridge() {
  useEffect(() => {
    const plugins = nativePlugins();
    if (!plugins) return;
    plugins.Keyboard?.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {});
    const stopMirror = plugins.TripShell?.setTabs
      ? mirrorTabBar(plugins.TripShell.setTabs.bind(plugins.TripShell))
      : undefined;

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
    return () => {
      stopMirror?.();
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);
  return null;
}
