"use client";
import { useEffect, useRef, useState } from "react";
import type { ProposalItem } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import type { LocationStatus } from "../../map/useTripPlaces";
import type { TimelineEdits } from "./useTimelineEdits";
import type { MessageKey } from "@/lib/i18n/locale";
import type { Notice } from "@/lib/i18n/notice";
import type { ItemAction } from "@/lib/trip/item-actions";
import { useLocale } from "../../account/LocaleProvider";
import { ActionMenu, type ActionMenuItem } from "../../ui/ActionMenu";
import { PlacePreview } from "../../map/PlacePreview";
import {
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ChevronIcon,
  CloseIcon,
  ComposeIcon,
  MapPinIcon,
  SuitcaseIcon,
} from "../../ui/icons";
import { ItemForm, PlaceSearch, TimeForm } from "./StopForms";

type Activity = ProposalItem & { id?: string };

type Panel = "" | "details" | "note" | "schedule" | "day" | "search";

const STATUS_TEXT: Partial<Record<LocationStatus, MessageKey>> = {
  loading: "Finding this place…",
  unconfirmed: "Not found on the map",
  unavailable: "Place lookup failed — retry from the map",
};

export function TimelineStop({
  activity,
  number,
  index,
  count,
  days,
  dayLabels,
  dropIndex,
  selected,
  locked,
  place,
  status,
  saveState,
  edits,
  showPhotos,
  suggestion = false,
  conflicts = [],
  onSelect,
  onOpen,
  onItem,
}: {
  activity: Activity;

  number?: number;

  index: number;

  count: number;

  dropIndex?(moved: string): number;
  days: number;
  dayLabels: string[];
  selected: boolean;
  locked: boolean;

  place?: GooglePlace;
  status: LocationStatus;

  saveState: "" | "saving" | "failed";
  edits: TimelineEdits;

  showPhotos: boolean;

  suggestion?: boolean;

  conflicts?: Notice[];

  onSelect(): void;

  onOpen(): void;

  onItem(action: ItemAction, message: Notice): boolean | Promise<boolean>;
}) {
  const { t, money, notice: localizeNotice } = useLocale();
  const id = activity.id!;
  const idea = activity.day === undefined;
  const name = place?.displayName?.text ?? activity.location ?? activity.detail;
  const confirmed = !!activity.placeId;
  const matched = !confirmed && status === "located" && !!place;
  const [start, setStart] = useState(activity.startTime ?? "");
  const [end, setEnd] = useState(activity.endTime ?? "");
  const [timing, setTiming] = useState(false);
  const [panel, setPanel] = useState<Panel>("");
  const row = useRef<HTMLLIElement>(null);
  const timeButton = useRef<HTMLButtonElement>(null);
  const mainButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setStart(activity.startTime ?? "");
    setEnd(activity.endTime ?? "");
  }, [activity.startTime, activity.endTime]);

  useEffect(() => {
    if (!selected) {
      setPanel("");
      edits.clearResults();
    } else row.current?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const timeChanged = start !== activity.startTime || end !== activity.endTime;
  const validTime = !!start && !!end && start < end;
  const range = `${activity.startTime ?? "—"}–${activity.endTime ?? "—"}`;

  const closeCard = () => {
    onSelect();
    mainButton.current?.focus({ preventScroll: true });
  };
  const closePanel = () => {
    setPanel("");
    mainButton.current?.focus({ preventScroll: true });
  };

  const act = (action: ItemAction, message: Notice) => {
    void Promise.resolve(onItem(action, message)).then((done) => {
      if (done) closePanel();
    });
  };
  const moveTo = (direction: -1 | 1) =>
    onItem(
      { kind: "move", direction },
      direction < 0
        ? { key: "{name} moved earlier.", params: { name } }
        : { key: "{name} moved later.", params: { name } },
    );
  const open = (next: Panel) => {
    onOpen();
    setPanel(next);
  };

  const menu = (): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];
    if (suggestion) {
      items.push(
        {
          label: t("Schedule on a day"),
          icon: <CalendarIcon />,
          disabled: locked,
          onSelect: () => open("schedule"),
        },
        {
          label: t("Remove"),
          icon: <CloseIcon />,
          tone: "danger",
          separated: true,
          disabled: locked,
          onSelect: () => act({ kind: "remove" }, { key: "{name} removed.", params: { name } }),
        },
      );
      return items;
    }
    if (!idea) {
      if (index > 0)
        items.push({
          label: t("Move earlier"),
          icon: (
            <span className="action-menu__up">
              <ChevronIcon />
            </span>
          ),
          disabled: locked,
          onSelect: () => moveTo(-1),
        });
      if (index < count - 1)
        items.push({
          label: t("Move later"),
          icon: (
            <span className="action-menu__down">
              <ChevronIcon />
            </span>
          ),
          disabled: locked,
          onSelect: () => moveTo(1),
        });
      items.push({
        label: t("Move to another day"),
        icon: <CalendarIcon />,
        disabled: locked,
        onSelect: () => open("day"),
      });
      items.push({
        label: t("Move to ideas"),
        icon: <SuitcaseIcon />,
        disabled: locked,
        onSelect: () => act({ kind: "idea" }, { key: "{name} moved to Ideas.", params: { name } }),
      });
      items.push({
        label: t("Replace place"),
        icon: <MapPinIcon />,
        separated: true,
        disabled: locked,
        onSelect: () => open("search"),
      });
    } else {
      items.push({
        label: t("Schedule on a day"),
        icon: <CalendarIcon />,
        disabled: locked,
        onSelect: () => open("schedule"),
      });
    }
    items.push(
      {
        label: t("Edit details"),
        icon: <ComposeIcon />,
        disabled: locked,
        onSelect: () => open("details"),
      },
      {
        label: t(activity.note ? "Edit note" : "Add a note"),
        icon: <ChatIcon />,
        disabled: locked,
        onSelect: () => open("note"),
      },
      {
        label: t(activity.booked ? "Mark as not booked" : "Mark as booked"),
        icon: <CheckIcon />,
        separated: true,
        disabled: locked,
        onSelect: () =>
          act(
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
        disabled: locked,
        onSelect: () => act({ kind: "remove" }, { key: "{name} removed.", params: { name } }),
      },
    );
    return items;
  };

  const searching = !idea && (panel === "search" || (!confirmed && !matched));
  return (
    <li
      ref={row}
      className={`timeline-row timeline-stop${idea ? " timeline-stop--idea" : ""}${
        selected ? " is-selected" : ""
      }${edits.changed.has(id) ? " is-changed" : ""}`}
      draggable={!locked && !idea}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || !selected) return;
        event.stopPropagation();
        if (panel) closePanel();
        else closeCard();
      }}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const moved = event.dataTransfer.getData("text/plain");

        if (!locked && moved && moved !== id && dropIndex)
          void edits.edit({
            kind: "move",
            id: moved,
            day: activity.day!,
            index: dropIndex(moved),
          });
      }}
    >
      {idea ? (
        <span className="timeline-row__time timeline-stop__time-slot" aria-hidden="true" />
      ) : (
        <button
          ref={timeButton}
          type="button"
          className="timeline-row__time timeline-stop__time"
          aria-expanded={timing}
          aria-controls={timing ? `stop-time-${id}` : undefined}
          aria-label={`${t("Change time")}, ${range}`}
          disabled={locked}
          onClick={() => setTiming((open) => !open)}
        >
          {activity.startTime ?? "—"}
          <span className="timeline-row__end">{activity.endTime}</span>
        </button>
      )}
      <span
        className={`timeline-row__node timeline-stop__node${idea ? " timeline-stop__node--idea" : ""}`}
        aria-hidden="true"
      >
        {idea ? <SuitcaseIcon /> : (number ?? "")}
      </span>
      <div className="timeline-stop__body">
        <div className="timeline-stop__head">
          <button
            ref={mainButton}
            type="button"
            className="timeline-stop__main"
            aria-expanded={selected}
            aria-controls={selected ? `stop-place-card-${id}` : undefined}
            onClick={onSelect}
          >
            <span className="timeline-stop__name">
              {number !== undefined && (
                <span className="sr-only">
                  {t("Stop")} {number}:{" "}
                </span>
              )}
              {name}
            </span>
            {activity.detail !== name && (
              <span className="timeline-stop__detail">{activity.detail}</span>
            )}
            {activity.note && <span className="timeline-stop__note">{activity.note}</span>}
            <span className="timeline-stop__meta">
              {suggestion ? (
                <span className="timeline-tag">{t("Restaurant suggestion")}</span>
              ) : confirmed ? (
                <span className="timeline-tag timeline-tag--ok">{t("Place confirmed")}</span>
              ) : matched && saveState === "failed" ? (
                <span className="timeline-tag timeline-tag--warn">{t("Place not saved yet")}</span>
              ) : matched ? (
                <span className="timeline-tag">{t("Saving place…")}</span>
              ) : (
                <span className="timeline-tag timeline-tag--warn">
                  {STATUS_TEXT[status] ? t(STATUS_TEXT[status]!) : ""}
                </span>
              )}
              {place?.id.startsWith("osm:") && <span className="timeline-tag">OpenStreetMap</span>}
              {activity.booked && <span className="timeline-tag">{t("Booked")}</span>}
              {activity.priceNeedsReview && (
                <span className="timeline-tag timeline-tag--warn">{t("Price needs checking")}</span>
              )}
            </span>
          </button>
          <ActionMenu
            label={t("Actions for {v0}, {v1}", {
              v0: name,
              v1: idea ? t("Ideas") : `${t("Day {v0}", { v0: activity.day ?? "" })} ${range}`,
            })}
            items={menu()}
          />
        </div>
        {conflicts.length > 0 && (
          <ul className="timeline-stop__conflicts" aria-label={t("Open conflicts")}>
            {conflicts.map((notice, index) => (
              <li key={index}>{localizeNotice(notice)}</li>
            ))}
          </ul>
        )}
        {timing && !idea && (
          <TimeForm
            id={id}
            start={start}
            end={end}
            locked={locked}
            validTime={validTime}
            timeChanged={timeChanged}
            onStart={setStart}
            onEnd={setEnd}
            onSubmit={() => {
              setTiming(false);
              timeButton.current?.focus({ preventScroll: true });
              void edits.edit({ kind: "time", id, startTime: start, endTime: end });
            }}
            onCancel={() => {
              setTiming(false);
              setStart(activity.startTime ?? "");
              setEnd(activity.endTime ?? "");
              timeButton.current?.focus({ preventScroll: true });
            }}
          />
        )}
        {selected && (
          <div id={`stop-place-card-${id}`} className="stop-place-card stop-editor">
            {place ? (
              <PlacePreview
                place={place}
                showPhoto={showPhotos}
                onClose={closeCard}
                headingId={`stop-place-card-title-${id}`}
              />
            ) : (
              <div className="stop-place-card__bare">
                <h4 id={`stop-place-card-title-${id}`}>{name}</h4>
                {!suggestion && STATUS_TEXT[status] && <p>{t(STATUS_TEXT[status]!)}</p>}
                <button
                  type="button"
                  className="stop-place-card__close"
                  aria-label={t("Close place details")}
                  onClick={closeCard}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            {!confirmed && status === "unconfirmed" && (
              <p className="stop-editor__hint">
                {t("The map could not find this place. Search for it to save it.")}
              </p>
            )}
            {matched && saveState === "failed" && (
              <p className="stop-editor__hint">
                {t("This place could not be saved. Search for it to try again.")}
              </p>
            )}
            {panel === "details" && (
              <ItemForm
                activity={activity}
                mode="details"
                days={days}
                labels={dayLabels}
                onCancel={closePanel}
                onSubmit={(action) => act(action, { key: "Details saved." })}
              />
            )}
            {panel === "note" && (
              <ItemForm
                activity={activity}
                mode="note"
                days={days}
                labels={dayLabels}
                onCancel={closePanel}
                onSubmit={(action) => act(action, { key: "Note saved." })}
              />
            )}
            {panel === "schedule" && (
              <ItemForm
                activity={activity}
                mode="schedule"
                days={days}
                labels={dayLabels}
                onCancel={closePanel}
                onSubmit={(action) =>
                  act(action, {
                    key: "{name} scheduled on Day {day}.",
                    params: { name, day: action.kind === "day" ? action.day : 0 },
                  })
                }
              />
            )}
            {panel === "day" && !idea && (
              <div className="stop-editor__group stop-editor__order">
                <label>
                  {t("Move to")}
                  <select
                    autoFocus
                    disabled={locked}
                    value={activity.day}
                    onChange={(event) => {
                      const day = Number(event.target.value);
                      act(
                        { kind: "day", day },
                        { key: "{name} moved to Day {day}.", params: { name, day } },
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      event.stopPropagation();
                      closePanel();
                    }}
                  >
                    {Array.from({ length: days }, (_, d) => (
                      <option key={d} value={d + 1}>
                        {t("Day {v0}", { v0: d + 1 })} · {dayLabels[d]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {searching && (
              <PlaceSearch
                label={
                  confirmed || matched ? t("Replace with another place") : t("Find this place")
                }
                locked={locked}
                edits={edits}
                focusOnMount={panel === "search"}
                onCancel={panel === "search" ? closePanel : undefined}
                onUse={(placeId) => {
                  closePanel();
                  void edits.edit({ kind: "place", id, placeId });
                }}
              />
            )}
          </div>
        )}
      </div>
      <span className="timeline-row__cost">
        {activity.estCost === undefined ? t("Price unknown") : money(activity.estCost)}
      </span>
    </li>
  );
}
