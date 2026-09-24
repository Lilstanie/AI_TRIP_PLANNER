/**
 * A small category for a Google place, used for the icon on its map label. Derived from the
 * place's `primaryType`; anything unrecognised is a plain pin. Never used to invent a place.
 */
export type PlaceCategory = "food" | "museum" | "nature" | "landmark" | "shopping" | "stay" | "pin";

const groups: [PlaceCategory, RegExp][] = [
  ["food", /restaurant|cafe|coffee|bakery|bar\b|_bar|food|meal|dessert|tea_house|pub/],
  ["museum", /museum|art_gallery|gallery|library|cultural/],
  ["nature", /park|garden|beach|national|zoo|aquarium|hiking|nature|botanical|lake|mountain/],
  ["stay", /hotel|lodging|hostel|inn\b|resort|guest_house|motel|bed_and_breakfast/],
  ["shopping", /shopping|market|store|mall|shop/],
  ["landmark", /tourist|landmark|monument|church|temple|shrine|castle|palace|bridge|tower|plaza/],
];

export function placeCategory(primaryType: string | undefined): PlaceCategory {
  if (!primaryType) return "pin";
  return groups.find(([, pattern]) => pattern.test(primaryType))?.[0] ?? "pin";
}

/** 24 × 24 stroke paths, drawn like the workspace icon set. */
export const categoryIconPaths: Record<PlaceCategory, string[]> = {
  food: ["M7 3v8a2 2 0 0 0 2 2v8", "M11 3v8", "M7 7h4", "M17 21V3c-2 1-3 4-3 7h3"],
  museum: ["M3 9 12 4l9 5", "M5 9v9M9.5 9v9M14.5 9v9M19 9v9", "M3 20h18"],
  nature: ["M12 21v-5", "M7 16h10L12 4 7 16Z"],
  landmark: ["M12 3v3", "M8 21 10 6h4l2 15", "M6 21h12", "M9.2 13h5.6"],
  shopping: ["M5 8h14l-1 12H6L5 8Z", "M9 8V6a3 3 0 0 1 6 0v2"],
  stay: ["M3 18V7", "M3 13h18v5", "M21 13v-2a3 3 0 0 0-3-3h-7v5", "M7 11.5h.01"],
  pin: [
    "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z",
    "M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z",
  ],
};

/** Build the category icon as DOM, for map marker content that lives outside React. */
export function categoryIcon(category: PlaceCategory) {
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
  for (const d of categoryIconPaths[category]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}
