"use client";
import { useCallback, useEffect, useState } from "react";

export type DataMode = "mock" | "live";

export type DataModeProviders = { hotelsAndFlights: boolean; maps: boolean };

const STORAGE_KEY = "trip.dataMode";

function stored(): DataMode | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "mock" || value === "live" ? value : undefined;
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return undefined;
  }
}

/**
 * Which data the planner should use: bundled fixtures, or the real providers.
 *
 * The traveller's choice lives in this browser and rides along on each planning
 * request as a header, so it never has to be a redeploy. Until the server has
 * reported its own default, the mode is `undefined` and the toggle renders as
 * pending rather than guessing and flipping a moment later.
 */
export function useDataMode() {
  const [mode, setMode] = useState<DataMode>();
  const [providers, setProviders] = useState<DataModeProviders>();

  useEffect(() => {
    let active = true;
    void (async () => {
      let body: { configured?: string; providers?: DataModeProviders } | undefined;
      try {
        const response = await fetch("/api/data-mode");
        if (response?.ok) body = await response.json();
      } catch {
        // Learning the server's default is a convenience. If the probe fails,
        // fall back to mock — the safe side, since live mode spends quota.
      }
      if (!active) return;
      setProviders(body?.providers);
      setMode(stored() ?? (body?.configured === "live" ? "live" : "mock"));
    })();
    return () => {
      active = false;
    };
  }, []);

  const choose = useCallback((next: DataMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A remembered preference is a convenience; the session still works.
    }
  }, []);

  return { mode, providers, choose };
}

/** Header sent with planning requests so the server honours the choice. */
export function dataModeHeaders(mode: DataMode | undefined): Record<string, string> {
  return mode ? { "x-trip-data-mode": mode } : {};
}
