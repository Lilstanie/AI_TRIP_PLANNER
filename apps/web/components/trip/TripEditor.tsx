"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import { connectionBetween, dayCount, dayLabel, dayRows, stayingAt } from "@/lib/trip/timeline";
import { useSegmentIndicator } from "../ui/motion";
import { FlowStayIcon } from "../ui/flow-icons";
import { DayStrip } from "./timeline/DayStrip";
import { ConnectionRow, FixedTimelineRow } from "./timeline/TimelineParts";
import { TimelineStop } from "./timeline/TimelineStop";
import { useTimelineEdits, type RouteMode } from "./timeline/useTimelineEdits";
import { IDLE_AUTO_SAVE, type AutoSaveState } from "./useAutoSavePlaces";

/**
 * The Timeline & routes tab: one day at a time, in the order the traveller lives it — the flight or
 * transfer that starts it, each stop with the journey to the next, and the night's check-in.
 *
 * Stops are edited here (time, order, day, place). Each edit is checked by the server, which
 * re-checks routes, budget and conflicts, and applies at once when accepted; a refused edit leaves the
 * plan unchanged and says why. "Check routes" asks Google for real walking or public-transport times
 * between the day's confirmed places. Selection is shared with the map: choosing a stop in either
 * place highlights it in both.
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
  saves = IDLE_AUTO_SAVE,
}: {
  plan: TripPlan;
  disabled: boolean;
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  tripPlaces: TripPlaces;
  selected?: string;
  onSelect(activityId: string): void;
  /** Routes to draw on the map: the routes verified for the current plan. */
  onRoutesChange?(routes: RouteResult[]): void;
  /** Which stop's map place is being saved, or failed to save, on the workspace. */
  saves?: AutoSaveState;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const { activities, itinerary, places, placeIdFor, locationStatus } = tripPlaces;
  const edits = useTimelineEdits({ plan, activities, onApply, onPending, onRoutesChange });
  const days = dayCount(plan);
  const labels = useMemo(
    () => Array.from({ length: days }, (_, index) => dayLabel(plan, index + 1, locale)),
    [plan, days, locale],
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

  // The day's stops in visiting order, numbered as on the map and the trip list.
  const daily = useMemo(
    () => itinerary.stopsOn(day).map((stop) => stop.activity),
    [itinerary, day],
  );
  const rows = useMemo(() => dayRows(plan, day, daily, locale), [plan, day, daily, locale]);
  const unconfirmed = daily.filter((activity) => !activity.placeId).length;
  const staying = stayingAt(plan, day);
  const locked = disabled || edits.busy;
  const modes = useRef<HTMLDivElement>(null);
  useSegmentIndicator(modes, edits.mode);
  const strip = useMemo(
    () =>
      labels.map((date, index) => {
        const stops = itinerary.stopsOn(index + 1).map((stop) => stop.activity);
        return {
          day: index + 1,
          date,
          stops: stops.length,
          attention: stops.some((activity) => locationStatus(activity) !== "located"),
        };
      }),
    [labels, itinerary, locationStatus],
  );

  // Stops are connected in the order shown and carry their trip-wide stop number. Moves name a
  // shown position; the Itinerary turns it into the plan index the preview endpoint needs.
  let previous: (typeof daily)[number] | undefined;
  return (
    <section className="trip-editor" aria-label={t("Trip timeline")}>
      <DayStrip days={strip} selected={day} onSelect={setDay} />

      <div className="route-check" aria-label={t("Route check")} role="group">
        <div className="route-check__controls">
          <div
            ref={modes}
            className="segmented route-check__modes"
            aria-label={t("Travel between stops by")}
          >
            {(
              [
                ["WALK", "Walk"],
                ["TRANSIT", "Public transport"],
              ] as [RouteMode, "Walk" | "Public transport"][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={edits.mode === value}
                disabled={locked}
                onClick={() => edits.setMode(value)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={locked || daily.length < 2 || unconfirmed > 0}
            onClick={() => void edits.edit({ kind: "verify", day })}
          >
            {t("Check routes for Day {day}", { day })}
          </button>
        </div>
        <p className="route-check__hint">
          {daily.length < 2
            ? t("Routes are checked between stops; this day has fewer than two.")
            : unconfirmed > 0
              ? t(
                  "Confirm the place for {count} stops first — select a stop to confirm or search for it.",
                  { count: unconfirmed },
                )
              : t(
                  "Real {mode} times from Google, leaving when each stop ends, plus 15 minutes to arrive.",
                  { mode: t(edits.mode === "WALK" ? "walking" : "public transport") },
                )}
        </p>
      </div>

      {edits.working && (
        <p className="timeline-status" role="status">
          {edits.working === "search" ? t("Searching Google Maps…") : t("Checking the change…")}
        </p>
      )}
      {!!edits.errors.length && (
        <ul className="timeline-status timeline-status--error" role="alert">
          {edits.errors.map((error, index) => (
            <li key={index}>{localizeNotice(error)}</li>
          ))}
        </ul>
      )}

      <div className="timeline-day">
        <h3 className="timeline-day__title">
          {t("Day {v0}", { v0: day })} <span>{labels[day - 1]}</span>
        </h3>
        {staying && (
          <p className="timeline-day__staying">
            <FlowStayIcon size={13} /> {t("Staying at {place}", { place: staying })}
          </p>
        )}
        {rows.length ? (
          <ol
            key={day}
            className="timeline tab-panel-enter"
            aria-label={t("Day {v0} timeline", { v0: day })}
          >
            {rows.map((row, position) => {
              if (row.type === "fixed") return <FixedTimelineRow key={row.key} row={row} />;
              const activity = row.activity;
              const placeId = placeIdFor(activity);
              const connection = connectionBetween(previous, activity, edits.routes, locale);
              previous = activity;
              return (
                <Fragment key={activity.id ?? position}>
                  {connection && <ConnectionRow key={connection.status} connection={connection} />}
                  <TimelineStop
                    activity={activity}
                    number={itinerary.stop(activity.id!)?.number}
                    index={daily.indexOf(activity)}
                    planIndex={itinerary.planIndex}
                    dropIndex={(moved) =>
                      itinerary.planIndex(
                        moved,
                        day,
                        daily.filter((other) => other.id !== moved).indexOf(activity),
                      )
                    }
                    count={daily.length}
                    days={days}
                    dayLabels={labels}
                    selected={selected === activity.id}
                    locked={locked}
                    place={placeId ? places[placeId] : undefined}
                    status={locationStatus(activity)}
                    saveState={
                      saves.saving === activity.id
                        ? "saving"
                        : saves.failed.has(activity.id!)
                          ? "failed"
                          : ""
                    }
                    edits={edits}
                    onSelect={() => onSelect(selected === activity.id ? "" : activity.id!)}
                  />
                </Fragment>
              );
            })}
          </ol>
        ) : (
          <p className="timeline-empty">
            {t(
              "Nothing planned for this day yet. Ask in the chat to add something, or move a stop here from another day.",
            )}
          </p>
        )}
        {daily.length > 1 && (
          <p className="timeline-day__tip">
            {t("Drag a stop to reorder the day, or select it to edit.")}
          </p>
        )}
      </div>

      {edits.undo && (
        <div className="timeline-undo">
          <span>{t("Change applied.")}</span>
          <button type="button" disabled={locked} onClick={() => void edits.edit(edits.undo!)}>
            {t("Undo last change")}
          </button>
        </div>
      )}
    </section>
  );
}
