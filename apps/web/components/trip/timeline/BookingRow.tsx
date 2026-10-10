"use client";
import { useId, useState } from "react";
import type {
  AgentProposalSource,
  FlightCandidate,
  FlightSelection,
  StaySelection,
} from "@trip/shared";
import type { BookingRow as BookingRowData } from "@/lib/trip/timeline";
import { formatDuration } from "@/lib/trip/timeline";
import { useLocale } from "../../account/LocaleProvider";
import { FlowFlightIcon, FlowStayIcon } from "../../ui/flow-icons";
import { SourceBadge } from "../SourceBadge";

export type ChooseCandidate = (sectionId: string, selectionId: string, candidateId: string) => void;

function Alternatives({
  chosen,
  others,
  onChoose,
}: {
  chosen: number;
  others: { id: string; label: string; price: number }[];
  onChoose?: (candidateId: string) => void;
}) {
  const { t, money } = useLocale();
  if (!others.length) return null;
  return (
    <div className="alternatives">
      <h5 className="alternatives__title">{t("Also found")}</h5>
      <ul className="alternatives__list">
        {others.map((other) => {
          const delta = Math.round((other.price - chosen) * 100) / 100;
          const body = (
            <>
              <span className="alternatives__label">{other.label}</span>
              <span className="alternatives__price">{money(other.price)}</span>
              <span className={`alternatives__delta${delta < 0 ? " is-cheaper" : ""}`}>
                {delta === 0 ? "" : delta < 0 ? `−${money(-delta)}` : `+${money(delta)}`}
              </span>
            </>
          );
          return (
            <li key={other.id}>
              {onChoose ? (
                <button
                  type="button"
                  className="alternatives__pick"
                  onClick={() => onChoose(other.id)}
                  aria-label={t("Take {v0} instead, {v1}", {
                    v0: other.label,
                    v1: money(other.price),
                  })}
                >
                  {body}
                </button>
              ) : (
                <span className="alternatives__row">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StayCard({
  stay,
  source,
  onChoose,
}: {
  stay: StaySelection;
  source?: AgentProposalSource;
  onChoose?: (candidateId: string) => void;
}) {
  const { t, money } = useLocale();
  const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
  if (!selected) return <p>{t("This stay needs a new selection.")}</p>;
  const total = selected.pricePerNight * stay.rooms * stay.nights;
  return (
    <article className="proposal-item result-card result-card--hotel">
      <div className="result-card__head">
        <div className="proposal-item__meta">
          <span>{stay.city}</span>
          <SourceBadge source={source} compact />
        </div>
        <strong>{money(total)}</strong>
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
        {source?.kind === "live"
          ? t(" availability can change before booking")
          : source?.kind === "estimated"
            ? t(" estimated price; verify before booking")
            : t(" availability is not live verified")}
      </p>
      {selected.detailsUrl && (
        <a href={selected.detailsUrl} target="_blank" rel="noreferrer">
          {t("View property details")}
        </a>
      )}
      <Alternatives
        {...(onChoose ? { onChoose } : {})}
        chosen={total}
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
}

function FlightCard({
  flight,
  out,
  date,
  source,
  onChoose,
}: {
  flight: FlightSelection;

  out: boolean;
  date?: string;
  source?: AgentProposalSource;
  onChoose?: (candidateId: string) => void;
}) {
  const { t, locale, money } = useLocale();
  const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
  if (!selected) return <p>{t("This flight needs a new selection.")}</p>;
  const others = flight.candidates.filter((candidate) => candidate.id !== flight.selectedId);
  return (
    <article className="proposal-item result-card result-card--flight">
      <div className="result-card__head">
        <div className="proposal-item__meta">
          <span>{out ? `${flight.to} → ${flight.from}` : `${flight.from} → ${flight.to}`}</span>
          <SourceBadge source={source} compact />
        </div>
        {!out && <strong>{money(selected.price)}</strong>}
      </div>
      <h4>{selected.carrier}</h4>
      <dl className="stay-facts">
        <div>
          <dt>{out ? t("Return") : t("Depart")}</dt>
          <dd>{date ?? flight.depart}</dd>
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
      {out && <p>{t("Included in the flight in")}</p>}
      {selected.note && <p>{selected.note}</p>}
      <Alternatives
        chosen={selected.price}
        others={others.map((candidate: FlightCandidate) => ({
          id: candidate.id,
          label: candidate.carrier,
          price: candidate.price,
        }))}
        {...(onChoose ? { onChoose } : {})}
      />
    </article>
  );
}

export function BookingRow({
  row,
  source,
  onChoose,
}: {
  row: BookingRowData;
  source?: AgentProposalSource;
  onChoose?: ChooseCandidate;
}) {
  const { t, money } = useLocale();
  const [open, setOpen] = useState(false);
  const cardId = useId();
  const choose = onChoose
    ? (candidateId: string) => onChoose(row.sectionId, row.selection.id, candidateId)
    : undefined;

  if (row.kind === "stay") {
    const stay = row.selection as StaySelection;
    const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
    const night = row.night
      ? t("Night {v0} of {v1}", { v0: row.night.index, v1: row.night.of })
      : "";
    const Icon = FlowStayIcon;
    return (
      <li
        className={`timeline-row timeline-fixed timeline-fixed--stay timeline-booking${open ? " is-open" : ""}`}
      >
        <span className="timeline-row__time" />
        <span className="timeline-row__node timeline-fixed__icon" aria-hidden="true">
          <Icon size={14} />
        </span>
        <div className="timeline-fixed__body">
          <button
            type="button"
            className="timeline-booking__open"
            aria-expanded={open}
            aria-controls={cardId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{t("Stay")}: </span>
            <span className="timeline-fixed__title">
              {selected ? selected.name : t("This stay needs a new selection.")}
            </span>
            <span className="timeline-row__meta">
              {[stay.city, night].filter(Boolean).join(" · ")}
            </span>
          </button>
          {open && (
            <div id={cardId} className="timeline-booking__card">
              <StayCard
                stay={stay}
                {...(source ? { source } : {})}
                {...(choose ? { onChoose: choose } : {})}
              />
            </div>
          )}
        </div>
        <span className="timeline-row__cost">
          {selected ? money(selected.pricePerNight * stay.rooms) : t("Price unknown")}
        </span>
      </li>
    );
  }

  const flight = row.selection as FlightSelection;
  const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
  const out = row.role === "out";
  const Icon = FlowFlightIcon;
  return (
    <li
      className={`timeline-row timeline-fixed timeline-fixed--flight timeline-booking${open ? " is-open" : ""}`}
    >
      <span className="timeline-row__time" />
      <span className="timeline-row__node timeline-fixed__icon" aria-hidden="true">
        <Icon size={14} />
      </span>
      <div className="timeline-fixed__body">
        <button
          type="button"
          className="timeline-booking__open"
          aria-expanded={open}
          aria-controls={cardId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{t("Flight")}: </span>
          <span className="timeline-fixed__title">
            {out ? `${flight.to} → ${flight.from}` : `${flight.from} → ${flight.to}`}
          </span>
          <span className="timeline-row__meta">
            {[
              selected?.carrier,
              out ? t("return flight {date}", { date: row.date ?? "" }) : t("whole group"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
        {open && (
          <div id={cardId} className="timeline-booking__card">
            <FlightCard
              flight={flight}
              out={out}
              {...(row.date ? { date: row.date } : {})}
              {...(source ? { source } : {})}
              {...(choose ? { onChoose: choose } : {})}
            />
          </div>
        )}
      </div>
      <span className="timeline-row__cost">
        {out
          ? t("Included in the flight in")
          : selected
            ? money(selected.price)
            : t("Price unknown")}
      </span>
    </li>
  );
}
