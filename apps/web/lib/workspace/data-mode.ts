"use client";
import { useCallback, useEffect, useState } from "react";

export type DataMode = "mock" | "live";

export type DataModeProviders = {
  hotelsAndFlights: boolean;
  maps: boolean;
  webMapsProvider?: "google" | "osm" | "google-with-fallback";
  mockGoogleUnavailable?: boolean;
};

const STORAGE_KEY = "trip.dataMode";

function stored(): DataMode | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "mock" || value === "live" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function useDataMode(preferred?: DataMode) {
  const [mode, setMode] = useState<DataMode>();
  const [providers, setProviders] = useState<DataModeProviders>();

  useEffect(() => {
    let active = true;
    void (async () => {
      let body: { configured?: string; providers?: DataModeProviders } | undefined;
      try {
        const response = await fetch("/api/data-mode");
        if (response?.ok) body = await response.json();
      } catch {}
      if (!active) return;
      setProviders(body?.providers);
      setMode(stored() ?? preferred ?? (body?.configured === "live" ? "live" : "mock"));
    })();
    return () => {
      active = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback((next: DataMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  return { mode, providers, choose };
}

export function dataModeHeaders(mode: DataMode | undefined): Record<string, string> {
  return mode ? { "x-trip-data-mode": mode } : {};
}
