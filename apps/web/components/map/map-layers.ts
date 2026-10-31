"use client";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import {
  coveredByItinerary,
  curvedPath,
  FLOW_REPEAT_PX,
  startFlow,
  type Coordinate,
  type DayRoute,
} from "@/lib/map/itinerary-route";
import { categoryIcon, placeCategory } from "@/lib/map/place-category";
import { routeModeIcon, routeModeLabel } from "@/lib/map/route-mode";
import type { GooglePlace, RouteMode, RouteResult } from "@/lib/integrations/google";
import type { MapMarker, MapPolyline, MapRuntime } from "./google-maps-sdk";

export function placeName(place: GooglePlace) {
  return place.displayName?.text ?? place.formattedAddress ?? "Activity";
}

export function markerContent(place: GooglePlace, number: number, day?: number) {
  const name = placeName(place);
  const content = document.createElement("span");
  content.className = "trip-map-marker";
  const badge = document.createElement("span");
  badge.className = "trip-map-marker__badge";
  badge.textContent = String(number);
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

export function markerTitle(
  place: GooglePlace,
  number: number,
  day?: number,
  locale: AppLocale = "en",
) {
  return `${number}. ${placeName(place)}${day ? ` · ${translate(locale, "Day {v0}", { v0: day })}` : ""}`;
}

const DAY_COLOURS = 7;

export function dayToken(day: number) {
  return `--day-${((Math.max(1, day) - 1) % DAY_COLOURS) + 1}`;
}

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

const DASH = { path: "M 0,-1 0,1", strokeOpacity: 0.95, strokeColor: "#ffffff", scale: 2 };

const ARROW = {
  path: "M -2.2,1.6 0,-0.6 2.2,1.6",
  strokeColor: "#ffffff",
  strokeOpacity: 1,
  strokeWeight: 2.2,
  scale: 1.6,
};

function modeBadge(
  runtime: MapRuntime,
  leg: { from: { position: Coordinate }; to: { position: Coordinate } },
  mode: RouteMode,
  locale: AppLocale,
) {
  const content = document.createElement("span");
  content.className = "trip-map-leg-mode";
  content.appendChild(routeModeIcon(mode));
  const marker = new runtime.maps.marker.AdvancedMarkerElement({
    map: runtime.map,
    position: {
      lat: (leg.from.position.lat + leg.to.position.lat) / 2,
      lng: (leg.from.position.lng + leg.to.position.lng) / 2,
    },
    title: translate(locale, routeModeLabel[mode]),
    content,
  });
  marker.zIndex = 0;
  return marker;
}

export function drawItineraryRoutes({
  runtime,
  lines,
  routes,
  focusDay,
  colors,
  reducedMotion,
  animationEnabled = !reducedMotion,
  locale = "en",
}: {
  runtime: MapRuntime;
  lines: DayRoute[];
  routes: RouteResult[];
  focusDay?: number;
  colors: RouteColors;
  reducedMotion: boolean;
  animationEnabled?: boolean;
  locale?: AppLocale;
}) {
  const { maps, map } = runtime;
  const drawn: MapPolyline[] = [];
  const flowing: MapPolyline[] = [];
  const badges: MapMarker[] = [];
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
      if (runtime.provider !== "osm") {
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
      if (leg.mode) badges.push(modeBadge(runtime, leg, leg.mode, locale));
    }
  }

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
  let enabled = animationEnabled;
  let disposed = false;
  let stop: (() => void) | undefined;
  const updateAnimation = () => {
    const shouldRun = enabled && !reducedMotion && !document.hidden && flowing.length > 0;
    if (disposed || !shouldRun) {
      stop?.();
      stop = undefined;
    } else if (!stop) {
      stop = startFlow((offset) => {
        for (const line of flowing)
          line.setOptions({
            icons: [
              { icon: DASH, offset: `${offset.toFixed(1)}px`, repeat: `${FLOW_REPEAT_PX}px` },
            ],
          });
      }, false);
    }
  };
  if (flowing.length) document.addEventListener("visibilitychange", updateAnimation);
  updateAnimation();
  return Object.assign(
    () => {
      disposed = true;
      stop?.();
      stop = undefined;
      document.removeEventListener("visibilitychange", updateAnimation);
      drawn.forEach((line) => line.setMap(null));
      badges.forEach((badge) => {
        runtime.removeMarker(badge);
      });
    },
    {
      setAnimationEnabled(value: boolean) {
        enabled = value;
        updateAnimation();
      },
    },
  );
}

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
