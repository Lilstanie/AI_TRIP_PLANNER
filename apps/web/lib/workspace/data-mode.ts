"use client";
import { useEffect, useState } from "react";

export type DataMode = "mock" | "live";

export type DataModeProviders = {
  hotelsAndFlights: boolean;
  maps: boolean;
  webMapsProvider?: "google" | "osm" | "google-with-fallback";
  mockGoogleUnavailable?: boolean;
};

export function useDataMode(preferred: DataMode) {
  const [providers, setProviders] = useState<DataModeProviders>();
  const [liveAvailable, setLiveAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      let body: { liveAvailable?: boolean; providers?: DataModeProviders } | undefined;
      try {
        const response = await fetch("/api/data-mode");
        if (response?.ok) body = await response.json();
      } catch {}
      if (!active) return;
      setProviders(body?.providers);
      setLiveAvailable(body?.liveAvailable !== false);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const mode: DataMode | undefined = loaded
    ? preferred === "live" && liveAvailable
      ? "live"
      : "mock"
    : undefined;
  return { mode, providers, liveAvailable };
}

export function mapProviderOptions(mode: DataMode | undefined, providers?: DataModeProviders) {
  return {
    forceOsm:
      providers?.webMapsProvider === "osm" ||
      (mode === "mock" && !!providers?.mockGoogleUnavailable),
    allowFallback: providers?.webMapsProvider !== "google",
  };
}

export function dataModeHeaders(mode: DataMode | undefined): Record<string, string> {
  return mode ? { "x-trip-data-mode": mode } : {};
}
