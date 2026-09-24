"use client";
import {
  coveredByItinerary,
  curvedPath,
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
  if (day !== undefined) content.style.setProperty("--day-color", `var(${dayToken(day)})`);
  return content;
}

export function markerTitle(place: GooglePlace, order: number, day?: number) {
  return `${order}. ${placeName(place)}${day ? ` · Day ${day}` : ""}`;
}

const DAY_COLOURS = 7;
/** The token for a day's colour; days past the palette wrap round it. */
export function dayToken(day: number) {
  return `--day-${((Math.max(1, day) - 1) % DAY_COLOURS) + 1}`;
}

/** Route colours come from the design tokens on the map element, so they follow light and dark. */
export function routeColors(element: HTMLElement) {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    day: (day?: number) =>
      day === undefined ? token("--accent-fill", "#0071e3") : token(dayToken(day), "#0071e3"),
    muted: token("--text-dim", "#6e6e73"),
    casing: token("--route-casing", "rgba(255,255,255,0.92)"),
  };
}
export type RouteColors = ReturnType<typeof routeColors>;

/** White dashes that march along the line, showing the direction of travel. */
const DASH = { path: "M 0,-1 0,1", strokeOpacity: 0.95, strokeColor: "#ffffff", scale: 2 };
/** A chevron at the middle of each leg, pointing to the next stop. */
const ARROW = {
  path: "M -2.2,1.6 0,-0.6 2.2,1.6",
  strokeColor: "#ffffff",
  strokeOpacity: 1,
  strokeWeight: 2.2,
  scale: 1.6,
};

/**
 * Draw each itinerary day through its stops, Apple Maps style. Every leg without a verified route
 * is a gentle arc (`curvedPath`) rather than a straight segment; a verified leg keeps Google's
 * real geometry. The focused day (the selected stop's day, or every day when nothing is selected)
 * is drawn in its day colour over a casing, with a direction chevron on each leg and dashes that
 * flow from stop to stop; other days stay a quiet thin grey line. Returns a cleanup that stops the
 * animation and removes the lines.
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
  colors: RouteColors;
  reducedMotion: boolean;
}) {
  const { maps, map } = runtime;
  const drawn: MapPolyline[] = [];
  const flowing: MapPolyline[] = [];
  for (const line of lines) {
    const active = focusDay === undefined || line.day === focusDay;
    const color = active ? colors.day(line.day) : colors.muted;
    for (const leg of line.legs) {
      const path = leg.polyline
        ? maps.geometry.encoding.decodePath(leg.polyline)
        : curvedPath(leg.from.position, leg.to.position);
      if (!active) {
        drawn.push(
          new maps.Polyline({
            map,
            path,
            clickable: false,
            strokeColor: color,
            strokeOpacity: 0.5,
            strokeWeight: 3,
            zIndex: 1,
          }),
        );
        continue;
      }
      drawn.push(
        new maps.Polyline({
          map,
          path,
          clickable: false,
          strokeColor: colors.casing,
          strokeOpacity: 1,
          strokeWeight: 9,
          zIndex: 2,
        }),
        new maps.Polyline({
          map,
          path,
          clickable: false,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 5,
          zIndex: 3,
          icons: [{ icon: { ...ARROW, fillColor: color }, offset: "50%" }],
        }),
      );
      const dashes = new maps.Polyline({
        map,
        path,
        clickable: false,
        strokeOpacity: 0,
        zIndex: 4,
        icons: [{ icon: DASH, offset: "0px", repeat: `${FLOW_REPEAT_PX}px` }],
      });
      drawn.push(dashes);
      flowing.push(dashes);
    }
  }
  // Verified routes that are not an itinerary leg (for example an edit preview) stay solid lines.
  for (const route of routes) {
    if (route.status !== "ok" || !route.polyline || coveredByItinerary(route, lines)) continue;
    drawn.push(
      new maps.Polyline({
        map,
        path: maps.geometry.encoding.decodePath(route.polyline),
        clickable: false,
        strokeColor: colors.day(),
        strokeWeight: 4,
      }),
    );
  }
  const stop = flowing.length
    ? startFlow((offset) => {
        for (const line of flowing)
          line.setOptions({
            icons: [
              { icon: DASH, offset: `${offset.toFixed(1)}px`, repeat: `${FLOW_REPEAT_PX}px` },
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
