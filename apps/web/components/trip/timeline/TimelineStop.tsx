"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import type { LocationStatus } from "../../map/useTripPlaces";
import type { TimelineEdits } from "./useTimelineEdits";
import { money } from "@/lib/workspace";
import { SearchIcon } from "../../ui/icons";

type Activity = ProposalItem & { id?: string };

const STATUS_TEXT: Record<LocationStatus, string> = {
  located: "",
  loading: "Finding this place…",
  unconfirmed: "Location to be confirmed",
  unavailable: "Place lookup failed — retry from the map",
};

/**
 * One stop in the day. Collapsed it reads like the Places list: time, name, where it is and what it
 * costs. Selecting it (here or on the map) opens its editor below it — time, order, day and place —
 * so the day is scannable and only one set of controls is ever on screen.
 */
export function TimelineStop({
  activity,
  number,
  index,
  count,
  days,
  dayLabels,
  selected,
  locked,
  place,
  status,
  edits,
  onSelect,
}: {
  activity: Activity;
  /** Position shown in the day, from 1. */
  number: number;
  /** Position in the plan's order for the day, which moves are indexed by. */
  index: number;
  count: number;
  days: number;
  dayLabels: string[];
  selected: boolean;
  locked: boolean;
  /** The Google place this stop resolves to, confirmed or matched by name on the map. */
  place?: GooglePlace;
  status: LocationStatus;
  edits: TimelineEdits;
  onSelect(): void;
}) {
  const id = activity.id!;
  const name = place?.displayName?.text ?? activity.location ?? activity.detail;
  const confirmed = !!activity.placeId;
  const matched = !confirmed && status === "located" && !!place;
  const [start, setStart] = useState(activity.startTime ?? "");
  const [end, setEnd] = useState(activity.endTime ?? "");
  const [query, setQuery] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  // A new plan version brings new times; the inputs follow it.
  useEffect(() => {
    setStart(activity.startTime ?? "");
    setEnd(activity.endTime ?? "");
  }, [activity.startTime, activity.endTime]);
  useEffect(() => {
    if (!selected) {
      setQuery("");
      edits.clearResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const timeChanged = start !== activity.startTime || end !== activity.endTime;
  const validTime = !!start && !!end && start < end;

  return (
    <li
      className={`timeline-row timeline-stop${selected ? " is-selected" : ""}`}
      draggable={!locked}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const moved = event.dataTransfer.getData("text/plain");
        if (!locked && moved && moved !== id)
          void edits.edit({ kind: "move", id: moved, day: activity.day!, index });
      }}
    >
      <span className="timeline-row__time">
        {activity.startTime ?? "—"}
        <span className="timeline-row__end">{activity.endTime}</span>
      </span>
      <span className="timeline-row__node timeline-stop__node" aria-hidden="true">
        {number}
      </span>
      <div className="timeline-stop__body">
        <button
          type="button"
          className="timeline-stop__main"
          aria-expanded={selected}
          aria-controls={`stop-editor-${id}`}
          onClick={onSelect}
        >
          <span className="timeline-stop__name">
            <span className="sr-only">
              {activity.startTime}–{activity.endTime} ·{" "}
            </span>
            {name}
          </span>
          {activity.detail !== name && (
            <span className="timeline-stop__detail">{activity.detail}</span>
          )}
          <span className="timeline-stop__meta">
            {confirmed ? (
              <span className="timeline-tag timeline-tag--ok">Place confirmed</span>
            ) : matched ? (
              <span className="timeline-tag timeline-tag--warn">Map match · not confirmed</span>
            ) : (
              <span className="timeline-tag timeline-tag--warn">{STATUS_TEXT[status]}</span>
            )}
            {activity.priceNeedsReview && (
              <span className="timeline-tag timeline-tag--warn">Price needs checking</span>
            )}
          </span>
        </button>
        {selected && (
          <div className="stop-editor" id={`stop-editor-${id}`} ref={editor}>
            {matched && (
              <div className="stop-editor__group stop-editor__confirm">
                <p>
                  The map matched this stop to <strong>{name}</strong>
                  {place?.formattedAddress ? `, ${place.formattedAddress}` : ""}. Confirm it so its
                  routes can be checked.
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={locked}
                  onClick={() => void edits.edit({ kind: "place", id, placeId: place!.id })}
                >
                  Use this place
                </button>
              </div>
            )}
            <form
              className="stop-editor__group stop-editor__time"
              onSubmit={(event) => {
                event.preventDefault();
                if (validTime) void edits.edit({ kind: "time", id, startTime: start, endTime: end });
              }}
            >
              <label>
                Start
                <input
                  type="time"
                  required
                  value={start}
                  disabled={locked}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  required
                  value={end}
                  disabled={locked}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
              <button type="submit" disabled={locked || !timeChanged || !validTime}>
                Preview time change
              </button>
              {!validTime && <p className="stop-editor__hint">End must be after start.</p>}
            </form>
            <div className="stop-editor__group stop-editor__order">
              <button
                type="button"
                disabled={locked || index === 0}
                onClick={() =>
                  void edits.edit({ kind: "move", id, day: activity.day!, index: index - 1 })
                }
              >
                Move earlier
              </button>
              <button
                type="button"
                disabled={locked || index === count - 1}
                onClick={() =>
                  void edits.edit({ kind: "move", id, day: activity.day!, index: index + 1 })
                }
              >
                Move later
              </button>
              <label>
                Move to
                <select
                  disabled={locked}
                  value={activity.day}
                  onChange={(event) =>
                    void edits.edit({ kind: "move", id, day: Number(event.target.value), index: 0 })
                  }
                >
                  {Array.from({ length: days }, (_, d) => (
                    <option key={d} value={d + 1}>
                      Day {d + 1} · {dayLabels[d]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <form
              className="stop-editor__group stop-editor__search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim()) void edits.search(query.trim());
              }}
            >
              <label>
                {confirmed || matched ? "Replace with another place" : "Find this place"}
                <span className="stop-editor__search-field">
                  <SearchIcon />
                  <input
                    type="search"
                    value={query}
                    placeholder="Search Google Maps"
                    disabled={locked}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </span>
              </label>
              <button type="submit" disabled={locked || !query.trim()}>
                Search
              </button>
            </form>
            {!!edits.results.length && (
              <ul className="stop-editor__results" aria-label="Place results">
                {edits.results.map((result) => (
                  <li key={result.id}>
                    <span>
                      <strong>{result.displayName?.text ?? "Unnamed place"}</strong>
                      <small>{result.formattedAddress ?? "Address unavailable"}</small>
                    </span>
                    <button
                      type="button"
                      disabled={locked}
                      aria-label={`Use ${result.displayName?.text ?? "this place"}`}
                      onClick={() => void edits.edit({ kind: "place", id, placeId: result.id })}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {place?.googleMapsUri && (
              <p className="stop-editor__footnote">
                {place.rating ? `Google rating ${place.rating} · ` : ""}
                <a href={place.googleMapsUri} target="_blank" rel="noreferrer">
                  Open in Google Maps
                </a>
              </p>
            )}
          </div>
        )}
      </div>
      <span className="timeline-row__cost">
        {activity.estCost === undefined ? "Price unknown" : money(activity.estCost)}
      </span>
    </li>
  );
}
