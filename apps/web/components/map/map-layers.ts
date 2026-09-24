"use client";
import {
  coveredByItinerary,
  FLOW_REPEAT_PX,
  startFlow,
  type Coordinate,
  type DayRoute,
} from "@/lib/map/itinerary-route";
import { categoryIcon, placeCategory } from "@/lib/map/place-category";
import type { GooglePlace, RouteResult } from "@/lib/integrations/google";
import type { MapPolyline, MapRuntime } from "./google-maps-sdk";

export function placeName(place: GooglePlace) {
  return place.displayName?.text ?? place.formattedAddress ?? "Activity";
}

/**
 * A marker's content: the stop number in a round badge and a label pill with the place's category
 * icon and name. Built as plain DOM because Google renders marker content outside React.
 */
export function markerContent(place: GooglePlace, order: number, day?: number) {
  const name = placeName(place);
  const content = document.createElement("span");
  content.className = "trip-map-marker";
  const badge = document.createElement("span");
  badge.className = "trip-map-marker__badge";
  badge.textContent = String(order);
  const label = document.createElement("span");
  label.className = "trip-map-marker__label";
  label.appendChild(categoryIcon(placeCategory(place.primaryType)));
  const text = document.createElement("span");
  text.className = "trip-map-marker__name";
  text.textContent = name;
  label.appendChild(text);
  content.append(badge, label);
  content.dataset.day = day === undefined ? "" : String(day);
  return content;
}

export function markerTitle(place: GooglePlace, order: number, day?: number) {
  return `${order}. ${placeName(place)}${day ? ` · Day ${day}` : ""}`;
}

/** Route colours come from the design tokens on the map element, so they follow light and dark. */
export function routeColors(element: HTMLElement) {
  const style = getComputedStyle(element);
  return {
    active: style.getPropertyValue("--accent").trim() || "#4f46e5",
    muted: style.getPropertyValue("--text-dim").trim() || "#626975",
  };
}

const DASH = { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 };

/**
 * Draw one line per itinerary day through its stops. The focused day (the selected stop's day, or
 * every day when nothing is selected) gets a solid underlay and dashes that flow from stop to stop;
 * other days stay a quiet static line. Returns a cleanup that stops the animation and removes lines.
 */
export function drawItineraryRoutes({
  runtime,
  lines,
  routes,
  focusDay,
  colors,
  reducedMotion,
}: {
  runtime: MapRuntime;
  lines: DayRoute[];
  routes: RouteResult[];
  focusDay?: number;
  colors: { active: string; muted: string };
  reducedMotion: boolean;
}) {
  const { maps, map } = runtime;
  const drawn: MapPolyline[] = [];
  const flowing: { line: MapPolyline; color: string }[] = [];
  for (const line of lines) {
    const path: Coordinate[] = [];
    for (const leg of line.legs) {
      const segment = leg.polyline
        ? maps.geometry.encoding.decodePath(leg.polyline)
        : [leg.from.position, leg.to.position];
      path.push(...(path.length ? segment.slice(1) : segment));
    }
    const active = focusDay === undefined || line.day === focusDay;
    const color = active ? colors.active : colors.muted;
    drawn.push(
      new maps.Polyline({
        map,
        path,
        clickable: false,
        strokeColor: color,
        strokeOpacity: active ? 0.35 : 0.45,
        strokeWeight: active ? 6 : 3,
        zIndex: active ? 2 : 1,
      }),
    );
    if (!active) continue;
    const dashes = new maps.Polyline({
      map,
      path,
      clickable: false,
      strokeOpacity: 0,
      zIndex: 3,
      icons: [
        { icon: { ...DASH, strokeColor: color }, offset: "0px", repeat: `${FLOW_REPEAT_PX}px` },
      ],
    });
    drawn.push(dashes);
    flowing.push({ line: dashes, color });
  }
  // Verified routes that are not an itinerary leg (for example an edit preview) stay solid lines.
  for (const route of routes) {
    if (route.status !== "ok" || !route.polyline || coveredByItinerary(route, lines)) continue;
    drawn.push(
      new maps.Polyline({
        map,
        path: maps.geometry.encoding.decodePath(route.polyline),
        clickable: false,
        strokeColor: colors.active,
        strokeWeight: 4,
      }),
    );
  }
  const stop = flowing.length
    ? startFlow((offset) => {
        for (const { line, color } of flowing)
          line.setOptions({
            icons: [
              {
                icon: { ...DASH, strokeColor: color },
                offset: `${offset.toFixed(1)}px`,
                repeat: `${FLOW_REPEAT_PX}px`,
              },
            ],
          });
      }, reducedMotion)
    : () => {};
  return () => {
    stop();
    drawn.forEach((line) => line.setMap(null));
  };
}

/**
 * Hide name labels that would overlap a label already shown, so a tight cluster reads as badges
 * rather than a pile of pills. The selected stop wins, then stops in visiting order. Runs when the
 * map settles, not per frame. Returns false when nothing could be measured yet (content not laid
 * out, or every label hidden), so the caller can try again shortly.
 */
export function declutterLabels(contents: HTMLElement[]) {
  const labels = contents.map((content) => ({
    content,
    label: content.querySelector<HTMLElement>(".trip-map-marker__label"),
  }));
  labels.forEach(({ content }) => content.classList.remove("is-crowded"));
  const ranked = [...labels].sort(
    (a, b) =>
      Number(b.content.classList.contains("is-selected")) -
      Number(a.content.classList.contains("is-selected")),
  );
  const shown: DOMRect[] = [];
  let measured = false;
  for (const { content, label } of ranked) {
    const box = label?.getBoundingClientRect();
    if (!box || !box.width) continue;
    measured = true;
    const hit = shown.some(
      (other) =>
        box.left < other.right &&
        box.right > other.left &&
        box.top < other.bottom &&
        box.bottom > other.top,
    );
    if (hit) content.classList.add("is-crowded");
    else shown.push(box);
  }
  return measured;
}
