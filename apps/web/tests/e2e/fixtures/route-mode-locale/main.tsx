import "@/app/globals.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SettingsProvider, useSettings } from "@/components/account/SettingsProvider";
import { LocaleProvider } from "@/components/account/LocaleProvider";
import { TripMap, type MapStop } from "@/components/map/TripMap";
import type { RouteResult } from "@/lib/integrations/google";

const stops: MapStop[] = [
  {
    place: {
      id: "a",
      displayName: { text: "A" },
      location: { latitude: -33.86, longitude: 151.2 },
    },
    number: 1,
    day: 1,
  },
  {
    place: {
      id: "b",
      displayName: { text: "B" },
      location: { latitude: -33.87, longitude: 151.21 },
    },
    number: 2,
    day: 1,
  },
  {
    place: {
      id: "c",
      displayName: { text: "C" },
      location: { latitude: -33.88, longitude: 151.22 },
    },
    number: 3,
    day: 1,
  },
  {
    place: {
      id: "d",
      displayName: { text: "D" },
      location: { latitude: -33.89, longitude: 151.23 },
    },
    number: 4,
    day: 2,
  },
  {
    place: {
      id: "e",
      displayName: { text: "E" },
      location: { latitude: -33.9, longitude: 151.24 },
    },
    number: 5,
    day: 2,
  },
  {
    place: {
      id: "f",
      displayName: { text: "F" },
      location: { latitude: -33.91, longitude: 151.25 },
    },
    number: 6,
    day: 2,
  },
  {
    place: {
      id: "g",
      displayName: { text: "G" },
      location: { latitude: -33.92, longitude: 151.26 },
    },
    number: 7,
    day: 2,
  },
];
const encodePath = (from: string, to: string) => {
  const points = [from, to].map((id) => {
    const stop = stops.find((candidate) => candidate.place.id === id)!;
    return [stop.place.location!.latitude, stop.place.location!.longitude];
  });
  let previousLat = 0;
  let previousLng = 0;
  let encoded = "";
  const encode = (value: number) => {
    let current = value < 0 ? ~(value << 1) : value << 1;
    while (current >= 0x20) {
      encoded += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
      current >>= 5;
    }
    encoded += String.fromCharCode(current + 63);
  };
  for (const [latitude, longitude] of points) {
    const lat = Math.round(latitude * 1e5);
    const lng = Math.round(longitude * 1e5);
    encode(lat - previousLat);
    encode(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return encoded;
};
const routes: RouteResult[] = [
  { from: "a", to: "b", mode: "WALK", status: "ok", polyline: encodePath("a", "b") },
  { from: "b", to: "c", mode: "TRANSIT", status: "ok", polyline: encodePath("b", "c") },
  { from: "d", to: "e", mode: "DRIVE", status: "ok", polyline: encodePath("d", "e") },
  { from: "e", to: "f", mode: "BICYCLE", status: "ok", polyline: encodePath("e", "f") },
];

function Controls() {
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<string>();
  return (
    <>
      <nav>
        <button onClick={() => update({ language: "en" })}>English</button>
        <button onClick={() => update({ language: "zh" })}>中文</button>
        <button onClick={() => setSelected(undefined)}>All days</button>
        <button onClick={() => setSelected("a")}>Day one</button>
        <button onClick={() => setSelected("d")}>Day two</button>
      </nav>
      <output data-testid="locale">{settings.language ?? "en"}</output>
      <TripMap
        mockData
        forceOsmProvider
        stops={stops}
        routes={routes}
        selected={selected}
        onSelect={setSelected}
        phone={window.innerWidth <= 520}
        userLocation={{
          location: { status: "idle" },
          request: () => {},
        }}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <LocaleProvider>
      <main>
        <Controls />
      </main>
    </LocaleProvider>
  </SettingsProvider>,
);
