import type { MessageKey } from "@/lib/i18n/locale";
import type { RouteMode } from "@/lib/integrations/google";

export const routeModeIconPaths: Record<RouteMode, string[]> = {
  WALK: [
    "M15 4a2 2 0 1 0-4 0 2 2 0 1 0 4 0",
    "m8 22 3-7 3 3v4",
    "M11 15 12 9l3 3h3",
    "M12 9 8 11v3",
  ],
  TRANSIT: [
    "M8 6v6",
    "M15 6v6",
    "M2 12h19.6",
    "M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3",
    "M9 18a2 2 0 1 0-4 0 2 2 0 1 0 4 0",
    "M9 18h5",
    "M18 18a2 2 0 1 0-4 0 2 2 0 1 0 4 0",
  ],
  DRIVE: [
    "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",
    "M9 17a2 2 0 1 0-4 0 2 2 0 1 0 4 0",
    "M9 17h6",
    "M19 17a2 2 0 1 0-4 0 2 2 0 1 0 4 0",
  ],
  BICYCLE: [
    "M9 17a4 4 0 1 0-8 0 4 4 0 1 0 8 0",
    "M23 17a4 4 0 1 0-8 0 4 4 0 1 0 8 0",
    "m5 17 5-9 5 9H5m5-9h6l3 9M8 5h4m4 3-1-4h3",
  ],
};

export const routeModeLabel: Record<RouteMode, MessageKey> = {
  WALK: "walk",
  TRANSIT: "publicTransport",
  DRIVE: "drive",
  BICYCLE: "cycle",
};

export function routeModeIcon(mode: RouteMode) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  for (const d of routeModeIconPaths[mode]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}
