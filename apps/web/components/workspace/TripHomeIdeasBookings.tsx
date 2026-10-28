"use client";

import { useState } from "react";
import type { ProposalItem, TripPlan } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import {
  FlowAttractionIcon,
  FlowFlightIcon,
  FlowRestaurantIcon,
  FlowStayIcon,
} from "../ui/flow-icons";
import { buildItinerary } from "@/lib/trip/itinerary";
import { restaurantSuggestions } from "@/lib/trip/restaurants";
import { dayCount, dayLabel } from "@/lib/trip/timeline";
import { intlLocale, type AppLocale } from "@/lib/i18n/locale";

const titleOf = (item: ProposalItem) => item.location ?? item.detail;

const scheduleLabel = (locale: AppLocale, name: string, day: number) =>
  locale === "zh" ? `将 ${name} 安排到第 ${day} 天` : `Schedule ${name} on Day ${day}`;

function IdeaIcon({ restaurant }: { restaurant: boolean }) {
  const Icon = restaurant ? FlowRestaurantIcon : FlowAttractionIcon;
  return (
    <span className="trip-home-ideas-bookings__icon" aria-hidden="true">
      <Icon size={18} />
    </span>
  );
}

export function TripHomeIdeas({
  plan,
  onSchedule,
  disabled = false,
}: {
  plan: TripPlan;
  onSchedule(idea: ProposalItem, day: number): boolean | Promise<boolean>;
  disabled?: boolean;
}) {
  const { t, locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const restaurants = restaurantSuggestions(plan);
  const restaurantIds = new Set(restaurants.map((item) => item.id));
  const ideas = [...buildItinerary(plan, () => undefined).ideas(), ...restaurants];

  if (!ideas.length)
    return (
      <div className="trip-home-action trip-home-ideas-bookings">
        <p className="trip-home-action__empty">{t("No ideas yet.")}</p>
      </div>
    );

  const schedule = async (idea: ProposalItem, day: number) => {
    setBusy(true);
    try {
      await onSchedule(idea, day);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="trip-home-action trip-home-ideas-bookings">
      <ul className="trip-home-ideas-bookings__ideas" aria-label={t("Unscheduled suggestions")}>
        {ideas.map((idea, index) => {
          const title = titleOf(idea);
          return (
            <li className="trip-home-ideas-bookings__idea" key={idea.id ?? `${title}-${index}`}>
              <div className="trip-home-ideas-bookings__item-head">
                <IdeaIcon restaurant={!!idea.id && restaurantIds.has(idea.id)} />
                <span className="trip-home-ideas-bookings__item-copy">
                  <strong>{title}</strong>
                  {idea.detail !== title && <small>{idea.detail}</small>}
                </span>
              </div>
              <div
                className="trip-home-ideas-bookings__schedule"
                role="group"
                aria-label={t("Schedule on a day")}
              >
                {Array.from({ length: dayCount(plan) }, (_, index) => index + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled || busy}
                    aria-label={scheduleLabel(locale, title, day)}
                    title={dayLabel(plan, day, locale)}
                    onClick={() => void schedule(idea, day)}
                  >
                    <span>{t("Day {v0}", { v0: day })}</span>
                    <small>
                      {new Intl.DateTimeFormat(intlLocale(locale), {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      }).format(
                        Date.parse(`${plan.brief.dates[0]}T00:00:00Z`) + (day - 1) * 86400000,
                      )}
                    </small>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type BookingEntry = {
  id: string;
  title: string;
  meta: string;
};

function BookingGroup({
  label,
  icon,
  entries,
}: {
  label: string;
  icon: "activity" | "flight" | "stay";
  entries: BookingEntry[];
}) {
  if (!entries.length) return null;
  const Icon =
    icon === "flight" ? FlowFlightIcon : icon === "stay" ? FlowStayIcon : FlowAttractionIcon;
  return (
    <section className="trip-home-ideas-bookings__booking-group" aria-label={label}>
      <header>
        <span className="trip-home-ideas-bookings__icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <h3>{label}</h3>
        <span>{entries.length}</span>
      </header>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.title}</strong>
            {entry.meta && <small>{entry.meta}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TripHomeBookings({ plan }: { plan: TripPlan }) {
  const { t, money, locale } = useLocale();
  const transport = plan.sections.find((section) => section.id === "transport")?.proposal;
  const accommodation = plan.sections.find((section) => section.id === "accommodation")?.proposal;
  const flights = transport?.flights ?? [];
  const stays = accommodation?.stays ?? [];
  const flightIds = new Set(flights.map((selection) => selection.id));
  const stayIds = new Set(stays.map((selection) => selection.id));
  const seenActivities = new Set<string>();
  const activities = (
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? []
  )
    .filter((item) => {
      if (!item.booked || item.kind !== "activity") return false;
      const id = item.id ?? `${item.location}-${item.detail}`;
      if (seenActivities.has(id)) return false;
      seenActivities.add(id);
      return true;
    })
    .map((item, index): BookingEntry => ({
      id: item.id ?? `activity-${index}`,
      title: titleOf(item),
      meta: [
        item.day === undefined ? "" : t("Day {v0}", { v0: item.day }),
        [item.startTime, item.endTime].filter(Boolean).join("–"),
        t("Booked"),
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  const selectedFlights = flights.flatMap((selection) => {
    const candidate = selection.candidates.find((item) => item.id === selection.selectedId);
    return candidate ? [{ selection, candidate }] : [];
  });
  const selectedStays = stays.flatMap((selection) => {
    const candidate = selection.candidates.find((item) => item.id === selection.selectedId);
    return candidate ? [{ selection, candidate }] : [];
  });
  const legacyFlights = (transport?.items ?? []).filter(
    (item) => item.kind === "flight" && (!item.selectionId || !flightIds.has(item.selectionId)),
  );
  const legacyStays = (accommodation?.items ?? []).filter(
    (item) => item.kind === "hotel" && (!item.selectionId || !stayIds.has(item.selectionId)),
  );
  const flightEntries: BookingEntry[] = [
    ...selectedFlights.map(({ selection, candidate }) => ({
      id: `flight-${selection.id}`,
      title: `${selection.from} → ${selection.to} · ${candidate.carrier}`,
      meta: [
        selection.depart,
        `${selection.passengers} ${t("Travellers").toLocaleLowerCase()}`,
        money(candidate.price),
      ].join(" · "),
    })),
    ...legacyFlights.map((item, index) => ({
      id: item.id ?? `flight-${index}`,
      title: titleOf(item),
      meta: item.detail,
    })),
  ];
  const stayEntries: BookingEntry[] = [
    ...selectedStays.map(({ selection, candidate }) => ({
      id: `stay-${selection.id}`,
      title: candidate.name,
      meta: [
        `${t("Check-in")} ${selection.checkIn}`,
        `${t("Check-out")} ${selection.checkOut}`,
        `${selection.rooms} / ${selection.nights} ${t("Rooms / nights").toLocaleLowerCase()}`,
        money(candidate.pricePerNight * selection.rooms * selection.nights),
      ].join(" · "),
    })),
    ...legacyStays.map((item, index) => ({
      id: item.id ?? `stay-${index}`,
      title: titleOf(item),
      meta: item.detail,
    })),
  ];

  if (!activities.length && !flightEntries.length && !stayEntries.length)
    return (
      <div className="trip-home-action trip-home-ideas-bookings">
        <p className="trip-home-action__empty">{t("No bookings yet.")}</p>
      </div>
    );

  return (
    <div className="trip-home-action trip-home-ideas-bookings trip-home-ideas-bookings--bookings">
      <BookingGroup label={t("Activities")} icon="activity" entries={activities} />
      <BookingGroup
        label={locale === "zh" ? "航班" : "Flights"}
        icon="flight"
        entries={flightEntries}
      />
      <BookingGroup label={t("Stays")} icon="stay" entries={stayEntries} />
    </div>
  );
}
