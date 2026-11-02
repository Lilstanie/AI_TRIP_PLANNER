import type { InterfaceLanguage } from "@trip/shared";

export type ReusedPlace = { location: string; days: number[] };

const NAMED = 3;

/** One sentence for the fallback reply; empty when nothing repeats. */
export function reusedPlacesNote(places: ReusedPlace[], language: InterfaceLanguage): string {
  if (!places.length) return "";
  const zh = language === "zh";
  const days = (place: ReusedPlace) =>
    zh
      ? place.days.map((day) => `第 ${day} 天`).join("、")
      : place.days.map((day) => `Day ${day}`).join(", ");
  if (places.length === 1) {
    const [place] = places as [ReusedPlace];
    return zh
      ? `行程在${days(place)}重复使用了同一站点 ${place.location}，这是同一个地方，不是不同的活动。`
      : `The plan reuses the same stop, ${place.location}, on ${days(place)}; this is one place repeated, not distinct activities.`;
  }
  const named = places
    .slice(0, NAMED)
    .map((place) =>
      zh ? `${place.location}（${days(place)}）` : `${place.location} (${days(place)})`,
    );
  const rest = places.length - named.length;
  return zh
    ? `有 ${places.length} 个站点在不同天重复出现：${named.join("、")}${rest ? `等` : ""}。这些是同一个地方，不是不同的活动。`
    : `${places.length} stops repeat on more than one day: ${named.join("; ")}${rest ? `; and ${rest} more` : ""}. Each is one place repeated, not distinct activities.`;
}
