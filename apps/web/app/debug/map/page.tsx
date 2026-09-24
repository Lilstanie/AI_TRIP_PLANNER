"use client";
import { notFound } from "next/navigation";
import { useState } from "react";
import { TripMap, type MapStop } from "@/components/map/TripMap";
import { useUserLocation } from "@/components/map/useUserLocation";
import type { GooglePlace } from "@/lib/integrations/google";

const place = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  primaryType?: string,
) =>
  ({
    id,
    displayName: { text: name },
    location: { latitude, longitude },
    primaryType,
  }) as GooglePlace;

/** A three-day Sydney itinerary with fixed coordinates: no Places lookup is made. */
const STOPS: MapStop[] = [
  {
    place: place("qvb", "Queen Victoria Building", -33.8718, 151.2067, "shopping_mall"),
    order: 1,
    day: 1,
  },
  {
    place: place("tower", "Sydney Tower Eye", -33.8705, 151.2089, "tourist_attraction"),
    order: 2,
    day: 1,
  },
  {
    place: place("darling", "Darling Harbour", -33.8748, 151.1987, "tourist_attraction"),
    order: 3,
    day: 1,
  },
  {
    place: place("opera", "Sydney Opera House", -33.8568, 151.2153, "performing_arts_theater"),
    order: 4,
    day: 2,
  },
  { place: place("gardens", "Royal Botanic Garden", -33.8642, 151.2166, "park"), order: 5, day: 2 },
  { place: place("rocks", "The Rocks Markets", -33.8599, 151.209, "market"), order: 6, day: 2 },
  { place: place("bondi", "Bondi Beach", -33.8908, 151.2743, "beach"), order: 7, day: 3 },
  { place: place("coogee", "Coogee Beach", -33.9205, 151.2577, "beach"), order: 8, day: 3 },
];

/**
 * Development surface for the trip map: markers, day-coloured curved routes and the control
 * stack, over real Google tiles but without Places or pricing requests. Development-only.
 */
export default function MapDebugPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const userLocation = useUserLocation();
  const [selected, setSelected] = useState<string>();
  return (
    <main style={{ height: "100dvh", padding: 8, background: "var(--ambient), var(--page)" }}>
      <div className="workspace-panel workspace-panel--map" style={{ height: "100%", margin: 0 }}>
        <section className="trip-map-canvas" aria-label="Trip map">
          <TripMap
            stops={STOPS}
            selected={selected}
            onSelect={setSelected}
            routes={[]}
            viewKey="debug-sydney"
            userLocation={userLocation}
          />
        </section>
      </div>
    </main>
  );
}
