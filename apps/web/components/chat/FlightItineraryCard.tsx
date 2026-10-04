"use client";
import { formatDuration } from "@/lib/trip/timeline";
import { intlLocale, type AppLocale } from "@/lib/i18n/locale";
import type { FlightAnswerOption, FlightLeg } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";

/** "17h 20m" — the shape a timetable uses, not 1040 minutes. */
function hoursAndMinutes(minutes: number, locale: AppLocale): string {
  if (locale === "zh") return formatDuration(minutes, locale);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

/** The clock part of a provider's "YYYY-MM-DD HH:mm", in the airport's own time. */
function clock(value: string, locale: AppLocale): string {
  const [, time] = value.split(" ");
  if (!time) return value;
  if (locale === "zh") return time;
  const [hour, minute] = time.split(":").map(Number);
  if (hour === undefined || minute === undefined) return time;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

const dayOf = (value: string) => value.split(" ")[0] ?? value;

/** "+1" when the flight lands on a later day than it left. */
function dayOffset(departsAt: string, arrivesAt: string): string {
  const from = Date.parse(`${dayOf(departsAt)}T00:00:00Z`);
  const to = Date.parse(`${dayOf(arrivesAt)}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return "";
  return `+${Math.round((to - from) / 86_400_000)}`;
}

function shortDate(value: string, locale: AppLocale): string {
  const parsed = new Date(`${dayOf(value)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? dayOf(value)
    : parsed.toLocaleDateString(intlLocale(locale), {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
}

/**
 * One direction of a journey: who flies it, from where to where, and what it
 * costs in time.
 *
 * The airports are shown by code and the times in each airport's own local
 * clock, because that is what a boarding pass says. Converting either into the
 * reader's timezone would be a different, wrong number.
 */
function Leg({ leg, label }: { leg: FlightLeg; label: string }) {
  const { t, locale } = useLocale();
  const first = leg.segments[0]!;
  const last = leg.segments[leg.segments.length - 1]!;
  const offset = dayOffset(first.departsAt, last.arrivesAt);
  const stops = leg.layovers.length;
  return (
    <div className="itinerary-leg">
      <p className="itinerary-leg__airline">
        {first.airlineLogo && (
          // eslint-disable-next-line @next/next/no-img-element -- provider CDN, no loader configured
          <img src={first.airlineLogo} alt="" className="itinerary-leg__logo" aria-hidden="true" />
        )}
        <span className="itinerary-leg__carrier">{first.airline}</span>
        <span className="itinerary-leg__number">{first.flightNumber}</span>
      </p>
      <div className="itinerary-leg__route">
        <span className="itinerary-leg__code">{first.from.code}</span>
        <span className="itinerary-leg__rail" aria-hidden="true" />
        <span className="itinerary-leg__duration">{hoursAndMinutes(leg.durationMin, locale)}</span>
        <span className="itinerary-leg__rail" aria-hidden="true" />
        <span className="itinerary-leg__code">{last.to.code}</span>
      </div>
      <div className="itinerary-leg__times">
        <span>{clock(first.departsAt, locale)}</span>
        <span>
          {clock(last.arrivesAt, locale)}
          {offset && <sup className="itinerary-leg__offset">{offset}</sup>}
        </span>
      </div>
      <p className="itinerary-leg__stops">
        {stops === 0
          ? t("Nonstop")
          : `${t(stops === 1 ? "{count} stop" : "{count} stops", { count: stops })} (${leg.layovers.map((stop) => stop.place.code).join(", ")})`}
      </p>
      <span className="sr-only">
        {label}: {first.from.name} {t("to")}
        {last.to.name}
        {t(", departing")}
        {clock(first.departsAt, locale)}.
      </span>
    </div>
  );
}

/**
 * One fare, with the flights behind it.
 *
 * A round trip shows both legs. When the provider priced a round trip but its
 * return flights were not looked up, the card says so rather than implying the
 * outbound is the whole journey — the price covers a way home this card cannot
 * yet name.
 */
export function FlightItineraryCard({
  option,
  cheapest,
}: {
  option: FlightAnswerOption;
  cheapest?: boolean;
}) {
  const { t, money, locale } = useLocale();
  const outbound = option.outbound;
  if (!outbound) return null;
  const first = outbound.segments[0]!;
  const last = outbound.segments[outbound.segments.length - 1]!;
  const stops = outbound.layovers.length;
  const returning = option.inbound?.segments[option.inbound.segments.length - 1];
  return (
    <article
      className="itinerary"
      aria-label={t("From {from} to {to}", { from: first.from.name, to: last.to.name })}
    >
      <header className="itinerary__badges">
        {cheapest && (
          <span className="itinerary__badge itinerary__badge--best">{t("Cheapest")}</span>
        )}
        <span className="itinerary__badge">
          {stops === 0
            ? t("Nonstop")
            : t(stops === 1 ? "{count} stop" : "{count} stops", { count: stops })}
        </span>
      </header>
      <p className="itinerary__route">
        {first.from.name.replace(/ Airport$/, "")} → {last.to.name.replace(/ Airport$/, "")}
      </p>
      <p className="itinerary__dates">
        {shortDate(first.departsAt, locale)}
        {returning ? ` – ${shortDate(returning.arrivesAt, locale)}` : ""}
      </p>
      <p className="itinerary__class">
        {option.roundTrip ? t("Round trip") : t("One way")}
        {first.cabin ? ` · ${first.cabin}` : ""}
      </p>
      <div className="itinerary__legs">
        <Leg leg={outbound} label={t("Outbound")} />
        {option.inbound && <Leg leg={option.inbound} label={t("Return")} />}
      </div>
      {option.roundTrip && !option.inbound && (
        <p className="itinerary__pending">
          {t("Return flights not looked up; the price covers the way home.")}
        </p>
      )}
      <footer className="itinerary__footer">
        <span className="itinerary__price">{money(option.price)}</span>
        <span className="itinerary__price-note">{t("whole party")}</span>
      </footer>
    </article>
  );
}
