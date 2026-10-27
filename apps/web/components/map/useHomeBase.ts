"use client";
import { useEffect, useState } from "react";
import { dataModeHeaders, type DataMode } from "@/lib/workspace/data-mode";
import type { GooglePlace } from "@/lib/integrations/google";
import type { Coordinate } from "./useUserLocation";

export function useHomeBase(
  homeCity: string,
  dataMode: DataMode | undefined,
  language: "en" | "zh",
): Coordinate | undefined {
  const [found, setFound] = useState<{ key: string; position: Coordinate }>();
  const key = `${homeCity}|${dataMode ?? ""}|${language}`;

  useEffect(() => {
    if (!homeCity) return;
    const controller = new AbortController();
    void fetch("/api/places/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...dataModeHeaders(dataMode) },
      body: JSON.stringify({ text: homeCity, language }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body: { places?: GooglePlace[] } | undefined) => {
        const location = body?.places?.find((place) => place.location)?.location;
        if (location && !controller.signal.aborted)
          setFound({ key, position: { lat: location.latitude, lng: location.longitude } });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [homeCity, dataMode, language, key]);

  return homeCity && found?.key === key ? found.position : undefined;
}
