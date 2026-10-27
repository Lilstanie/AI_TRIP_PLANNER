"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { Fragment, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import { connectionBetween, dayCount, dayLabel, dayRows, stayingAt } from "@/lib/trip/timeline";
import { OnTripContext } from "@/lib/trip/on-trip-day";
import { applyItemAction, type ItemAction } from "@/lib/trip/item-actions";
import type { LegMode } from "@/lib/trip/leg-routes";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import { FlowStayIcon } from "../ui/flow-icons";
import { restaurantSuggestions } from "@/lib/trip/restaurants";
import { placeConflicts } from "@/lib/trip/conflicts";
import { DayStrip } from "./timeline/DayStrip";
import { BookingRow, type ChooseCandidate } from "./timeline/BookingRow";
import { FixedTimelineRow, LegRow } from "./timeline/TimelineParts";
import { TimelineStop } from "./timeline/TimelineStop";
import type { TripUndo } from "./useTripUndo";
import { useTimelineEdits } from "./timeline/useTimelineEdits";
import { AddStop } from "./timeline/AddStop";
import { TripChatShortcut } from "./timeline/TripChatShortcut";
import { TripTips } from "./TripTips";
import { useTripDay } from "./useTripDay";
import { useShowDistances } from "./useShowDistances";
import { useItineraryDrag } from "./useItineraryDrag";
import { END_OF_DAY, zoneKey, type DragSource, type DropTarget } from "@/lib/trip/drag-target";
import { Switch } from "../account/SettingsControls";
import { directionsUrl } from "@/lib/trip/leg-distance";
import { IDLE_AUTO_SAVE, type AutoSaveState } from "./useAutoSavePlaces";
import type { LegState } from "./useLegRoutes";
import type { EditOperation, PlanRevisions } from "./plan-revision";

type Activity = TripPlaces["activities"][number];

function checkedAs(id: string, action: ItemAction): EditOperation | undefined {
  switch (action.kind) {
    case "remove":
      return { kind: "remove", id };
    case "idea":
      return { kind: "idea", id };
    case "day":
      return { kind: "schedule", id, day: action.day };
    case "move":
      return { kind: "swap", id, direction: action.direction };
    default:
      return undefined;
  }
}

const HOVER_OPEN_MS = 600;

function DropLine() {
  return <li className="timeline-drop-line" aria-hidden="true" />;
}

