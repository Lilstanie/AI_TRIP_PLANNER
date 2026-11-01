"use client";
import type { AgentProposalSource, FlightCandidate, FlightSelection } from "@trip/shared";
import { flightOffers, type FlightOffer, type FlightOfferTag } from "@/lib/trip/flight-offers";
import { useLocale } from "../../account/LocaleProvider";
import { FlightLeg, hoursAndMinutes, shortDate } from "../../chat/FlightItineraryCard";
import { FlowFlightIcon } from "../../ui/flow-icons";
import { OfferStrip, OfferTags, priceComparison } from "./OfferStrip";

const CABIN_KEY = {
  economy: "cabinEconomy",
  "premium economy": "cabinPremiumEconomy",
  business: "cabinBusiness",
  first: "cabinFirst",
} as const;

function cabinLabel(cabin: string, t: ReturnType<typeof useLocale>["t"]): string {
  const key = CABIN_KEY[cabin.trim().toLowerCase() as keyof typeof CABIN_KEY];
  return key ? t(key) : cabin;
}

const TAG_KEY = {
  selected: "yourFlight",
  cheapest: "cheapest",
  fastest: "fastest",
  nonstop: "nonstop",
} as const satisfies Record<FlightOfferTag, string>;

function comparison(
  offer: FlightOffer,
  current: FlightOffer,
  { t, money, locale }: ReturnType<typeof useLocale>,
): string | undefined {
  if (offer === current) return undefined;
  const parts = [
    priceComparison(t, money, offer.candidate.price, current.candidate.price, "flight"),
  ];
  if (offer.minutes !== undefined && current.minutes !== undefined) {
    const gap = offer.minutes - current.minutes;
    if (Math.abs(gap) >= 5)
      parts.push(
        gap < 0
          ? t("flyingShorter", { duration: hoursAndMinutes(-gap, locale) })
          : t("flyingLonger", { duration: hoursAndMinutes(gap, locale) }),
      );
  }
  return parts.join(" · ");
}

function Summary({ candidate }: { candidate: FlightCandidate }) {
  const { t, locale } = useLocale();
  const stops =
    candidate.stops === undefined
      ? undefined
      : candidate.stops === 0
        ? t("nonstop")
        : t("countStops", { count: candidate.stops });
  return (
    <div className="itinerary-leg">
      <p className="itinerary-leg__airline">
        <span className="itinerary-leg__carrier">{candidate.carrier}</span>
      </p>
      <p className="itinerary-leg__stops">
        {[stops, candidate.durationMin ? hoursAndMinutes(candidate.durationMin, locale) : undefined]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function OfferCard({
  flight,
  offer,
  roundTrip,
  onChoose,
}: {
  flight: FlightSelection;
  offer: FlightOffer;
  roundTrip: boolean;
  onChoose?: (candidateId: string) => void;
}) {
  const { t, money, locale } = useLocale();
  const { candidate, tags } = offer;
  const outbound = candidate.outbound;
  const first = outbound?.segments[0];
  const back = candidate.inbound?.segments[candidate.inbound.segments.length - 1];
  const selected = tags.includes("selected");
  const kind = [
    roundTrip ? t("roundTrip") : t("oneWay"),
    first?.cabin ? cabinLabel(first.cabin, t) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article
      className={`offer__card${selected ? " is-selected" : ""}`}
      aria-label={`${candidate.carrier}, ${money(candidate.price)}`}
    >
      <OfferTags tags={tags.map((tag) => ({ key: tag, label: t(TAG_KEY[tag]) }))} />
      <div className="offer__trip">
        <span className="offer__mark" aria-hidden="true">
          <FlowFlightIcon size={16} />
        </span>
        <span className="offer__trip-text">
          <strong>
            {flight.from} → {flight.to}
          </strong>
          <span>
            {shortDate(first?.departsAt ?? flight.depart, locale)}
            {back ? ` – ${shortDate(back.arrivesAt, locale)}` : ""}
          </span>
          <span>{kind}</span>
        </span>
      </div>
      <div className="offer__legs">
        {outbound ? (
          <>
            <FlightLeg leg={outbound} label={t("outbound")} />
            {candidate.inbound ? (
              <FlightLeg leg={candidate.inbound} label={t("return")} />
            ) : (
              roundTrip && <p className="offer__pending">{t("returnLegOnChoose")}</p>
            )}
          </>
        ) : (
          <Summary candidate={candidate} />
        )}
      </div>
      <footer className="offer__footer">
        <span className="offer__price">
          <strong>{money(candidate.price)}</strong>
          <span>{t("wholeParty")}</span>
        </span>
        {onChoose && !selected && (
          <button
            type="button"
            className="offer__choose"
            aria-label={t("takeV0InsteadV1", { v0: candidate.carrier, v1: money(candidate.price) })}
            onClick={() => onChoose(candidate.id)}
          >
            {t("chooseFlight")}
          </button>
        )}
      </footer>
    </article>
  );
}

export function FlightOffers({
  flight,
  source,
  onChoose,
}: {
  flight: FlightSelection;
  source?: AgentProposalSource;
  onChoose?: (candidateId: string) => void;
}) {
  const locale = useLocale();
  const offers = flightOffers(flight);
  const roundTrip = flight.candidates.some((candidate) => candidate.roundTrip || candidate.inbound);
  const current = offers.find((offer) => offer.tags.includes("selected"));
  if (!current) return <p>{locale.t("thisFlightNeedsANew")}</p>;
  return (
    <OfferStrip
      label={`${flight.from} → ${flight.to}`}
      {...(source ? { source } : {})}
      meta={locale.t("countTravellers", { count: flight.passengers })}
      items={offers.map((offer) => {
        const note = comparison(offer, current, locale);
        return {
          key: offer.candidate.id,
          card: (
            <OfferCard
              flight={flight}
              offer={offer}
              roundTrip={roundTrip}
              {...(onChoose ? { onChoose } : {})}
            />
          ),
          ...(note ? { note } : {}),
        };
      })}
    />
  );
}
