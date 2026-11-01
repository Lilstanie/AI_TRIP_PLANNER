"use client";
import { arrivalDayOffset, formatDuration } from "@/lib/trip/timeline";
import { intlLocale, type AppLocale } from "@/lib/i18n/locale";
import type { FlightLeg as FlightLegData } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";

export function hoursAndMinutes(minutes: number, locale: AppLocale): string {
  if (locale === "zh") return formatDuration(minutes, locale);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

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

export function shortDate(value: string, locale: AppLocale): string {
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

export function dayMonth(value: string, locale: AppLocale): string {
  const parsed = new Date(`${dayOf(value)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? dayOf(value)
    : parsed.toLocaleDateString(intlLocale(locale), {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
}

export function FlightLeg({ leg, label }: { leg: FlightLegData; label: string }) {
  const { t, locale } = useLocale();
  const first = leg.segments[0]!;
  const last = leg.segments[leg.segments.length - 1]!;
  const offset = arrivalDayOffset(first.departsAt, last.arrivesAt);
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
          ? t("nonstop")
          : `${t("countStops", { count: stops })} (${leg.layovers.map((stop) => stop.place.code).join(", ")})`}
      </p>
      <span className="sr-only">
        {t("flightLegSummary", {
          label,
          from: first.from.name,
          to: last.to.name,
          time: clock(first.departsAt, locale),
        })}
      </span>
    </div>
  );
}
