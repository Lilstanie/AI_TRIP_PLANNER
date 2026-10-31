"use client";
import type { ComponentType } from "react";
import { RouteIcon, MapPinIcon, SuitcaseIcon, SlidersIcon, CalendarIcon } from "../ui/icons";
import { useLocale } from "@/components/account/LocaleProvider";
import type { TripPlan } from "@trip/shared";
import { buildItinerary } from "@/lib/trip/itinerary";
import { tripIdeas } from "@/lib/trip/ideas";
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
  const ideas = tripIdeas(plan).length;
  const preferences = draftPreferences(draft).length;
  const cards = [
    {
      id: "itinerary",
      icon: RouteIcon,
      label: t("itinerary"),
      count: stops > 0 ? String(stops) : "",
    },
    {
      id: "ideas",
      icon: MapPinIcon,
      label: t("ideas"),
      count: ideas > 0 ? String(ideas) : "",
    },
    {
      id: "bookings",
      icon: SuitcaseIcon,
      label: t("bookings"),
      count: "",
    },
    {
      id: "preferences",
      icon: SlidersIcon,
      label: t("tripPreferences"),
      count: preferences > 0 ? String(preferences) : "",
    },
    {
      id: "calendar",
      icon: CalendarIcon,
      label: t("calendar"),
      count: String(dayCount(plan)),
    },
  ] satisfies { id: TripAction; label: string; count: string; icon: ComponentType }[];
  return (
    <ul className="trip-home-cards trip-home__actions" aria-label={t("tripActions")}>
      {cards.map((card) => (
        <li key={card.id}>
          <button
            type="button"
            className="trip-home-card"
            data-card={card.id}
            onClick={(event) => onOpen(card.id, event.currentTarget)}
          >
            <card.icon />
            <span className="trip-home-card__label">{card.label}</span>
            {card.count && <span className="trip-home-card__count">{card.count}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
