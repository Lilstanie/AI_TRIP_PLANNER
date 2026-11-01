"use client";
import type { FlightAnswerOption } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import { FlightLeg, shortDate } from "../flight/FlightLeg";

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
      aria-label={t("fromFromToTo", { from: first.from.name, to: last.to.name })}
    >
      <header className="itinerary__badges">
        {cheapest && (
          <span className="itinerary__badge itinerary__badge--best">{t("cheapest")}</span>
        )}
        <span className="itinerary__badge">
          {stops === 0 ? t("nonstop") : t("countStops", { count: stops })}
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
        {option.roundTrip ? t("roundTrip") : t("oneWay")}
        {first.cabin ? ` · ${first.cabin}` : ""}
      </p>
      <div className="itinerary__legs">
        <FlightLeg leg={outbound} label={t("outbound")} />
        {option.inbound && <FlightLeg leg={option.inbound} label={t("return")} />}
      </div>
      {option.roundTrip && !option.inbound && (
        <p className="itinerary__pending">{t("returnFlightsNotLookedUp")}</p>
      )}
      <footer className="itinerary__footer">
        <span className="itinerary__price">{money(option.price)}</span>
        <span className="itinerary__price-note">{t("wholeParty")}</span>
      </footer>
    </article>
  );
}
