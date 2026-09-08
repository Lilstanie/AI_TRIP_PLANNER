"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapPlace, TripMapData } from "@trip/shared";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { filterTripMap, mapDays } from "./map-data";

const EMPTY_MAP: TripMapData = { places: [], routes: [], unresolved: [] };
const TILE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const MARKER_LABEL: Record<MapPlace["category"], string> = {
  activity: "Activity",
  transport: "Transport",
  hotel: "Stay",
  meal: "Meal",
  destination: "Destination",
  other: "Place",
};

function routeGeoJson(map: TripMapData) {
  return {
    type: "FeatureCollection" as const,
    features: map.routes.map((route) => ({
      type: "Feature" as const,
      properties: { id: route.id, conflict: route.conflict },
      geometry: { type: "LineString" as const, coordinates: route.coordinates },
    })),
  };
}

function addRouteLayers(map: MapLibreMap, data: TripMapData): void {
  if (map.getSource("trip-routes")) return;
  map.addSource("trip-routes", { type: "geojson", data: routeGeoJson(data) });
  map.addLayer({
    id: "trip-routes",
    type: "line",
    source: "trip-routes",
    filter: ["==", ["get", "conflict"], false],
    paint: { "line-color": "#4f46e5", "line-width": 4, "line-opacity": 0.74 },
  });
  map.addLayer({
    id: "trip-routes-conflict",
    type: "line",
    source: "trip-routes",
    filter: ["==", ["get", "conflict"], true],
    paint: {
      "line-color": "#d97706",
      "line-width": 4,
      "line-opacity": 0.9,
      "line-dasharray": [1.2, 1.2],
    },
  });
}

function focusPlaces(map: MapLibreMap, places: MapPlace[]): void {
  if (!places.length) return;
  if (places.length === 1) {
    const place = places[0]!;
    map.easeTo({
      center: [place.coordinates.longitude, place.coordinates.latitude],
      zoom: 13,
      duration: 500,
    });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  for (const place of places) {
    bounds.extend([place.coordinates.longitude, place.coordinates.latitude]);
  }
  map.fitBounds(bounds, { padding: 62, maxZoom: 13, duration: 500 });
}

export interface TripMapProps {
  mapData?: TripMapData;
  selectedItemId?: string;
  onSelect: (itemId: string, sectionId: string) => void;
}

export function TripMap({ mapData = EMPTY_MAP, selectedItemId, onSelect }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<number | undefined>();
  const days = useMemo(() => mapDays(mapData), [mapData]);
  const visible = useMemo(() => filterTripMap(mapData, day), [mapData, day]);
  const selectedPlace = visible.places.find((place) => place.itemId === selectedItemId);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: [139.6917, 35.6895],
      zoom: 3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left");
    map.on("load", () => setReady(true));
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const selected = mapData.places.find((place) => place.itemId === selectedItemId);
    if (selected) setDay(selected.day);
  }, [mapData.places, selectedItemId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    addRouteLayers(map, visible);
    (map.getSource("trip-routes") as GeoJSONSource).setData(routeGeoJson(visible));

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = visible.places.map((place) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `map-marker map-marker--${place.category}${
        place.conflict ? " map-marker--conflict" : ""
      }${place.itemId === selectedItemId ? " map-marker--selected" : ""}`;
      const label = document.createElement("span");
      label.textContent = place.day ? String(place.day) : "•";
      element.append(label);
      element.setAttribute("aria-label", `${MARKER_LABEL[place.category]}: ${place.name}`);
      element.addEventListener("click", () => {
        if (place.itemId && place.sectionId) onSelect(place.itemId, place.sectionId);
      });
      return new maplibregl.Marker({ element })
        .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
        .addTo(map);
    });

    const selected = visible.places.find((place) => place.itemId === selectedItemId);
    if (selected) {
      map.flyTo({
        center: [selected.coordinates.longitude, selected.coordinates.latitude],
        zoom: Math.max(map.getZoom(), 12),
        duration: 650,
      });
    } else {
      focusPlaces(map, visible.places);
    }
  }, [onSelect, ready, selectedItemId, visible]);

  return (
    <section className="trip-map" aria-label="Interactive trip map">
      <div className="trip-map__topbar">
        <div>
          <strong>Trip map</strong>
          <span>
            {visible.places.length} places · {visible.routes.length} routes
          </span>
        </div>
        <div className="day-filter" aria-label="Filter map by day">
          <button
            type="button"
            className={day === undefined ? "is-active" : ""}
            onClick={() => setDay(undefined)}
            aria-pressed={day === undefined}
          >
            All
          </button>
          {days.map((value) => (
            <button
              key={value}
              type="button"
              className={day === value ? "is-active" : ""}
              onClick={() => setDay(value)}
              aria-pressed={day === value}
            >
              Day {value}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="trip-map__canvas" />

      {mapData.places.length === 0 && (
        <div className="trip-map__empty">
          <strong>Map locations unavailable</strong>
          <span>The trip plan is still ready to review.</span>
        </div>
      )}

      {selectedPlace && (
        <div className="map-detail" role="status">
          <span className={`map-detail__type map-detail__type--${selectedPlace.category}`}>
            {MARKER_LABEL[selectedPlace.category]}
          </span>
          <strong>{selectedPlace.name}</strong>
          {(selectedPlace.startTime || selectedPlace.day) && (
            <small>
              {selectedPlace.day ? `Day ${selectedPlace.day}` : ""}
              {selectedPlace.startTime
                ? ` · ${selectedPlace.startTime}–${selectedPlace.endTime}`
                : ""}
            </small>
          )}
          <span>{selectedPlace.detail}</span>
        </div>
      )}

      <div className="map-legend" aria-label="Map legend">
        <span>
          <i className="legend-dot legend-dot--activity" />
          Activity
        </span>
        <span>
          <i className="legend-dot legend-dot--transport" />
          Transport
        </span>
        <span>
          <i className="legend-dot legend-dot--hotel" />
          Stay
        </span>
        {mapData.unresolved.length > 0 && (
          <span title={`${mapData.unresolved.length} locations could not be mapped`}>
            {mapData.unresolved.length} unmapped
          </span>
        )}
      </div>
    </section>
  );
}
