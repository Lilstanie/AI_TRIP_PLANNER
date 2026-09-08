"use client";

// Owner: E — controlled so map markers and proposal rows share one selection.
import { tripItemId, type TripSection as TripSectionData } from "@trip/shared";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  draft: "Draft",
  needs_you: "Needs you",
  confirmed: "Confirmed",
};

const KIND_LABEL: Record<string, string> = {
  activity: "Activity",
  transport: "Transport",
  hotel: "Stay",
  meal: "Meal",
  note: "Note",
};

export function TripSection({
  section,
  open,
  selectedItemId,
  onToggle,
  onSelectItem,
}: {
  section: TripSectionData;
  open: boolean;
  selectedItemId?: string;
  onToggle: () => void;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <div className="section">
      <button className="section__row" onClick={onToggle} aria-expanded={open}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong>{section.label}</strong>
          <small>{section.summary}</small>
        </span>
        <span className={`chip chip--${section.status}`}>
          {STATUS_LABEL[section.status] ?? section.status}
        </span>
        <span className="cost">${Math.round(section.estCost).toLocaleString()}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="section__body">
          {section.proposal?.items.map((item, index) => {
            const id = tripItemId(section.id, index);
            return (
              <button
                key={id}
                type="button"
                className={`trip-item${selectedItemId === id ? " trip-item--selected" : ""}`}
                onClick={() => onSelectItem(id)}
                aria-pressed={selectedItemId === id}
              >
                <span className="trip-item__head">
                  <span>{KIND_LABEL[item.kind] ?? item.kind}</span>
                  {item.estCost !== undefined && (
                    <strong>${Math.round(item.estCost).toLocaleString()}</strong>
                  )}
                </span>
                {(item.day || item.startTime) && (
                  <small>
                    {item.day ? `Day ${item.day}` : ""}
                    {item.startTime ? ` · ${item.startTime}–${item.endTime}` : ""}
                  </small>
                )}
                {item.location && <strong className="trip-item__location">{item.location}</strong>}
                <span>{item.detail}</span>
                {item.coordinates && <small className="trip-item__map-hint">Show on map ↗</small>}
              </button>
            );
          })}
          {section.proposal?.assumptions.length ? (
            <details className="assumptions">
              <summary>Planning notes ({section.proposal.assumptions.length})</summary>
              <ul>
                {section.proposal.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