export function TripEditor({
  plan,
  disabled,
  onApply,
  onPending,
  tripPlaces,
  selected = "",
  day: controlledDay,
  onDayChange,
  onSelect,
  onSend,
  onRoutesChange,
  routes = [],
  legs,
  onLegApplied,
  revisions,
  undo,
  showPhotos = false,
  saves = IDLE_AUTO_SAVE,
  onChoose,
  onTimelineChange,
  phone = false,
}: {
  plan: TripPlan;
  disabled: boolean;
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  tripPlaces: TripPlaces;
  selected?: string;
  day?: number;
  onDayChange?(day: number): void;
  onSelect(activityId: string): void;
  onSend?(message: string): void;

  onRoutesChange?(routes: RouteResult[]): void;

  routes?: RouteResult[];

  legs?: LegState;

  onLegApplied?(plan: TripPlan, day: number): void;

  revisions: PlanRevisions;
  undo: TripUndo;

  showPhotos?: boolean;

  saves?: AutoSaveState;

  onChoose?: ChooseCandidate;

  onTimelineChange?(changed: boolean): void;

  phone?: boolean;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const { settings } = useSettings();
  const { activities, itinerary, places, placeIdFor, locationStatus } = tripPlaces;
  const edits = useTimelineEdits({
    plan,
    dataMode: tripPlaces.dataMode,
    activities,
    revisions,
    undo,
    onPending,
    onRoutesChange,
    onLegApplied,
    onTimelineChange,
  });
  const [showDistances, setShowDistances] = useShowDistances();
  const days = dayCount(plan);
  const { day, today, selectDay } = useTripDay(
    plan,
    tripPlaces.destinations[0],
    selected,
    controlledDay !== undefined && onDayChange
      ? { day: controlledDay, onChange: onDayChange }
      : undefined,
    tripPlaces.destinationsSettled,
  );
  const setOnTrip = useContext(OnTripContext);
  useEffect(() => {
    setOnTrip(tripPlaces.destinationsSettled ? today !== undefined : undefined);
  }, [plan.tripId, setOnTrip, today, tripPlaces.destinationsSettled]);

  const conflicts = useMemo(() => placeConflicts(plan), [plan]);
  const labels = useMemo(
    () => Array.from({ length: days }, (_, index) => dayLabel(plan, index + 1, locale)),
    [plan, days, locale],
  );
  const daily = useMemo(
    () => itinerary.stopsOn(day).map((stop) => stop.activity),
    [itinerary, day],
  );
  const suggestions = useMemo(() => restaurantSuggestions(plan), [plan]);
  const suggested = useMemo(() => new Set(suggestions.map((item) => item.id)), [suggestions]);
  const ideas = useMemo(
    () => [...itinerary.ideas(), ...suggestions] as Activity[],
    [itinerary, suggestions],
  );
  const rows = useMemo(() => dayRows(plan, day, daily, locale), [plan, day, daily, locale]);
  const sourceOf = (sectionId: "accommodation" | "transport") =>
    plan.sections.find((section) => section.id === sectionId)?.proposal?.source;
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

  const itemUndo = undo.step && "previous" in undo.step ? undo.step : undefined;
  const dayPanelId = `trip-day-panel-${useId().replaceAll(":", "")}`;
  const [problem, setProblem] = useState<Notice | "">("");

  const leaving = useRef<string | undefined>(undefined);
  const dayTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const id = leaving.current;
    leaving.current = undefined;
    if (id !== undefined && !daily.some((activity) => activity.id === id))
      dayTitle.current?.focus({ preventScroll: true });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const act = (
    activity: Activity,
    action: ItemAction,
    message: Notice,
  ): boolean | Promise<boolean> => {
    if (!activity.id) return false;
    const id = activity.id;
    const operation = checkedAs(id, action);
    if (operation)
      return edits.edit(operation, (previous, next) => {
        undo.record(next, { previous, message });
        setProblem("");
        if (action.kind === "day" || action.kind === "idea" || action.kind === "remove")
          leaving.current = id;
      });
    try {
      const next = applyItemAction(plan, id, action, settings.displayCurrency);
      undo.record(next, { previous: plan, message });
      setProblem("");
      onTimelineChange?.(true);
      onApply(next);
      return true;
    } catch (error) {
      setProblem(
        error instanceof NoticeError ? error.notice : { key: "That change could not be made." },
      );
      return false;
    }
  };

  const [announcement, setAnnouncement] = useState<Notice | undefined>();
  const commitMove = async (activity: Activity, day: number, index: number) => {
    if (!activity.id) return;
    const id = activity.id;
    const total = itinerary.stopsOn(day).filter((stop) => stop.activity.id !== id).length + 1;
    const done = await edits.edit(
      { kind: "move", id, day, index: itinerary.planIndex(id, day, index) },
      () => {
        setProblem("");
        setAnnouncement({
          key: "{name} moved to position {position} of {total} on Day {day}.",
          params: {
            name: activity.location ?? activity.detail,
            position: Math.min(index, total - 1) + 1,
            total,
            day,
          },
        });
      },
    );
    return done;
  };
  const drag = useItineraryDrag({
    locked,
    accepts: (source, zone) => (source.zone.kind === "ideas" ? zone.kind === "day" : true),
    onDrop: (source: DragSource, target: DropTarget) => {
      const moved = activities.find((activity) => activity.id === source.id);
      if (!moved?.id) return;
      const name = moved.location ?? moved.detail;
      if (target.zone.kind === "ideas") {
        if (moved.day !== undefined)
          void act(moved, { kind: "idea" }, { key: "{name} moved to Ideas.", params: { name } });
        return;
      }
      const to = target.zone.day;
      if (moved.day === undefined) {
        void act(
          moved,
          { kind: "day", day: to },
          { key: "{name} scheduled on Day {day}.", params: { name, day: to } },
        );
        return;
      }
      if (moved.day === to) {
        if (target.index === END_OF_DAY) return;
        const shown = itinerary.stopsOn(to).map((stop) => stop.activity);
        if (target.index === shown.indexOf(moved)) return;
      }
      void commitMove(moved, to, target.index);
    },
  });
  const reorder = (activity: Activity, direction: -1 | 1) => {
    const to = daily.indexOf(activity) + direction;
    if (!locked && activity.day !== undefined && to >= 0 && to < daily.length)
      void commitMove(activity, activity.day, to);
  };

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
      suggestion: !!activity.id && suggested.has(activity.id),
      saveState: (saves.saving === activity.id
        ? "saving"
        : saves.failed.has(activity.id!)
          ? "failed"
          : "") as "" | "saving" | "failed",
      onSelect: () => onSelect(selected === activity.id ? "" : activity.id!),
      onOpen: () => onSelect(activity.id!),
      conflicts: (activity.id && conflicts.stops.get(activity.id)) || [],
      onItem: (action: ItemAction, message: Notice) => act(activity, action, message),
      ...(!activity.id
        ? {}
        : activity.day === undefined
          ? suggested.has(activity.id)
            ? {}
            : { drag: drag.rowProps({ id: activity.id, zone: { kind: "ideas" } }) }
          : {
              drag: drag.rowProps({ id: activity.id, zone: { kind: "day", day: activity.day } }),
              onReorder: (direction: -1 | 1) => reorder(activity, direction),
            }),
      ...(activity.day === undefined || !onSend ? {} : { onAskAI: onSend }),
      phone,
    };
  };

  let previous: (typeof daily)[number] | undefined;
  let shownCount = 0;
  const dragged = activities.find((activity) => activity.id === drag.dragging);
  const aim = drag.target;
  const lineAt =
    aim?.zone.kind === "day" && aim.zone.day === day && aim.index !== END_OF_DAY
      ? dragged?.day === undefined
        ? daily.length
        : aim.index
      : -1;
  const dropDay =
    aim?.zone.kind === "day" && aim.index === END_OF_DAY && dragged?.day !== aim.zone.day
      ? aim.zone.day
      : undefined;
  const overIdeas = aim?.zone.kind === "ideas";
  const hoverDay = dropDay !== undefined && dropDay !== day ? dropDay : undefined;
  useEffect(() => {
    if (hoverDay === undefined) return;
    const timer = window.setTimeout(() => selectDay(hoverDay), HOVER_OPEN_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverDay]);
  return (
    <section className="trip-editor" aria-label={t("Trip timeline")}>
      <p className="sr-only" role="status">
        {announcement ? localizeNotice(announcement) : ""}
      </p>
      <TripTips key={plan.tripId} plan={plan} onTrip={today !== undefined} />
      {today !== undefined && day !== today && (
        <button className="trip-editor__today" type="button" onClick={() => selectDay(today)}>
          {t("Return to today")}
        </button>
      )}
      <div className="trip-editor__distances">
        <span>{t("Show distances")}</span>
        <Switch label={t("Show distances")} checked={showDistances} onChange={setShowDistances} />
      </div>
      <section
        className="timeline-ideas"
        aria-labelledby="timeline-ideas-title"
        {...(overIdeas ? { "data-drop-target": "true" } : {})}
      >
        <h4 id="timeline-ideas-title" tabIndex={-1} className="timeline-ideas__title">
          {t("Ideas")}
        </h4>
        {ideas.length > 0 && (
          <p className="timeline-ideas__hint">
            {t("Set aside for later. Schedule one on a day from its menu.")}
          </p>
        )}
        <ol
          className="timeline"
          data-drop-zone="ideas"
          aria-label={t("Stops, {v0}", { v0: t("Ideas") })}
        >
          {ideas.map((idea, position) => (
            <TimelineStop
              key={idea.id ?? `idea-${position}`}
              {...stopProps(idea)}
              index={0}
              count={1}
            />
          ))}
          {overIdeas && <DropLine />}
        </ol>
      </section>
      <DayStrip
        days={strip}
        selected={day}
        today={today}
        panelId={dayPanelId}
        {...(dropDay !== undefined ? { dropDay } : {})}
        onSelect={selectDay}
      />

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
      {!!(revisions.stale || legs?.problems.length) && (
        <ul className="timeline-status timeline-status--error" role="alert">
          {(revisions.stale ? [revisions.stale] : legs!.problems).map((error, index) => (
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
              onApply(itemUndo.previous);
              undo.clear();
              onTimelineChange?.(false);
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

      <div
        id={dayPanelId}
        className="timeline-day"
        role="tabpanel"
        aria-labelledby={`${dayPanelId}-day-tab-${day}`}
        tabIndex={0}
      >
        <h3 ref={dayTitle} id="timeline-day-title" tabIndex={-1} className="timeline-day__title">
          {t("Day {v0}", { v0: day })} <span>{labels[day - 1]}</span>
        </h3>
        <TripChatShortcut day={day} onSend={(message) => onSend?.(message)} />
        {staying && (
          <p className="timeline-day__staying">
            <FlowStayIcon size={13} /> {t("Staying at {place}", { place: staying })}
          </p>
        )}
        {!!conflicts.days.get(day)?.length && (
          <ul className="timeline-day__conflicts" aria-label={t("Open conflicts")}>
            {conflicts.days.get(day)!.map((notice, index) => (
              <li key={index}>{localizeNotice(notice)}</li>
            ))}
          </ul>
        )}
        <>
          <ol
            key={day}
            className="timeline tab-panel-enter"
            data-drop-zone={zoneKey({ kind: "day", day })}
            {...(rows.length ? {} : { "data-empty": "true" })}
            aria-label={t("Day {v0} timeline", { v0: day })}
          >
            {rows.map((row, position) => {
              if (row.type === "fixed") return <FixedTimelineRow key={row.key} row={row} />;
              if (row.type === "booking")
                return (
                  <BookingRow
                    key={row.key}
                    row={row}
                    source={sourceOf(row.sectionId)}
                    {...(onChoose ? { onChoose } : {})}
                  />
                );
              const activity = row.activity;
              const connection = connectionBetween(previous, activity, routes, locale);
              const from = previous;
              previous = activity;

              const routable = !!(from?.placeId && activity.placeId);
              const endpoint = (stop: typeof activity) => {
                const id = placeIdFor(stop);
                return {
                  name: stop.location ?? stop.detail,
                  ...(id ? { placeId: id, location: places[id]?.location } : {}),
                };
              };
              const directions = from
                ? directionsUrl(endpoint(from), endpoint(activity))
                : undefined;
              return (
                <Fragment key={activity.id ?? position}>
                  {activity.id !== drag.dragging && lineAt === shownCount++ && <DropLine />}
                  {connection && (
                    <LegRow
                      key={connection.status}
                      connection={connection}
                      showDistance={showDistances}
                      {...(directions ? { directions } : {})}
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
                  />
                </Fragment>
              );
            })}
            {lineAt === shownCount && <DropLine />}
          </ol>
          {!rows.length && (
            <p className="timeline-empty">{t("Nothing planned for this day yet.")}</p>
          )}
        </>
        {daily.length > 1 && (
          <p className="timeline-day__tip">
            {t("Drag a stop to reorder the day, or select it to edit.")}
          </p>
        )}
      </div>

      <AddStop day={day} locked={locked} edits={edits} />
    </section>
  );
}
