"use client";
import { formatDuration } from "@/lib/trip/timeline";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import { type FlightAnswer, type FlightPriceInsight } from "@trip/shared";
import { enFares } from "@/lib/i18n/messages/en-fares";
import { zhFares } from "@/lib/i18n/messages/zh-fares";
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

function fareText(
  locale: AppLocale,
  key: keyof typeof enFares,
  params: Record<string, string | number> = {},
): string {
  const template: string = (locale === "zh" ? zhFares : enFares)[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}

function PriceTrend({
  history,
  label,
}: {
  history: NonNullable<FlightPriceInsight["history"]>;
  label: string;
}) {
  const width = 96;
  const height = 24;
  const prices = history.map((point) => point.price);
  const low = Math.min(...prices);
  const span = Math.max(...prices) - low || 1;
  const points = history.map((point, index) => [
    (index / (history.length - 1)) * (width - 4) + 2,
    height - 2 - ((point.price - low) / span) * (height - 4),
  ]);
  const last = points[points.length - 1]!;
  return (
    <svg
      className="flight-results__trend"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
    >
      <polyline points={points.map((point) => point.join(",")).join(" ")} />
      <circle cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}

function PriceInsight({ insight }: { insight: FlightPriceInsight }) {
  const { money, locale } = useLocale();
  return (
    <div className="flight-results__insight" data-level={insight.level}>
      <span className="flight-results__level">{fareText(locale, insight.level)}</span>
      {insight.typicalRange && (
        <span className="flight-results__meta">
          {fareText(locale, "usual", {
            range: `${money(insight.typicalRange[0])}–${money(insight.typicalRange[1])}`,
          })}
        </span>
      )}
      {insight.history && (
        <PriceTrend
          history={insight.history}
          label={fareText(locale, "trend", { count: insight.history.length })}
        />
      )}
    </div>
  );
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
      {answer.priceInsight && <PriceInsight insight={answer.priceInsight} />}

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
