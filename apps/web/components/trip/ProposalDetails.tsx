import { Fragment } from "react";
import type { ProposalItem, TripSection } from "@trip/shared";
import { money } from "@/lib/workspace";
import { SourceBadge } from "./SourceBadge";

const titles: Record<string, string> = {
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
const MODE_LABELS: Record<string, string> = {
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
  const hours = Math.floor(arriveBy.durationMin / 60);
  const minutes = arriveBy.durationMin % 60;
  const time = hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes} min`;
  const mode = MODE_LABELS[arriveBy.mode] ?? arriveBy.mode;
  return (
    <p className="proposal-connection">
      <span className="proposal-connection__rail" aria-hidden="true" />
      <span className="proposal-connection__label">
        {mode}
        {arriveBy.line ? ` ${arriveBy.line}` : ""} · {time}
        {arriveBy.from ? ` from ${arriveBy.from}` : ""}
      </span>
    </p>
  );
}

function ItemCard({ item }: { item: ProposalItem }) {
  const informational = ["customs", "safety", "entry-health", "weather-packing", "note"].includes(
    item.kind,
  );
  return (
    <article className={`proposal-item result-card${informational ? " result-card--context" : ""}`}>
      <div className="proposal-item__meta">
        <span className="proposal-item__kind">
          {titles[item.kind] ?? item.kind.replaceAll("-", " ")}
        </span>
        {item.startTime && item.endTime && (
          <span>
            {item.startTime}–{item.endTime}
          </span>
        )}
        {item.estCost !== undefined ? (
          <strong>{money(item.estCost)}</strong>
        ) : (
          !informational && <span>Price not provided</span>
        )}
      </div>
      <h4>{item.location ?? titles[item.kind] ?? "Planning detail"}</h4>
      <p>{item.detail}</p>
    </article>
  );
}

/** Section-specific grouping uses structured metadata only, never parses prose as facts. */
export function ProposalDetails({
  section,
  onReview,
}: {
  section: TripSection;
  onReview: () => void;
}) {
  const proposal = section.proposal;
  if (!proposal) return <p className="section__empty">Details are still being prepared.</p>;
  if (section.id === "accommodation" && proposal.stays?.length)
    return (
      <div className="proposal-items proposal-items--accommodation">
        {proposal.stays.map((stay) => {
          const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
          if (!selected) return <p key={stay.id}>This stay needs a new selection.</p>;
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
                {selected.area} · {selected.rating}/10 guest rating
              </p>
              <dl className="stay-facts">
                <div>
                  <dt>Check-in</dt>
                  <dd>{stay.checkIn}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{stay.checkOut}</dd>
                </div>
                <div>
                  <dt>Rooms / nights</dt>
                  <dd>
                    {stay.rooms} / {stay.nights}
                  </dd>
                </div>
                <div>
                  <dt>Room per night</dt>
                  <dd>{money(selected.pricePerNight)}</dd>
                </div>
              </dl>
              <p>
                {selected.freeCancellation ? "Free cancellation" : "No free cancellation"} ·
                {proposal.source?.kind === "live"
                  ? " availability can change before booking"
                  : proposal.source?.kind === "estimated"
                    ? " estimated price; verify before booking"
                    : " availability is not live verified"}
              </p>
              {selected.detailsUrl && (
                <a href={selected.detailsUrl} target="_blank" rel="noreferrer">
                  View property details
                </a>
              )}
              <button onClick={onReview}>Review hotel choices</button>
            </article>
          );
        })}
      </div>
    );
  if (!proposal.items.length)
    return <p className="section__empty">No detailed items were returned.</p>;
  if (section.id === "itinerary" || section.id === "transport") {
    const days = [...new Set(proposal.items.map((item) => item.day))].sort(
      (a, b) => (a ?? Infinity) - (b ?? Infinity),
    );
    return (
      <div className={`proposal-items proposal-items--${section.id}`}>
        {days.map((day) => (
          <section className="proposal-day" key={day ?? "unscheduled"}>
            <h3>{day === undefined ? "Unscheduled suggestions" : `Day ${day}`}</h3>
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
          Restaurant suggestions are included in the meal budget envelope; they are not added again
          to the total.
        </p>
      )}
      {proposal.items.map((item, index) => (
        <ItemCard key={index} item={item} />
      ))}
    </div>
  );
}
