"use client";
import { useId, useState } from "react";
import type { AgentProposalSource, FlightSelection, StaySelection } from "@trip/shared";
import type { BookingRow as BookingRowData } from "@/lib/trip/timeline";
import { arrivalDayOffset } from "@/lib/trip/timeline";
import { useLocale } from "../../account/LocaleProvider";
import { FlowFlightIcon, FlowStayIcon } from "../../ui/flow-icons";
import { FlightOffers } from "./FlightOffers";
import { StayOffers } from "./StayOffers";

export type ChooseCandidate = (sectionId: string, selectionId: string, candidateId: string) => void;

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
    const night = row.night ? t("nightV0OfV1", { v0: row.night.index, v1: row.night.of }) : "";
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
            <span className="sr-only">{t("stay")}: </span>
            <span className="timeline-fixed__title">
              {selected ? selected.name : t("thisStayNeedsANew")}
            </span>
            <span className="timeline-row__meta">
              {[stay.city, night].filter(Boolean).join(" · ")}
            </span>
          </button>
          {open && (
            <div id={cardId} className="timeline-booking__card">
              <StayOffers
                stay={stay}
                {...(source ? { source } : {})}
                {...(choose ? { onChoose: choose } : {})}
              />
            </div>
          )}
        </div>
        <span className="timeline-row__cost">
          {selected ? money(selected.pricePerNight * stay.rooms) : t("priceUnknown")}
          {selected?.detailsUrl && (
            <a
              className="timeline-booking__book"
              href={selected.detailsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={t("bookName", { name: selected.name })}
            >
              {t("book")}
            </a>
          )}
        </span>
      </li>
    );
  }

  const flight = row.selection as FlightSelection;
  const selected = flight.candidates.find((candidate) => candidate.id === flight.selectedId);
  const out = row.role === "out";
  const leg = out ? selected?.inbound : selected?.outbound;
  const first = leg?.segments[0];
  const last = leg?.segments[leg.segments.length - 1];
  const departs = first?.departsAt.split(" ")[1];
  const arrives = last?.arrivesAt.split(" ")[1];
  const offset = first && last ? arrivalDayOffset(first.departsAt, last.arrivesAt) : "";
  const Icon = FlowFlightIcon;
  return (
    <li
      className={`timeline-row timeline-fixed timeline-fixed--flight timeline-booking${open ? " is-open" : ""}`}
    >
      <span className="timeline-row__time">
        {departs && (
          <>
            {departs}
            <span className="timeline-row__end">
              {arrives}
              {offset && <sup className="timeline-row__offset">{offset}</sup>}
            </span>
          </>
        )}
      </span>
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
          <span className="sr-only">{t("flight")}: </span>
          <span className="timeline-fixed__title">
            {out ? `${flight.to} → ${flight.from}` : `${flight.from} → ${flight.to}`}
          </span>
          <span className="timeline-row__meta">
            {[
              selected?.carrier,
              out ? t("returnFlightDate", { date: row.date ?? "" }) : t("wholeGroup"),
              departs ? undefined : t("timeNotSet"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
        {open && (
          <div id={cardId} className="timeline-booking__card">
            <FlightOffers
              flight={flight}
              {...(source ? { source } : {})}
              {...(choose ? { onChoose: choose } : {})}
            />
          </div>
        )}
      </div>
      <span className="timeline-row__cost">
        {out
          ? t("includedInTheOutboundFare")
          : selected
            ? money(selected.price)
            : t("priceUnknown")}
      </span>
    </li>
  );
}
