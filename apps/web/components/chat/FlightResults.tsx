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
  return count === 0 ? translate(locale, "nonstop") : translate(locale, "countStops", { count });
}

export function FlightResults({ answer }: { answer: FlightAnswer }) {
  const { t, money, locale } = useLocale();
  const party = t("countTravellers", {
    count: answer.passengers,
  });
  return (
    <section
      className="flight-results"
      aria-label={t("faresFromV0ToV1", { v0: answer.from, v1: answer.to })}
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
        <p className="muted">{t("noFaresWereReturnedFor")}</p>
      ) : null}
      <p className="flight-results__note">
        {t("wholePartyTotals")}
        {answer.source?.freshness ?? t("pricesChangeWithoutNotice")} {t("nothingHereMakesABooking")}
      </p>
    </section>
  );
}
