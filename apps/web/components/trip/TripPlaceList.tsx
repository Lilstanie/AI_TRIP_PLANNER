"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { applyItemAction, type ItemAction } from "@/lib/trip/item-actions";
import { NoticeError, type Notice } from "@/lib/i18n/notice";
import { dayCount, dayLabel } from "@/lib/trip/timeline";
import type { TripPlaces } from "../map/useTripPlaces";
import { ActionMenu, type ActionMenuItem } from "../ui/ActionMenu";
import {
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  ComposeIcon,
  SuitcaseIcon,
} from "../ui/icons";

type Activity = TripPlaces["activities"][number];
type Editing = { id: string; mode: "details" | "note" | "schedule" };

function dayDate(start: string, day: number) {
  const time = Date.parse(start);
  if (!Number.isFinite(time)) return undefined;
  return new Date(time + (day - 1) * 86400000).toISOString().slice(0, 10);
}

/** The small form under a row for editing details, a note, or picking an idea's day. */
function ItemEditor({
  activity,
  editing,
  days,
  labels,
  onSubmit,
  onCancel,
}: {
  activity: Activity;
  editing: Editing;
  days: number;
  labels: string[];
  onSubmit(action: ItemAction): void;
  onCancel(): void;
}) {
  const { t, notice: localizeNotice } = useLocale();
  const [detail, setDetail] = useState(activity.detail);
  const [location, setLocation] = useState(activity.location ?? "");
  const [note, setNote] = useState(activity.note ?? "");
  const [day, setDay] = useState(1);
  const first = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <form
      className="item-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (editing.mode === "details") onSubmit({ kind: "details", detail, location });
        else if (editing.mode === "note") onSubmit({ kind: "note", note });
        else onSubmit({ kind: "day", day });
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      {editing.mode === "details" && (
        <>
          <label>
            {t("Place name")}
            <input
              ref={first}
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label>
            {t("What you will do")}
            <textarea
              value={detail}
              maxLength={500}
              rows={2}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
        </>
      )}
      {editing.mode === "note" && (
        <label>
          {t("Note")}
          <textarea
            ref={first}
            value={note}
            maxLength={500}
            rows={2}
            placeholder={t("e.g. Book tickets a day ahead")}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      {editing.mode === "schedule" && (
        <label>
          {t("Day")}
          <select
            ref={first}
            aria-label={t("Day")}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          >
            {Array.from({ length: days }, (_, index) => (
              <option key={index} value={index + 1}>
                {t("Day {v0}", { v0: index + 1 })} · {labels[index]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="item-editor__actions">
        <button type="submit" className="primary">
          {editing.mode === "schedule" ? t("Schedule") : t("Save")}
        </button>
        <button type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}

/**
 * The trip's stops in visiting order, grouped by day, at the top of the Itinerary tab, then its
 * Ideas. It is the keyboard path to every map marker: a located stop is a button that selects it on
 * the map. With `plan` and `onApply` each stop also has an action menu (adjust schedule, edit
 * details, note, earlier or later on its day, ideas, previous or next day, booked, remove); actions
 * apply at once and can be undone (lib/trip/item-actions.ts).
 */
export function TripPlaceList({
  tripPlaces,
  startDate,
  selected,
  onSelect,
  plan,
  onApply,
  onAdjust,
  disabled = false,
}: {
  tripPlaces: TripPlaces;
  startDate: string;
  selected?: string;
  onSelect(activityId: string): void;
  plan?: TripPlan;
  onApply?(plan: TripPlan): void;
  /** Open the Timeline on this stop to change its time. */
  onAdjust?(activityId: string): void;
  disabled?: boolean;
}) {
  const { t, locale, notice: localizeNotice } = useLocale();
  const { activities, itinerary, places, placeIdFor, locationStatus } = tripPlaces;
  const list = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<Editing>();
  const [undo, setUndo] = useState<{ previous: TripPlan; message: Notice }>();
  const [problem, setProblem] = useState<Notice | "">("");
  const applied = useRef<TripPlan | null>(null);
  // Scheduled days in visiting order, then Ideas.
  const days = useMemo((): [number | undefined, Activity[]][] => {
    const ideas = itinerary.ideas();
    return [
      ...itinerary
        .days()
        .map((day): [number, Activity[]] => [
          day,
          itinerary.stopsOn(day).map((stop) => stop.activity),
        ]),
      ...(ideas.length ? [[undefined, ideas] as [undefined, Activity[]]] : []),
    ];
  }, [itinerary]);
  const total = plan ? dayCount(plan) : 0;
  const labels = useMemo(
    () =>
      plan ? Array.from({ length: total }, (_, index) => dayLabel(plan, index + 1, locale)) : [],
    [plan, total, locale],
  );

  // A plan that arrives from elsewhere (chat, restore) ends the chance to undo.
  useEffect(() => {
    if (applied.current !== plan) setUndo(undefined);
    applied.current = null;
  }, [plan]);

  // A marker chosen on the map scrolls its row into view without taking focus.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    row?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const act = (activity: Activity, action: ItemAction, message: Notice) => {
    if (!plan || !onApply || !activity.id) return;
    try {
      const next = applyItemAction(plan, activity.id, action);
      applied.current = next;
      setUndo({ previous: plan, message });
      setProblem("");
      setEditing(undefined);
      onApply(next);
    } catch (error) {
      setProblem(
        error instanceof NoticeError ? error.notice : { key: "That change could not be made." },
      );
    }
  };

  const menuFor = (activity: Activity, name: string): ActionMenuItem[] => {
    const scheduled = activity.day !== undefined;
    const edit = (mode: Editing["mode"]) => () => setEditing({ id: activity.id!, mode });
    const items: ActionMenuItem[] = [];
    if (scheduled && onAdjust)
      items.push({
        label: t("Adjust schedule"),
        icon: <CalendarIcon />,
        onSelect: () => onAdjust(activity.id!),
      });
    if (!scheduled)
      items.push({
        label: t("Schedule on a day"),
        icon: <CalendarIcon />,
        onSelect: edit("schedule"),
      });
    items.push(
      { label: t("Edit details"), icon: <ComposeIcon />, onSelect: edit("details") },
      {
        label: t(activity.note ? "Edit note" : "Add a note"),
        icon: <ChatIcon />,
        onSelect: edit("note"),
      },
    );
    if (scheduled) {
      // Neighbours on this day in the order the list shows; the transform uses the same order.
      const sameDay = (days.find(([day]) => day === activity.day)?.[1] ?? []).filter(
        (other) => !!other.startTime,
      );
      const position = sameDay.indexOf(activity);
      const move = (direction: -1 | 1): ActionMenuItem => ({
        label: t(direction < 0 ? "Move earlier" : "Move later"),
        icon: (
          <span className={direction < 0 ? "action-menu__up" : "action-menu__down"}>
            <ChevronIcon />
          </span>
        ),
        separated: direction < 0 || position === 0,
        onSelect: () =>
          act(
            activity,
            { kind: "move", direction },
            direction < 0
              ? { key: "{name} moved earlier.", params: { name } }
              : { key: "{name} moved later.", params: { name } },
          ),
      });
      if (position > 0) items.push(move(-1));
      if (position >= 0 && position < sameDay.length - 1) items.push(move(1));
      const grouped = position > 0 || (position >= 0 && position < sameDay.length - 1);
      items.push(
        {
          label: t("Move to ideas"),
          icon: <SuitcaseIcon />,
          separated: !grouped,
          onSelect: () =>
            act(activity, { kind: "idea" }, { key: "{name} moved to Ideas.", params: { name } }),
        },
        {
          label: t("Move to previous day"),
          icon: (
            <span className="action-menu__up">
              <ChevronIcon />
            </span>
          ),
          disabled: activity.day! <= 1,
          onSelect: () =>
            act(
              activity,
              { kind: "day", day: activity.day! - 1 },
              { key: "{name} moved to Day {day}.", params: { name, day: activity.day! - 1 } },
            ),
        },
        {
          label: t("Move to next day"),
          icon: (
            <span className="action-menu__down">
              <ChevronIcon />
            </span>
          ),
          disabled: activity.day! >= total,
          onSelect: () =>
            act(
              activity,
              { kind: "day", day: activity.day! + 1 },
              { key: "{name} moved to Day {day}.", params: { name, day: activity.day! + 1 } },
            ),
        },
      );
    }
    items.push(
      {
        label: t(activity.booked ? "Mark as not booked" : "Mark as booked"),
        icon: <CheckIcon />,
        separated: true,
        onSelect: () =>
          act(
            activity,
            { kind: "booked", booked: !activity.booked },
            activity.booked
              ? { key: "{name} marked as not booked.", params: { name } }
              : { key: "{name} marked as booked.", params: { name } },
          ),
      },
      {
        label: t("Remove"),
        icon: <CloseIcon />,
        tone: "danger",
        separated: true,
        onSelect: () =>
          act(activity, { kind: "remove" }, { key: "{name} removed.", params: { name } }),
      },
    );
    return items.map((item) => (disabled ? { ...item, disabled: true } : item));
  };

  if (!activities.length) return null;
  return (
    <section className="trip-places" aria-labelledby="trip-places-title" ref={list}>
      <h3 id="trip-places-title">{t("Stops")}</h3>
      {undo && (
        <div className="item-undo" role="status">
          <span>{localizeNotice(undo.message)}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              applied.current = undo.previous;
              onApply?.(undo.previous);
              setUndo(undefined);
            }}
          >
            {t("Undo")}
          </button>
        </div>
      )}
      {problem && (
        <p className="item-problem" role="alert">
          {localizeNotice(problem)}
        </p>
      )}
      {days.map(([day, items]) => {
        const date = day === undefined ? undefined : dayDate(startDate, day);
        const title =
          day === undefined
            ? t("Ideas")
            : `${t("Day {v0}", { v0: day })}${date ? ` · ${date}` : ""}`;
        return (
          <div className="trip-places__day" key={day ?? "ideas"}>
            <h4>{title}</h4>
            {day === undefined && (
              <p className="trip-places__hint">
                {t("Set aside for later. Schedule one on a day from its menu.")}
              </p>
            )}
            <ol aria-label={t("Stops, {v0}", { v0: title })}>
              {items.map((activity, index) => {
                const placeId = placeIdFor(activity);
                const place = placeId ? places[placeId] : undefined;
                // The place's stop number, shared with the maps; a repeat visit keeps it.
                const order = activity.id ? itinerary.stop(activity.id)?.number : undefined;
                const time = activity.startTime
                  ? `${activity.startTime}${activity.endTime ? `–${activity.endTime}` : ""}`
                  : undefined;
                const name = place?.displayName?.text ?? activity.location ?? activity.detail;
                const status = locationStatus(activity);
                const extras = (
                  <>
                    {activity.booked && <span className="trip-places__tag">{t("Booked")}</span>}
                    {activity.note && <span className="trip-places__note">{activity.note}</span>}
                  </>
                );
                return (
                  <li key={activity.id ?? `${day}-${index}`} className="trip-places__item">
                    <div className="trip-places__row">
                      {order !== undefined && activity.id ? (
                        <button
                          type="button"
                          className="trip-places__stop"
                          aria-pressed={selected === activity.id}
                          onClick={() => onSelect(activity.id!)}
                        >
                          <span className="trip-places__order" aria-hidden="true">
                            {order}
                          </span>
                          <span className="trip-places__text">
                            <span className="trip-places__name">
                              <span className="sr-only">
                                {t("Stop")} {order}:{" "}
                              </span>
                              {name}
                            </span>
                            <small>
                              {[time, activity.detail !== name && activity.detail]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                            {extras}
                          </span>
                        </button>
                      ) : (
                        <div className="trip-places__stop trip-places__stop--unmapped">
                          <span className="trip-places__order" aria-hidden="true" />
                          <span className="trip-places__text">
                            <span className="trip-places__name">{name}</span>
                            <small>
                              {[
                                time,
                                activity.detail !== name && activity.detail,
                                // Ideas are not mapped, so where they are is not pending.
                                day === undefined
                                  ? undefined
                                  : status === "loading"
                                    ? t("Finding this place…")
                                    : status === "unavailable"
                                      ? t("Place could not be loaded right now")
                                      : t("Location to be confirmed"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                            {extras}
                          </span>
                        </div>
                      )}
                      {plan && onApply && activity.id && (
                        <ActionMenu
                          label={t("Actions for {v0}, {v1}", {
                            v0: name,
                            v1: day === undefined ? "idea" : `Day ${day}${time ? ` ${time}` : ""}`,
                          })}
                          items={menuFor(activity, name)}
                        />
                      )}
                    </div>
                    {editing && editing.id === activity.id && (
                      <ItemEditor
                        activity={activity}
                        editing={editing}
                        days={total}
                        labels={labels}
                        onCancel={() => setEditing(undefined)}
                        onSubmit={(action) =>
                          act(
                            activity,
                            action,
                            action.kind === "day"
                              ? {
                                  key: "{name} scheduled on Day {day}.",
                                  params: { name, day: action.day },
                                }
                              : action.kind === "note"
                                ? { key: "Note saved." }
                                : { key: "Details saved." },
                          )
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
