"use client";
import type { AgentProposalSource, StaySelection } from "@trip/shared";
import { stayOffers, type StayOffer, type StayOfferTag } from "@/lib/trip/stay-offers";
import { useLocale } from "../../account/LocaleProvider";
import { dayMonth } from "../../flight/FlightLeg";
import { FlowStayIcon } from "../../ui/flow-icons";
import { OfferStrip, OfferTags, priceComparison } from "./OfferStrip";

const TAG_KEY = {
  selected: "yourStay",
  cheapest: "cheapest",
  topRated: "topRated",
} as const satisfies Record<StayOfferTag, string>;

function StayOfferCard({
  stay,
  offer,
  source,
  onChoose,
}: {
  stay: StaySelection;
  offer: StayOffer;
  source?: AgentProposalSource;
  onChoose?: (candidateId: string) => void;
}) {
  const { t, money, locale } = useLocale();
  const { candidate, tags, total } = offer;
  const selected = tags.includes("selected");
  const cancellation =
    candidate.freeCancellation === undefined
      ? t("cancellationTermsUnknown")
      : candidate.freeCancellation
        ? t("freeCancellationTitle")
        : t("noFreeCancellation");
  return (
    <article
      className={`offer__card${selected ? " is-selected" : ""}`}
      aria-label={`${candidate.name}, ${money(total)}`}
    >
      <OfferTags tags={tags.map((tag) => ({ key: tag, label: t(TAG_KEY[tag]) }))} />
      <div className="offer__trip">
        <span className="offer__mark" aria-hidden="true">
          <FlowStayIcon size={16} />
        </span>
        <span className="offer__trip-text">
          <strong className="stay-offer__name">{candidate.name}</strong>
          <span>
            {[
              candidate.area || stay.city,
              candidate.rating > 0
                ? t("guestRating", { rating: (candidate.rating / 2).toFixed(1) })
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </div>
      <div className="offer__legs">
        <div className="itinerary-leg">
          <div className="itinerary-leg__route">
            <span className="stay-offer__date">{dayMonth(stay.checkIn, locale)}</span>
            <span className="itinerary-leg__rail" aria-hidden="true" />
            <span className="itinerary-leg__duration">
              {t("countNights", { count: stay.nights })}
            </span>
            <span className="itinerary-leg__rail" aria-hidden="true" />
            <span className="stay-offer__date">{dayMonth(stay.checkOut, locale)}</span>
          </div>
          <div className="itinerary-leg__times">
            <span>{t("checkIn")}</span>
            <span>{t("checkOut")}</span>
          </div>
          <p className="itinerary-leg__stops">
            {t("stayRoomRate", { price: money(candidate.pricePerNight), rooms: stay.rooms })}
          </p>
          <p
            className={`itinerary-leg__stops${candidate.freeCancellation ? " stay-offer__free" : ""}`}
          >
            {cancellation}
          </p>
        </div>
      </div>
      <footer className="offer__footer">
        <span className="offer__price">
          <strong>{money(total)}</strong>
          {candidate.detailsUrl ? (
            <a href={candidate.detailsUrl} target="_blank" rel="noreferrer">
              {t("viewPropertyDetails")}
            </a>
          ) : (
            <span>
              {source?.kind === "live"
                ? t("availabilityCanChangeBeforeBooking")
                : t("availabilityIsNotLiveVerified")}
            </span>
          )}
        </span>
        {onChoose && !selected && (
          <button
            type="button"
            className="offer__choose"
            aria-label={t("takeV0InsteadV1", { v0: candidate.name, v1: money(total) })}
            onClick={() => onChoose(candidate.id)}
          >
            {t("chooseStay")}
          </button>
        )}
      </footer>
    </article>
  );
}

export function StayOffers({
  stay,
  source,
  onChoose,
}: {
  stay: StaySelection;
  source?: AgentProposalSource;
  onChoose?: (candidateId: string) => void;
}) {
  const { t, money } = useLocale();
  const offers = stayOffers(stay);
  const current = offers.find((offer) => offer.tags.includes("selected"));
  if (!current) return <p>{t("thisStayNeedsANew")}</p>;
  return (
    <OfferStrip
      label={stay.city}
      {...(source ? { source } : {})}
      meta={t("countNights", { count: stay.nights })}
      items={offers.map((offer) => ({
        key: offer.candidate.id,
        card: (
          <StayOfferCard
            stay={stay}
            offer={offer}
            {...(source ? { source } : {})}
            {...(onChoose ? { onChoose } : {})}
          />
        ),
        ...(offer === current
          ? {}
          : { note: priceComparison(t, money, offer.total, current.total, "stay") }),
      }))}
    />
  );
}
