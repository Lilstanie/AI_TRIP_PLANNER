"use client";
import { formatDuration } from "@/lib/trip/timeline";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import { type FlightAnswer } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import { FlightItineraryCard } from "./FlightItineraryCard";

function duration(minutes: number | undefined, locale: AppLocale): string | undefined {
  if (!minutes) return undefined;
  if (locale === "zh") return formatDuration(minutes, locale);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

function stops(count: number | undefined, locale: AppLocale): string | undefined {
  if (count === undefined) return undefined;
  return count === 0
    ? translate(locale, "Nonstop")
    : translate(locale, count === 1 ? "{count} stop" : "{count} stops", { count });
}

/**
 * Fares for a flight question, shown instead of a trip plan.
 *
 * Cheapest first, because that is what the question almost always means, and
 * the whole-party framing is stated rather than assumed — a per-person reading
 * of these numbers would be wrong by the size of the group.
 */
export function FlightResults({ answer }: { answer: FlightAnswer }) {
  const { t, money, locale } = useLocale();
  const party = t(answer.passengers === 1 ? "{count} traveller" : "{count} travellers", {
    count: answer.passengers,
  });
  return (
    <section
      className="flight-results"
      aria-label={t("Fares from {v0} to {v1}", { v0: answer.from, v1: answer.to })}
    >
      <header className="flight-results__head">
        <strong>
          {answer.from} → {answer.to}
        </strong>
        <span className="flight-results__meta">
          {answer.depart}
          {answer.return ? ` – ${answer.return}` : ""} · {party}
        </span>
      </header>
      {/* Itineraries the provider described in full read as cards; the rest
          stay a list, because a card with no flights in it is just a price. */}
      {answer.options.some((option) => option.outbound) && (
        <div className="flight-results__itineraries">
          {answer.options
            .filter((option) => option.outbound)
            .slice(0, 3)
            .map((option, index) => (
              <FlightItineraryCard
                key={`${option.carrier}-${index}`}
                option={option}
                cheapest={index === 0}
              />
            ))}
        </div>
      )}
      {answer.options.some((option) => !option.outbound) ? (
        <ol className="flight-results__list">
          {answer.options
            .filter((option) => !option.outbound)
            .slice(0, 6)
            .map((option, index) => {
              const detail = [stops(option.stops, locale), duration(option.durationMin, locale)]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={`${option.carrier}-${index}`} className="flight-results__row">
                  <span className="flight-results__carrier">{option.carrier}</span>
                  {detail && <span className="flight-results__detail">{detail}</span>}
                  <span className="flight-results__price">{money(option.price)}</span>
                </li>
              );
            })}
        </ol>
      ) : answer.options.length === 0 ? (
        <p className="muted">{t("No fares were returned for this search.")}</p>
      ) : null}
      <p className="flight-results__note">
        {t("Whole-party totals.")}
        {answer.source?.freshness ?? t("Prices change without notice.")}{" "}
        {t("Nothing here makes a booking.")}
      </p>
    </section>
  );
}
