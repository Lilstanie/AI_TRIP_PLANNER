"use client";
import { formatDuration } from "@/lib/trip/timeline";
import { Fragment } from "react";
import type {
  AgentProposalSource,
  FlightSelection,
  ProposalItem,
  TripSection,
} from "@trip/shared";
import { SourceBadge } from "./SourceBadge";
import type { MessageKey } from "@/lib/i18n/locale";
import { useLocale } from "../account/LocaleProvider";

const titles: Record<string, MessageKey> = {
  hotel: "Accommodation",
  transport: "Transport",
  activity: "Activity",
  meal: "Restaurant suggestion",
  "meal-budget": "Whole-trip meal budget",
  attraction: "Place to explore",
  customs: "Customs & etiquette",
  safety: "Safety notes",
  "entry-health": "Entry & health",
  "weather-packing": "Weather & packing",
  note: "Travel note",
};
const MODE_LABELS: Record<string, MessageKey> = {
  walk: "Walk",
  bus: "Bus",
  train: "Train",
  tram: "Tram",
  ferry: "Ferry",
  drive: "Drive",
  transit: "Public transport",
  flight: "Fly",
};

/**
 * How the traveller gets to this activity from the last one.
 *
 * Shown above the card it arrives at, as a connector rather than a card of its
 * own: the journey is a line between two places, not a third place, and a full
 * card for every hop would bury the day's actual plan.
 */
function Connection({ arriveBy }: { arriveBy: NonNullable<ProposalItem["arriveBy"]> }) {
  const { t, locale } = useLocale();
  const hours = Math.floor(arriveBy.durationMin / 60);
  const minutes = arriveBy.durationMin % 60;
  const time =
    locale === "zh"
      ? formatDuration(arriveBy.durationMin, locale)
      : hours
        ? `${hours}h${minutes ? ` ${minutes}m` : ""}`
        : `${minutes} min`;
  const mode = MODE_LABELS[arriveBy.mode] ? t(MODE_LABELS[arriveBy.mode]!) : arriveBy.mode;
  return (
    <p className="proposal-connection">
      <span className="proposal-connection__rail" aria-hidden="true" />
      <span className="proposal-connection__label">
        {mode}
        {arriveBy.line ? ` ${arriveBy.line}` : ""} · {time}
        {arriveBy.from ? t(" from {v0}", { v0: arriveBy.from }) : ""}
      </span>
    </p>
  );
}

function ItemCard({ item }: { item: ProposalItem }) {
  const { t, money } = useLocale();
  const informational = ["customs", "safety", "entry-health", "weather-packing", "note"].includes(
    item.kind,
  );
  return (
    <article className={`proposal-item result-card${informational ? " result-card--context" : ""}`}>
      <div className="proposal-item__meta">
        <span className="proposal-item__kind">
          {titles[item.kind] ? t(titles[item.kind]!) : item.kind.replaceAll("-", " ")}
        </span>
        {item.startTime && item.endTime && (
          <span>
            {item.startTime}–{item.endTime}
          </span>
        )}
        {item.estCost !== undefined ? (
          <strong>{money(item.estCost)}</strong>
        ) : (
          !informational && <span>{t("Price unknown")}</span>
        )}
      </div>
      <h4>{item.location ?? (titles[item.kind] ? t(titles[item.kind]!) : t("Planning detail"))}</h4>
      <p>{item.detail}</p>
    </article>
  );
}

/**
 * What the chosen option beat, and by how much.
 *
 * The specialists already search several candidates and ship them on the plan;
 * until now nothing rendered them, so the traveller saw one price with no way
 * to tell whether it was the cheap one or the expensive one.
 */
