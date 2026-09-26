"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import {
  connectionBetween,
  dayCount,
  dayLabel,
  dayRows,
  stayingAt,
} from "@/lib/trip/timeline";
import { useSegmentIndicator } from "../ui/motion";
import { FlowStayIcon } from "../ui/flow-icons";
import { DayStrip } from "./timeline/DayStrip";
import { EditPreviewPanel } from "./timeline/EditPreviewPanel";
import { ConnectionRow, FixedTimelineRow } from "./timeline/TimelineParts";
import { TimelineStop } from "./timeline/TimelineStop";
import { useTimelineEdits, type RouteMode } from "./timeline/useTimelineEdits";

/**
 * The Timeline & routes tab: one day at a time, in the order the traveller lives it — the flight or
 * transfer that starts it, each stop with the journey to the next, and the night's check-in.
 *
 * Stops are edited here (time, order, day, place) and every edit is previewed by the server, which
 * re-checks routes, budget and conflicts before anything changes. "Check routes" asks Google for
 * real walking or public-transport times between the day's confirmed places. Selection is shared
 * with the map: choosing a stop in either place highlights it in both.
 */
export function TripEditor({
  plan,
  disabled,
  onApply,
  onPending,
  tripPlaces,
  selected = "",
  onSelect,
  onRoutesChange,
}: {
  plan: TripPlan;
  disabled: boolean;
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  tripPlaces: TripPlaces;
  selected?: string;
  onSelect(activityId: string): void;
  /** Routes to draw on the map: the open preview's routes, otherwise the last verified ones. */
  onRoutesChange?(routes: RouteResult[]): void;
}) {
  const { activities, places, placeIdFor, locationStatus } = tripPlaces;
  const edits = useTimelineEdits({ plan, activities, onApply, onPending, onRoutesChange });
  const days = dayCount(plan);
  const labels = useMemo(
    () => Array.from({ length: days }, (_, index) => dayLabel(plan, index + 1)),
    [plan, days],
  );
  const [day, setDay] = useState(1);
  useEffect(() => setDay((value) => Math.min(Math.max(1, value), days)), [days]);
  const active = activities.find((activity) => activity.id === selected);
  // Selecting a marker on the map jumps the timeline to that stop's day.
  useEffect(() => {
    if (active?.day && active.day !== day) setDay(active.day);
    // Only follow selection changes; a day picked by hand must not be undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const daily = useMemo(
    () => activities.filter((activity) => activity.day === day),
    [activities, day],
  );
  const rows = useMemo(() => dayRows(plan, day, daily), [plan, day, daily]);
  const unconfirmed = daily.filter((activity) => !activity.placeId).length;
  const staying = stayingAt(plan, day);
  const locked = disabled || edits.busy;
  const modes = useRef<HTMLDivElement>(null);
  useSegmentIndicator(modes, edits.mode);
  const strip = useMemo(
    () =>
      labels.map((date, index) => {
        const stops = activities.filter((activity) => activity.day === index + 1);
        return {
          day: index + 1,
          date,
          stops: stops.length,
          attention: stops.some((activity) => locationStatus(activity) !== "located"),
        };
      }),
    [labels, activities, locationStatus],
  );

  // Stops are numbered and connected in the order shown; moves use the plan's own order for the
  // day, which is what the preview endpoint indexes.
  let shown = 0;
  let previous: (typeof daily)[number] | undefined;
  return (
    <section className="trip-editor" aria-label="Trip timeline">
      <DayStrip days={strip} selected={day} onSelect={setDay} />

      <div className="route-check" aria-label="Route check" role="group">
        <div className="route-check__controls">
          <div ref={modes} className="segmented route-check__modes" aria-label="Travel between stops by">
            {(
              [
                ["WALK", "Walk"],
                ["TRANSIT", "Public transport"],
              ] as [RouteMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={edits.mode === value}
                disabled={locked}
                onClick={() => edits.setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={locked || daily.length < 2 || unconfirmed > 0}
            onClick={() => void edits.edit({ kind: "verify", day })}
          >
            Check routes for Day {day}
          </button>
        </div>
        <p className="route-check__hint">
          {daily.length < 2
            ? "Routes are checked between stops; this day has fewer than two."
            : unconfirmed > 0
              ? `Confirm the place for ${unconfirmed} ${unconfirmed === 1 ? "stop" : "stops"} first — select a stop to confirm or search for it.`
              : `Real ${edits.mode === "WALK" ? "walking" : "public transport"} times from Google, leaving when each stop ends, plus 15 minutes to arrive.`}
        </p>
      </div>

      {edits.working && (
        <p className="timeline-status" role="status">
          {edits.working === "search" ? "Searching Google Maps…" : "Checking the change…"}
        </p>
      )}
      {edits.error && (
        <p className="timeline-status timeline-status--error" role="alert">
          {edits.error}
        </p>
      )}

      <div className="timeline-day">
        <h3 className="timeline-day__title">
          Day {day} <span>{labels[day - 1]}</span>
        </h3>
        {staying && (
          <p className="timeline-day__staying">
            <FlowStayIcon size={13} /> Staying at {staying}
          </p>
        )}
        {rows.length ? (
          <ol className="timeline" aria-label={`Day ${day} timeline`}>
            {rows.map((row, position) => {
              if (row.type === "fixed") return <FixedTimelineRow key={row.key} row={row} />;
              const activity = row.activity;
              const placeId = placeIdFor(activity);
              const connection = connectionBetween(previous, activity, edits.routes);
              const number = ++shown;
              previous = activity;
              return (
                <Fragment key={activity.id ?? position}>
                  {connection && <ConnectionRow connection={connection} />}
                  <TimelineStop
                    activity={activity}
                    number={number}
                    index={daily.indexOf(activity)}
                    count={daily.length}
                    days={days}
                    dayLabels={labels}
                    selected={selected === activity.id}
                    locked={locked}
                    place={placeId ? places[placeId] : undefined}
                    status={locationStatus(activity)}
                    edits={edits}
                    onSelect={() => onSelect(selected === activity.id ? "" : activity.id!)}
                  />
                </Fragment>
              );
            })}
          </ol>
        ) : (
          <p className="timeline-empty">
            Nothing planned for this day yet. Ask in the chat to add something, or move a stop here
            from another day.
          </p>
        )}
        {daily.length > 1 && (
          <p className="timeline-day__tip">Drag a stop to reorder the day, or select it to edit.</p>
        )}
      </div>

      {edits.preview && (
        <EditPreviewPanel
          plan={plan}
          preview={edits.preview}
          disabled={disabled}
          onApply={edits.apply}
          onCancel={edits.cancel}
        />
      )}
      {edits.undo && !edits.preview && (
        <div className="timeline-undo">
          <span>Change applied.</span>
          <button type="button" disabled={locked} onClick={() => void edits.edit(edits.undo!)}>
            Undo last change
          </button>
        </div>
      )}
    </section>
  );
}
