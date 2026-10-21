"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { Fragment, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { RouteResult } from "@/lib/integrations/google";
import type { TripPlaces } from "../map/useTripPlaces";
import { connectionBetween, dayCount, dayLabel, dayRows, stayingAt } from "@/lib/trip/timeline";
import { onTripDay, OnTripContext } from "@/lib/trip/on-trip-day";
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
import { useTimelineEdits } from "./timeline/useTimelineEdits";
import { TripTips } from "./TripTips";
import { IDLE_AUTO_SAVE, type AutoSaveState } from "./useAutoSavePlaces";
import type { LegState } from "./useLegRoutes";
import type { EditOperation, PlanRevisions } from "./plan-revision";

type Activity = TripPlaces["activities"][number];

const selectedDayKey = (tripId: string) => `trip-day-selected:${tripId}`;

function savedDay(tripId: string): { day: number; selectedOnToday: number | null } | undefined {
  try {
    const value = window.localStorage.getItem(selectedDayKey(tripId));
    if (value === null) return undefined;
    const saved = JSON.parse(value) as { day?: unknown; selectedOnToday?: unknown };
    return Number.isInteger(saved.day) && Number(saved.day) > 0
      ? {
          day: Number(saved.day),
          selectedOnToday:
            Number.isInteger(saved.selectedOnToday) && Number(saved.selectedOnToday) > 0
              ? Number(saved.selectedOnToday)
              : null,
        }
      : undefined;
  } catch {
    return undefined;
  }
}

function rememberDay(tripId: string, day: number, today: number | undefined) {
  try {
    window.localStorage.setItem(
      selectedDayKey(tripId),
      JSON.stringify({ day, selectedOnToday: today ?? null }),
    );
  } catch {
    return;
  }
}

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
  revisions,
  showPhotos = false,
  saves = IDLE_AUTO_SAVE,
  onChoose,
  onTimelineChange,
}: {
  plan: TripPlan;
  disabled: boolean;
  onApply(plan: TripPlan): void;
  onPending(value: boolean): void;
  tripPlaces: TripPlaces;
  selected?: string;
  onSelect(activityId: string): void;

  onRoutesChange?(routes: RouteResult[]): void;

  routes?: RouteResult[];

  legs?: LegState;

  onLegApplied?(plan: TripPlan, day: number): void;

  revisions: PlanRevisions;

  showPhotos?: boolean;

  saves?: AutoSaveState;

  onChoose?: ChooseCandidate;

  onTimelineChange?(changed: boolean): void;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const { settings } = useSettings();
  const { activities, itinerary, places, placeIdFor, locationStatus } = tripPlaces;
  const edits = useTimelineEdits({
    plan,
    dataMode: tripPlaces.dataMode,
    activities,
    revisions,
    onPending,
    onRoutesChange,
    onLegApplied,
    onTimelineChange,
  });
  const days = dayCount(plan);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const timer = window.setInterval(refreshNow, 60_000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, []);
  const today = onTripDay(plan.brief.dates, tripPlaces.destinations[0], now);
  const setOnTrip = useContext(OnTripContext);
  useEffect(() => {
    setOnTrip(tripPlaces.destinationsSettled ? today !== undefined : undefined);
  }, [plan.tripId, setOnTrip, today, tripPlaces.destinationsSettled]);

  const conflicts = useMemo(() => placeConflicts(plan), [plan]);
  const labels = useMemo(
    () => Array.from({ length: days }, (_, index) => dayLabel(plan, index + 1, locale)),
    [plan, days, locale],
  );
  const [day, setDay] = useState(1);
  const manuallySelectedDay = useRef(false);
  const selectedTrip = useRef(plan.tripId);
  useEffect(() => {
    if (selectedTrip.current === plan.tripId) return;
    selectedTrip.current = plan.tripId;
    manuallySelectedDay.current = false;
    setDay(1);
  }, [plan.tripId]);
  useEffect(() => {
    const restoredDay = savedDay(plan.tripId);
    if (restoredDay === undefined) return;
    if (restoredDay.day > days) {
      manuallySelectedDay.current = false;
      setDay(today ?? 1);
      return;
    }
    if (today === undefined) {
      manuallySelectedDay.current = false;
      setDay(1);
      return;
    }
    if (today !== undefined && restoredDay.selectedOnToday !== today) {
      manuallySelectedDay.current = false;
      setDay(today);
      return;
    }
    manuallySelectedDay.current = true;
    setDay(restoredDay.day);
  }, [days, plan.tripId, today]);
  useEffect(() => {
    if (!manuallySelectedDay.current && today) setDay(today);
  }, [today, plan.tripId]);
  useEffect(() => setDay((value) => Math.min(Math.max(1, value), days)), [days]);
  const selectDay = (next: number) => {
    manuallySelectedDay.current = true;
    setDay(next);
    rememberDay(plan.tripId, next, today);
  };
  const active = activities.find((activity) => activity.id === selected);

  useEffect(() => {
    if (active?.day && active.day !== day) setDay(active.day);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

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

  const [itemUndo, setItemUndo] = useState<{ previous: TripPlan; message: Notice }>();
  const dayPanelId = `trip-day-panel-${useId().replaceAll(":", "")}`;
  const [problem, setProblem] = useState<Notice | "">("");
  const applied = useRef<TripPlan | null>(null);

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
        applied.current = next;
        setItemUndo({ previous, message });
        setProblem("");
        if (action.kind === "day" || action.kind === "idea" || action.kind === "remove")
          leaving.current = id;
      });
    try {
      const next = applyItemAction(plan, id, action, settings.displayCurrency);
      applied.current = next;
      setItemUndo({ previous: plan, message });
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
    };
  };

  let previous: (typeof daily)[number] | undefined;
  return (
    <section className="trip-editor" aria-label={t("Trip timeline")}>
      <TripTips key={plan.tripId} plan={plan} onTrip={today !== undefined} />
      <DayStrip
        days={strip}
        selected={day}
        today={today}
        panelId={dayPanelId}
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
              applied.current = itemUndo.previous;
              onApply(itemUndo.previous);
              setItemUndo(undefined);
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
        {rows.length ? (
          <ol
            key={day}
            className="timeline tab-panel-enter"
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
              return (
                <Fragment key={activity.id ?? position}>
                  {connection && (
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
