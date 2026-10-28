"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { buildItinerary } from "@/lib/trip/itinerary";
import type { TripRecord } from "@/lib/workspace/catalog";
import { draftPreferences } from "@/lib/workspace/workspace";

export function TripHomeCards({
  trip,
  onItinerary,
  onCalendar,
  onPreferences,
}: {
  trip: TripRecord;
  onItinerary(): void;
  onCalendar(): void;
  onPreferences(): void;
}) {
  const { t } = useLocale();
  const { plan, draft } = trip.snapshot;
  if (!plan) return null;
  const stops = buildItinerary(plan, () => undefined).stopCount;
  const preferences = draftPreferences(draft).length;
  const cards = [
    {
      id: "itinerary",
      label: t("Itinerary"),
      count: stops > 0 ? `${stops} ${t(stops === 1 ? "stop" : "stops")}` : "",
      open: onItinerary,
    },
    { id: "calendar", label: t("Calendar"), count: "", open: onCalendar },
    {
      id: "preferences",
      label: t("Preferences"),
      count:
        preferences > 0
          ? t(preferences === 1 ? "{count} preference" : "{count} preferences", {
              count: preferences,
            })
          : "",
      open: onPreferences,
    },
  ];
  return (
    <ul className="trip-home-cards" aria-label={t("Trip sections")}>
      {cards.map((card) => (
        <li key={card.id}>
          <button type="button" className="trip-home-card" data-card={card.id} onClick={card.open}>
            <span className="trip-home-card__label">{card.label}</span>
            {card.count && <span className="trip-home-card__count">{card.count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
