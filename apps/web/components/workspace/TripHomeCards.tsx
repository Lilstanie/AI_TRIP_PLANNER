"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import type { TripPlan } from "@trip/shared";
import { buildItinerary } from "@/lib/trip/itinerary";
import { dayCount } from "@/lib/trip/timeline";
import type { Draft } from "@/lib/workspace/workspace";
import { draftPreferences } from "@/lib/workspace/workspace";
import type { TripAction } from "@/lib/workspace/layout";

export function TripHomeCards({
  plan,
  draft,
  onOpen,
}: {
  plan: TripPlan;
  draft: Draft;
  onOpen(action: TripAction, trigger: HTMLButtonElement): void;
}) {
  const { t } = useLocale();
  const itinerary = buildItinerary(plan, () => undefined);
  const stops = itinerary.stopCount;
  const ideas = itinerary.ideas().length;
  const preferences = draftPreferences(draft).length;
  const cards = [
    {
      id: "itinerary",
      label: t("Itinerary"),
      count: stops > 0 ? `${stops} ${t(stops === 1 ? "stop" : "stops")}` : "",
    },
    {
      id: "ideas",
      label: t("Ideas"),
      count: ideas > 0 ? t(ideas === 1 ? "1 idea" : "{v0} ideas", { v0: ideas }) : "",
    },
    {
      id: "bookings",
      label: t("Bookings"),
      count: "",
    },
    {
      id: "preferences",
      label: t("Trip preferences"),
      count:
        preferences > 0
          ? t(preferences === 1 ? "{count} preference" : "{count} preferences", {
              count: preferences,
            })
          : "",
    },
    {
      id: "calendar",
      label: t("Calendar"),
      count: t(dayCount(plan) === 1 ? "{count} day" : "{count} days", { count: dayCount(plan) }),
    },
  ] satisfies { id: TripAction; label: string; count: string }[];
  return (
    <ul className="trip-home-cards trip-home__actions" aria-label={t("Trip actions")}>
      {cards.map((card) => (
        <li key={card.id}>
          <button
            type="button"
            className="trip-home-card"
            data-card={card.id}
            onClick={(event) => onOpen(card.id, event.currentTarget)}
          >
            <span className="trip-home-card__label">{card.label}</span>
            {card.count && <span className="trip-home-card__count">{card.count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