function Alternatives({
  chosen,
  others,
}: {
  chosen: number;
  others: { id: string; label: string; price: number }[];
}) {
  const { t, money } = useLocale();
  if (!others.length) return null;
  return (
    <div className="alternatives">
      <h5 className="alternatives__title">{t("Also found")}</h5>
      <ul className="alternatives__list">
        {others.map((other) => {
          const delta = Math.round((other.price - chosen) * 100) / 100;
          return (
            <li key={other.id}>
              <span className="alternatives__label">{other.label}</span>
              <span className="alternatives__price">{money(other.price)}</span>
              {delta !== 0 && (
                <span className={`alternatives__delta${delta < 0 ? " is-cheaper" : ""}`}>
                  {delta < 0 ? "−" : "+"}
                  {money(Math.abs(delta))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One flown hop: the fare the planner took, and the fares it beat.
 *
 * Getting around described flights in a sentence while the structured
 * selection sat unread on the plan. The stay has had a card since the
 * beginning; this gives the flight the same standing.
 */
function FlightCard({
  flight,
  source,
}: {
  flight: FlightSelection;
  source?: AgentProposalSource;
}) {
  const { t, locale, money } = useLocale();
  const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
  if (!selected) return <p>{t("This flight needs a new selection.")}</p>;
  const others = flight.candidates.filter((candidate) => candidate.id !== flight.selectedId);
  return (
    <article className="proposal-item result-card result-card--flight">
      <div className="result-card__head">
        <div className="proposal-item__meta">
          <span>
            {flight.from} → {flight.to}
          </span>
          <SourceBadge source={source} compact />
        </div>
        <strong>{money(selected.price)}</strong>
      </div>
      <h4>{selected.carrier}</h4>
      <dl className="stay-facts">
        <div>
          <dt>{t("Depart")}</dt>
          <dd>{flight.depart}</dd>
        </div>
        <div>
          <dt>{t("Travellers")}</dt>
          <dd>{flight.passengers}</dd>
        </div>
        {selected.stops !== undefined && (
          <div>
            <dt>{t("Stops")}</dt>
            <dd>{selected.stops === 0 ? t("Nonstop") : selected.stops}</dd>
          </div>
        )}
        {selected.durationMin !== undefined && (
          <div>
            <dt>{t("Flight time")}</dt>
            <dd>{formatDuration(selected.durationMin, locale)}</dd>
          </div>
        )}
      </dl>
      {selected.note && <p>{selected.note}</p>}
      <Alternatives
        chosen={selected.price}
        others={others.map((candidate) => ({
          id: candidate.id,
          label: candidate.carrier,
          price: candidate.price,
        }))}
      />
    </article>
  );
}

/** Section-specific grouping uses structured metadata only, never parses prose as facts. */
export function ProposalDetails({ section }: { section: TripSection }) {
  const { t, money } = useLocale();
  const proposal = section.proposal;
  if (!proposal) return <p className="section__empty">{t("Details are still being prepared.")}</p>;
  if (section.id === "accommodation" && proposal.stays?.length)
    return (
      <div className="proposal-items proposal-items--accommodation">
        {proposal.stays.map((stay) => {
          const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
          if (!selected) return <p key={stay.id}>{t("This stay needs a new selection.")}</p>;
          return (
            <article className="proposal-item result-card result-card--hotel" key={stay.id}>
              <div className="result-card__head">
                <div className="proposal-item__meta">
                  <span>{stay.city}</span>
                  <SourceBadge source={proposal.source} compact />
                </div>
                <strong>{money(selected.pricePerNight * stay.rooms * stay.nights)}</strong>
              </div>
              <h4>{selected.name}</h4>
              <p>
                {selected.area} · {(selected.rating / 2).toFixed(1)}
                {t("/5 guest rating")}
              </p>
              <dl className="stay-facts">
                <div>
                  <dt>{t("Check-in")}</dt>
                  <dd>{stay.checkIn}</dd>
                </div>
                <div>
                  <dt>{t("Check-out")}</dt>
                  <dd>{stay.checkOut}</dd>
                </div>
                <div>
                  <dt>{t("Rooms / nights")}</dt>
                  <dd>
                    {stay.rooms} / {stay.nights}
                  </dd>
                </div>
                <div>
                  <dt>{t("Room per night")}</dt>
                  <dd>{money(selected.pricePerNight)}</dd>
                </div>
              </dl>
              <p>
                {selected.freeCancellation ? t("Free cancellation") : t("No free cancellation")} ·
                {proposal.source?.kind === "live"
                  ? t(" availability can change before booking")
                  : proposal.source?.kind === "estimated"
                    ? t(" estimated price; verify before booking")
                    : t(" availability is not live verified")}
              </p>
              {selected.detailsUrl && (
                <a href={selected.detailsUrl} target="_blank" rel="noreferrer">
                  {t("View property details")}
                </a>
              )}
              <Alternatives
                chosen={selected.pricePerNight * stay.rooms * stay.nights}
                others={stay.candidates
                  .filter((candidate) => candidate.id !== stay.selectedId)
                  .map((candidate) => ({
                    id: candidate.id,
                    label: candidate.name,
                    price: candidate.pricePerNight * stay.rooms * stay.nights,
                  }))}
              />
            </article>
          );
        })}
      </div>
    );
  if (!proposal.items.length)
    return <p className="section__empty">{t("No detailed items were returned.")}</p>;
  if (section.id === "itinerary" || section.id === "transport") {
    const days = [...new Set(proposal.items.map((item) => item.day))].sort(
      (a, b) => (a ?? Infinity) - (b ?? Infinity),
    );
    return (
      <div className={`proposal-items proposal-items--${section.id}`}>
        {/* Flights first: they are the fixed points the rest of the days hang from. */}
        {proposal.flights?.map((flight) => (
          <FlightCard key={flight.id} flight={flight} source={proposal.source} />
        ))}
        {days.map((day) => (
          <section className="proposal-day" key={day ?? "unscheduled"}>
            <h3>{day === undefined ? t("Unscheduled suggestions") : t("Day {v0}", { v0: day })}</h3>
            <div className="proposal-items">
              {proposal.items
                .filter((item) => item.day === day)
                .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
                .map((item, index) => (
                  <Fragment key={index}>
                    {item.arriveBy && <Connection arriveBy={item.arriveBy} />}
                    <ItemCard item={item} />
                  </Fragment>
                ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className={`proposal-items proposal-items--${section.id}`}>
      {section.id === "dining" && (
        <p className="muted">
          {t(
            "Restaurant suggestions are included in the meal budget envelope; they are not added again to the total.",
          )}
        </p>
      )}
      {proposal.items.map((item, index) => (
        <ItemCard key={index} item={item} />
      ))}
    </div>
  );
}
