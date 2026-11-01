"use client";
import { useEffect, useState, type ReactNode } from "react";
import { FirstVisitIntro } from "./FirstVisitIntro";

export const INTRO_SEEN_KEY = "trip.intro.seen.v1";

function introSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

function rememberIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, new Date().toISOString());
  } catch {
    return;
  }
}

/**
 * Shows the intro instead of `children` on a browser's first visit, or whenever the URL carries
 * `?intro`. Automated browsers (`navigator.webdriver`) skip it unless `?intro` asks for it.
 */
export function IntroGate({ children }: { children: ReactNode }) {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).has("intro");
    setShowIntro(forced || (!introSeen() && !navigator.webdriver));
  }, []);

  if (!showIntro) return children;
  return (
    <FirstVisitIntro
      onStart={() => {
        rememberIntroSeen();
        const url = new URL(window.location.href);
        url.searchParams.delete("intro");
        window.history.replaceState(null, "", url);
        setShowIntro(false);
      }}
    />
  );
}
