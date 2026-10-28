"use client";
import { type RefObject } from "react";
import type { TripPlan } from "@trip/shared";
import { PreferenceList } from "../preferences/PreferenceList";
import { Drawer } from "../ui/Drawer";
import { useLocale } from "../account/LocaleProvider";
import type { Notice } from "@/lib/i18n/notice";
import { intlLocale } from "@/lib/i18n/locale";
import { buildItinerary } from "@/lib/trip/itinerary";
import { dayCount, dayLabel } from "@/lib/trip/timeline";
import type { TripAction } from "@/lib/workspace/layout";
import type { Draft } from "@/lib/workspace/workspace";

const TITLES = {
  itinerary: "Itinerary",
  ideas: "Ideas",
  bookings: "Bookings",
  preferences: "Trip preferences",
  calendar: "Calendar",
} as const;

const ACTIVITY_ERRORS: Record<string, Notice> = {};

function destinationFor(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function ItineraryContent({ plan }: { plan: TripPlan }) {
  const { locale, t } = useLocale();
  const itinerary = buildItinerary(plan, () => undefined);
  return (
    <div className="trip-home-action">
      {Array.from({ length: dayCount(plan) }, (_, index) => index + 1).map((day) => {
        const stops = itinerary.stopsOn(day);
        return (
          <section className="trip-home-action__day" key={day} aria-label={dayLabel(plan, day, locale)}>
            <h3>
              {t("Day {v0}", { v0: day })} · {dayLabel(plan, day, locale)}
            </h3>
            {stops.length ? (
              <ol className="trip-home-action__list">
                {stops.map((stop) => (
                  <li key={stop.activity.id ?? `${stop.activity.detail}-${stop.number}`}>
                    <span className="trip-home-action__time">
                      {[stop.activity.startTime, stop.activity.endTime].filter(Boolean).join("–")}
                    </span>
                    <span>
                      <strong>
                        {destinationFor(stop.activity.location, stop.activity.detail)}
                      </strong>
                      <small>{stop.activity.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="trip-home-action__empty">
                {t("Nothing is scheduled on Day {day}.", { day })}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function IdeasContent({ plan }: { plan: TripPlan }) {
  const { t } = useLocale();
  const ideas = buildItinerary(plan, () => undefined).ideas();
  if (!ideas.length) return <p className="trip-home-action__empty">{t("No ideas yet.")}</p>;
  return (
    <ul className="trip-home-action__list">
      {ideas.map((idea, index) => (
        <li key={idea.id ?? `${idea.detail}-${index}`}>
          <span>
            <strong>{destinationFor(idea.location, idea.detail)}</strong>
            <small>{idea.detail}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function BookingsContent({ plan }: { plan: TripPlan }) {
  const { t } = useLocale();
  const seen = new Set<string>();
  const bookings = plan.sections.flatMap((section) =>
    (section.proposal?.items ?? []).filter((item) => {
      if (!item.booked) return false;
      const key = item.id ?? `${section.id}-${item.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
  if (!bookings.length) return <p className="trip-home-action__empty">{t("No bookings yet.")}</p>;
  return (
    <ul className="trip-home-action__list">
      {bookings.map((item, index) => (
        <li key={item.id ?? `${item.detail}-${index}`}>
          <span>
            <strong>{destinationFor(item.location, item.detail)}</strong>
            <small>{t("Booked")}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CalendarContent({
  plan,
  onSelectDay,
}: {
  plan: TripPlan;
  onSelectDay(day: number): void;
}) {
  const { locale } = useLocale();
  const itinerary = buildItinerary(plan, () => undefined);
  const localeName = intlLocale(locale);
  const start = new Date(`${plan.brief.dates[0]}T00:00:00Z`);
  const end = new Date(`${plan.brief.dates[1]}T00:00:00Z`);
  const months: Date[] = [];
  for (
    let month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    month <= end;
    month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
  )
    months.push(month);
  const weekday = new Intl.DateTimeFormat(localeName, {
    weekday: "short",
    timeZone: "UTC",
  });
  return (
    <div className="trip-home-action trip-home-calendar">
      {months.map((month) => {
        const year = month.getUTCFullYear();
        const monthIndex = month.getUTCMonth();
        const total = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        const leading = (month.getUTCDay() + 6) % 7;
        return (
          <section
            className="trip-home-calendar__month"
            key={`${year}-${monthIndex}`}
            aria-label={new Intl.DateTimeFormat(localeName, {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(month)}
          >
            <h3>
              {new Intl.DateTimeFormat(localeName, {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(month)}
            </h3>
            <div className="trip-home-calendar__weekdays" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) =>
                weekday.format(new Date(Date.UTC(2024, 0, 1 + index))),
              ).map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="trip-home-calendar__grid">
              {Array.from({ length: leading }, (_, index) => (
                <span key={`blank-${index}`} />
              ))}
              {Array.from({ length: total }, (_, index) => {
                const date = new Date(Date.UTC(year, monthIndex, index + 1));
                const day = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
                const inTrip = date >= start && date <= end;
                if (!inTrip) return <span key={index + 1} />;
                const labels = itinerary
                  .stopsOn(day)
                  .map((stop) =>
                    destinationFor(stop.activity.location, stop.activity.detail),
                  );
                const fullDate = new Intl.DateTimeFormat(localeName, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(date);
                return (
                  <button
                    key={index + 1}
                    type="button"
                    className="trip-home-calendar__day"
                    aria-label={`${fullDate}${labels.length ? ` · ${labels.join(", ")}` : ""}`}
                    onClick={() => onSelectDay(day)}
                  >
                    <span>{index + 1}</span>
                    {labels.map((label, itemIndex) => (
                      <small key={`${label}-${itemIndex}`}>{label}</small>
                    ))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function TripHomeActionDrawer({
  action,
  plan,
  draft,
  onDraft,
  onClose,
  onSelectDay,
  returnFocus,
}: {
  action?: TripAction;
  plan: TripPlan;
  draft: Draft;
  onDraft(next: Draft): void;
  onClose(): void;
  onSelectDay(day: number): void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const { t } = useLocale();
  const titleKey = TITLES[action ?? "itinerary"];
  const title = t(titleKey);
  return (
    <Drawer
      side="right"
      open={action !== undefined}
      title={title}
      closeLabel={t("Close {v0}", { v0: title })}
      onClose={onClose}
      returnFocus={returnFocus}
      className="trip-home-action-surface"
    >
      {action === "itinerary" && <ItineraryContent plan={plan} />}
      {action === "ideas" && <IdeasContent plan={plan} />}
      {action === "bookings" && <BookingsContent plan={plan} />}
      {action === "preferences" && (
        <div className="trip-home-action">
          <PreferenceList value={draft} onChange={onDraft} errors={ACTIVITY_ERRORS} />
        </div>
      )}
      {action === "calendar" && (
        <CalendarContent plan={plan} onSelectDay={onSelectDay} />
      )}
    </Drawer>
  );
}
