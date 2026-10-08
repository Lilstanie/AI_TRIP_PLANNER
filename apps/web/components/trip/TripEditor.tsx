"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import { connectionBetween, dayCount, dayLabel, dayRows, stayingAt } from "@/lib/trip/timeline";
import { applyItemAction, type ItemAction } from "@/lib/trip/item-actions";
import type { LegMode } from "@/lib/trip/leg-routes";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import type { DataMode } from "@/lib/workspace/data-mode";
import { FlowStayIcon } from "../ui/flow-icons";
import { DayStrip } from "./timeline/DayStrip";
import { FixedTimelineRow, LegRow } from "./timeline/TimelineParts";
import { TimelineStop } from "./timeline/TimelineStop";
import { useTimelineEdits } from "./timeline/useTimelineEdits";
import { IDLE_AUTO_SAVE, type AutoSaveState } from "./useAutoSavePlaces";
import type { LegState } from "./useLegRoutes";

type Activity = TripPlaces["activities"][number];

/**
 * The one view of the trip's days, in the Your Trip drawer and on the phone Trip tab: the day strip,
 * the chosen day's stops in the order the traveller lives them, each with the leg into it, and then
 * Ideas, the stops with no day yet.
 *
 * Time and place changes, and moves between or within a day, are checked by the server, which
 * re-checks routes, budget and conflicts, and applied at once when accepted; a refused edit leaves the
 * plan unchanged and says why. The travel time of each leg is worked out by the workspace once a day's
 * places are saved (`routes`), and a leg's mode is changed here, for that leg alone. Details, notes,
 * booked and Remove apply in the browser. Selection is shared with the map: choosing a stop in either
 * place highlights it in both and opens its card.
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
  routes = [],
  legs,
  onLegApplied,
  dataMode,
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
  /** Routes an applied edit verified; the workspace keeps them for the legs and the map. */
  onRoutesChange?(routes: RouteResult[]): void;
  /** The routes verified for the current plan: each leg's travel time and mode come from these. */
  routes?: RouteResult[];
  /** The workspace's routing of the day's legs: whether it is running, and why it stopped. */
  legs?: LegState;
  /** An applied leg change: its day is current, so the other legs are not routed again. */
  onLegApplied?(plan: TripPlan, day: number): void;
  dataMode: DataMode | undefined;
  /** Show each place's first Google photo in its card (live data with a Maps key). */
  showPhotos?: boolean;
  /** Which stop's map place is being saved, or failed to save, on the workspace. */
  saves?: AutoSaveState;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const { activities, itinerary, places, placeIdFor, locationStatus } = tripPlaces;
  const edits = useTimelineEdits({
    plan,
    activities,
    dataMode,
    onApply,
    onPending,
    onRoutesChange,
    onLegApplied,
  });
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
  const staying = stayingAt(plan, day);
  const locked = disabled || edits.busy;
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

      {legs?.working && (
        <p className="timeline-status" role="status">
          {t("Checking travel times…")}
        </p>
      )}
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
      {!!legs?.problems.length && (
        <ul className="timeline-status timeline-status--error" role="alert">
          {legs.problems.map((error, index) => (
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
          <div className="timeline-undo" role="status">
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
              const connection = connectionBetween(previous, activity, routes, locale);
              const from = previous;
              previous = activity;
              // A leg has a control once both of its stops have saved places: only then is it routable.
              const routable = !!(from?.placeId && activity.placeId);
              return (
                <Fragment key={activity.id ?? position}>
                  {connection && (
                    // Keyed by status in the parent, so a journey that becomes checked mounts again and draws in.
                    <LegRow
                      key={connection.status}
                      connection={connection}
                      from={from ? (from.location ?? from.detail) : ""}
                      to={activity.location ?? activity.detail}
                      {...(routable && activity.id
                        ? {
                            locked,
                            onChoose: (mode: LegMode) => void edits.leg(activity.id!, mode),
                          }
                        : {})}
                    />
                  )}
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
