"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import { connectionBetween, dayCount, dayLabel, dayRows, stayingAt } from "@/lib/trip/timeline";
import { applyItemAction, type ItemAction } from "@/lib/trip/item-actions";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import { useSegmentIndicator } from "../ui/motion";
import { FlowStayIcon } from "../ui/flow-icons";
import { DayStrip } from "./timeline/DayStrip";
import { ConnectionRow, FixedTimelineRow } from "./timeline/TimelineParts";
import { TimelineStop } from "./timeline/TimelineStop";
import { useTimelineEdits, type RouteMode } from "./timeline/useTimelineEdits";
import { IDLE_AUTO_SAVE, type AutoSaveState } from "./useAutoSavePlaces";

type Activity = TripPlaces["activities"][number];

/**
 * The one view of the trip's days, in the Your Trip drawer and on the phone Trip tab: the day strip,
 * the chosen day's stops in the order the traveller lives them, each with the journey to the next,
 * and then Ideas, the stops with no day yet.
 *
 * Time and place changes, and moves between or within a day, are checked by the server, which
 * re-checks routes, budget and conflicts, and applied at once when accepted; a refused edit leaves the
 * plan unchanged and says why. Details, notes, booked and Remove apply in the browser. "Check routes"
 * asks Google for real walking or public-transport times between the day's confirmed places. Selection
 * is shared with the map: choosing a stop in either place highlights it in both and opens its card.
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
  showPhotos = false,
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
  /** Show each place's first Google photo in its card (live data with a Maps key). */
  showPhotos?: boolean;
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

  // The day's stops in visiting order, numbered as on the map.
  const daily = useMemo(
    () => itinerary.stopsOn(day).map((stop) => stop.activity),
    [itinerary, day],
  );
  const ideas = useMemo(() => itinerary.ideas(), [itinerary]);
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

  // Item actions (details, note, booked, Ideas, Remove, scheduling) apply in the browser and can be
  // undone until the plan changes from elsewhere.
  const [itemUndo, setItemUndo] = useState<{ previous: TripPlan; message: Notice }>();
  const [problem, setProblem] = useState<Notice | "">("");
  const applied = useRef<TripPlan | null>(null);
  // The stop an action or move is taking off this day; focus returns to the day heading once it is gone.
  const leaving = useRef<string | undefined>(undefined);
  const dayTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (applied.current !== plan) setItemUndo(undefined);
    applied.current = null;
  }, [plan]);
  useEffect(() => {
    const id = leaving.current;
    leaving.current = undefined;
    if (id !== undefined && !daily.some((activity) => activity.id === id))
      dayTitle.current?.focus({ preventScroll: true });
    // Runs when the plan changes; the stop list it reads comes from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const act = (activity: Activity, action: ItemAction, message: Notice): boolean => {
    if (!activity.id) return false;
    try {
      const next = applyItemAction(plan, activity.id, action);
      applied.current = next;
      setItemUndo({ previous: plan, message });
      setProblem("");
      if (action.kind === "day" || action.kind === "idea" || action.kind === "remove")
        leaving.current = activity.id;
      onApply(next);
      return true;
    } catch (error) {
      setProblem(
        error instanceof NoticeError ? error.notice : { key: "That change could not be made." },
      );
      return false;
    }
  };

  // Everything a stop row needs from this view, for a stop on the day or an idea.
  const stopProps = (activity: Activity) => {
    const placeId = placeIdFor(activity);
    return {
      activity,
      number: activity.id ? itinerary.stop(activity.id)?.number : undefined,
      days,
      dayLabels: labels,
      selected: selected === activity.id,
      locked,
      place: placeId ? places[placeId] : undefined,
      status: locationStatus(activity),
      edits,
      showPhotos,
      saveState: (saves.saving === activity.id
        ? "saving"
        : saves.failed.has(activity.id!)
          ? "failed"
          : "") as "" | "saving" | "failed",
      onSelect: () => onSelect(selected === activity.id ? "" : activity.id!),
      onOpen: () => onSelect(activity.id!),
      onItem: (action: ItemAction, message: Notice) => act(activity, action, message),
    };
  };

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
      {problem && (
        <p className="item-problem" role="alert">
          {localizeNotice(problem)}
        </p>
      )}
      {itemUndo ? (
        <div className="item-undo" role="status">
          <span>{localizeNotice(itemUndo.message)}</span>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              applied.current = itemUndo.previous;
              onApply(itemUndo.previous);
              setItemUndo(undefined);
            }}
          >
            {t("Undo")}
          </button>
        </div>
      ) : (
        edits.undo && (
          <div className="timeline-undo">
            <span>{t("Change applied.")}</span>
            <button type="button" disabled={locked} onClick={() => void edits.edit(edits.undo!)}>
              {t("Undo last change")}
            </button>
          </div>
        )
      )}

      <div className="timeline-day">
        <h3 ref={dayTitle} id="timeline-day-title" tabIndex={-1} className="timeline-day__title">
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
              const connection = connectionBetween(previous, activity, edits.routes, locale);
              previous = activity;
              return (
                <Fragment key={activity.id ?? position}>
                  {connection && <ConnectionRow key={connection.status} connection={connection} />}
                  <TimelineStop
                    {...stopProps(activity)}
                    index={daily.indexOf(activity)}
                    count={daily.length}
                    dropIndex={(moved) =>
                      itinerary.planIndex(
                        moved,
                        day,
                        daily.filter((other) => other.id !== moved).indexOf(activity),
                      )
                    }
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

      {ideas.length > 0 && (
        <section className="timeline-ideas" aria-labelledby="timeline-ideas-title">
          <h4 id="timeline-ideas-title" tabIndex={-1} className="timeline-ideas__title">
            {t("Ideas")}
          </h4>
          <p className="timeline-ideas__hint">
            {t("Set aside for later. Schedule one on a day from its menu.")}
          </p>
          <ol className="timeline" aria-label={t("Stops, {v0}", { v0: t("Ideas") })}>
            {ideas.map((idea, position) => (
              <TimelineStop
                key={idea.id ?? `idea-${position}`}
                {...stopProps(idea)}
                index={0}
                count={1}
              />
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
