"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useEditorDraft } from "../editor-drafts";
import type { ProposalItem } from "@trip/shared";
import type { GooglePlace } from "@/lib/integrations/google";
import type { LocationStatus } from "../../map/useTripPlaces";
import type { TimelineEdits } from "./useTimelineEdits";
import type { MessageKey } from "@/lib/i18n/locale";
import type { Notice } from "@/lib/i18n/notice";
import type { ItemAction } from "@/lib/trip/item-actions";
import { hoveredStop, hoverStop, subscribeStopHover } from "@/lib/trip/stop-hover";
import { useLocale } from "../../account/LocaleProvider";
import { ActionMenu, type ActionMenuItem } from "../../ui/ActionMenu";
import { PlacePreview } from "../../map/PlacePreview";
import {
  CalendarIcon,
  ChatIcon,
  ChevronIcon,
  CloseIcon,
  ComposeIcon,
  MapPinIcon,
  PlusIcon,
  RouteIcon,
  SendIcon,
  SuitcaseIcon,
} from "../../ui/icons";
import { ItemForm, PlaceSearch, TimeForm } from "./StopForms";
import { StopPopover } from "./StopPopover";
import type { RowDrag } from "../useItineraryDrag";

type Activity = ProposalItem & { id?: string };

type Panel = "" | "search";

type Popover = "" | "time" | "details" | "comment" | "day";

const PROGRESS = {
  planned: { action: "planned", notice: "nameMarkedAsPlanned" },
  visited: { action: "visited", notice: "nameMarkedAsVisited" },
  skipped: { action: "skipped", notice: "nameMarkedAsSkipped" },
} as const;

const PROGRESS_TAG = { visited: "visited", skipped: "skipped" } as const;

const STATUS_TEXT: Partial<Record<LocationStatus, MessageKey>> = {
  loading: "findingThisPlace",
  unconfirmed: "notFoundOnTheMap",
  unavailable: "placeLookupFailedRetryFrom",
};

export function TimelineStop({
  activity,
  number,
  index,
  count,
  days,
  dayLabels,
  drag,
  selected,
  locked,
  place,
  status,
  saveState,
  edits,
  showPhotos,
  suggestion = false,
  conflicts = [],
  phone = false,
  onSelect,
  onOpen,
  onItem,
  onReorder,
  onAskAI,
}: {
  activity: Activity;

  number?: number;

  index: number;

  count: number;

  drag?: RowDrag;
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

  phone?: boolean;

  onSelect(): void;

  onOpen(): void;

  onItem(action: ItemAction, message: Notice): boolean | Promise<boolean>;

  onReorder?(direction: -1 | 1): void;
  onAskAI?(message: string): void;
}) {
  const { t, money, notice: localizeNotice } = useLocale();
  const id = activity.id!;
  const idea = activity.day === undefined;
  const name = place?.displayName?.text ?? activity.location ?? activity.detail;
  const confirmed = !!activity.placeId;
  const matched = !confirmed && status === "located" && !!place;
  const placeTag = confirmed
    ? null
    : matched
      ? saveState === "failed"
        ? { className: "timeline-tag timeline-tag--warn", text: t("placeNotSavedYet") }
        : { className: "timeline-tag", text: t("savingPlace") }
      : STATUS_TEXT[status]
        ? { className: "timeline-tag timeline-tag--warn", text: t(STATUS_TEXT[status]!) }
        : null;
  const [start, setStart, resetStart] = useEditorDraft(`${id}:start`, activity.startTime ?? "");
  const [end, setEnd, resetEnd] = useEditorDraft(`${id}:end`, activity.endTime ?? "");
  const [popover, setPopover] = useState<Popover>("");
  const [panel, setPanel] = useState<Panel>("");
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const photo = showPhotos || place?.id.startsWith("osm:") ? place?.photos?.[0] : undefined;
  const thumbnail = photo && photo.name !== failedPhoto ? photo : undefined;
  const row = useRef<HTMLLIElement>(null);
  const timeButton = useRef<HTMLButtonElement>(null);
  const mainButton = useRef<HTMLButtonElement>(null);

  const linked = useSyncExternalStore(
    subscribeStopHover,
    () => hoveredStop() === id,
    () => false,
  );
  useEffect(
    () => () => {
      if (hoveredStop() === id) hoverStop(undefined);
    },
    [id],
  );
  useEffect(() => {
    if (!selected) {
      setPanel("");
      edits.clearResults();
    } else row.current?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const timeChanged = start !== (activity.startTime ?? "") || end !== (activity.endTime ?? "");
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
  const closePopover = () => {
    (popover === "time" ? timeButton : mainButton).current?.focus({ preventScroll: true });
    setPopover("");
  };

  const act = (action: ItemAction, message: Notice) => {
    return Promise.resolve(onItem(action, message)).then((done) => {
      if (done) {
        closePanel();
        setPopover("");
      }
      return done;
    });
  };
  const shiftDay = (step: -1 | 1) =>
    act(
      { kind: "day", day: activity.day! + step },
      { key: "nameMovedToDayDay", params: { name, day: activity.day! + step } },
    );
  const addAgain = () =>
    edits.add({
      id: crypto.randomUUID(),
      detail: activity.detail,
      location: activity.location ?? name,
      ...(activity.placeId ? { placeId: activity.placeId } : {}),
      ...(activity.savedPlace ? { savedPlace: activity.savedPlace } : {}),
      day: activity.day!,
    });
  const open = (next: Panel) => {
    onOpen();
    setPanel(next);
  };

  const menu = (): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];
    const removal: ActionMenuItem = {
      label: t("remove"),
      icon: <CloseIcon />,
      tone: "danger",
      separated: true,
      disabled: locked,
      onSelect: () => act({ kind: "remove" }, { key: "nameRemoved", params: { name } }),
    };
    const detailsItem: ActionMenuItem = {
      label: t("editDetails"),
      icon: <ComposeIcon />,
      disabled: locked,
      onSelect: () => setPopover("details"),
    };
    const commentItem: ActionMenuItem = {
      label: t("addAComment"),
      icon: <ChatIcon />,
      disabled: locked,
      onSelect: () => setPopover("comment"),
    };
    if (suggestion) {
      items.push(
        {
          label: t("scheduleOnADay"),
          icon: <CalendarIcon />,
          disabled: locked,
          onSelect: () => setPopover("day"),
        },
        removal,
      );
      return items;
    }
    if (idea) {
      items.push(
        {
          label: t("scheduleOnADay"),
          icon: <CalendarIcon />,
          disabled: locked,
          onSelect: () => setPopover("day"),
        },
        detailsItem,
        commentItem,
        removal,
      );
      return items;
    }
    const askItem: ActionMenuItem[] = onAskAI
      ? [
          {
            label: t("askAi"),
            icon: <SendIcon />,
            disabled: locked,
            onSelect: () => onAskAI(t("suggestAChangeForV0", { v0: name, v1: activity.day! })),
          },
        ]
      : [];
    items.push(
      {
        label: t("adjustSchedule"),
        icon: <CalendarIcon />,
        disabled: locked,
        onSelect: () => openTime(),
      },
      detailsItem,
      commentItem,
      ...askItem,
      {
        label: t("moveToIdeas"),
        icon: <SuitcaseIcon />,
        disabled: locked,
        onSelect: () => act({ kind: "idea" }, { key: "nameMovedToIdeas", params: { name } }),
      },
      {
        label: t("moveToPreviousDay"),
        icon: (
          <span className="action-menu__up">
            <ChevronIcon />
          </span>
        ),
        disabled: locked || activity.day! <= 1,
        onSelect: () => shiftDay(-1),
      },
      {
        label: t("moveToNextDay"),
        icon: (
          <span className="action-menu__down">
            <ChevronIcon />
          </span>
        ),
        disabled: locked || activity.day! >= days,
        onSelect: () => shiftDay(1),
      },
      {
        label: t("addAgain"),
        icon: <PlusIcon />,
        disabled: locked,
        onSelect: () => addAgain(),
      },
      {
        label: t("replacePlace"),
        icon: <MapPinIcon />,
        separated: true,
        disabled: locked,
        onSelect: () => open("search"),
      },
    );
    if (place?.location) {
      const { latitude, longitude } = place.location;
      items.push({
        label: t("openInMaps"),
        icon: <RouteIcon />,
        onSelect: () =>
          window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
            "_blank",
            "noopener",
          ),
      });
    }
    const currentProgress = activity.progress ?? "planned";
    for (const progress of ["planned", "visited", "skipped"] as const) {
      items.push({
        label: t(PROGRESS[progress].action),
        checked: currentProgress === progress,
        radio: true,
        separated: progress === "planned",
        disabled: locked,
        onSelect: () => {
          if (currentProgress === progress) return;
          act({ kind: "progress", progress }, { key: PROGRESS[progress].notice, params: { name } });
        },
      });
    }
    items.push(
      {
        label: t("booked"),
        checked: Boolean(activity.booked),
        disabled: locked,
        onSelect: () =>
          act(
            { kind: "booked", booked: !activity.booked },
            activity.booked
              ? { key: "nameMarkedAsNotBooked", params: { name } }
              : { key: "nameMarkedAsBooked", params: { name } },
          ),
      },
      removal,
    );
    return items;
  };

  const openTime = () => {
    setPopover("time");
  };

  const searching = !idea && (panel === "search" || (!confirmed && !matched));
  return (
    <li
      ref={row}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") hoverStop(id);
      }}
      onPointerLeave={() => hoverStop(undefined)}
      className={`timeline-row timeline-stop${idea ? " timeline-stop--idea" : ""}${
        selected ? " is-selected" : ""
      }${linked ? " is-hovered" : ""}${edits.changed.has(id) ? " is-changed" : ""}`}
      {...(locked ? {} : drag)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || !selected) return;
        event.stopPropagation();
        if (panel) closePanel();
        else closeCard();
      }}
    >
      {idea ? (
        <span className="timeline-row__time timeline-stop__time-slot" aria-hidden="true" />
      ) : (
        <button
          ref={timeButton}
          type="button"
          className="timeline-row__time timeline-stop__time"
          aria-expanded={popover === "time"}
          aria-haspopup="dialog"
          aria-controls={popover === "time" ? `stop-time-${id}` : undefined}
          aria-label={`${t("changeTime")}, ${range}`}
          disabled={locked}
          onClick={() => (popover === "time" ? setPopover("") : openTime())}
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
            aria-keyshortcuts={onReorder ? "Alt+ArrowUp Alt+ArrowDown" : undefined}
            onClick={onSelect}
            onKeyDown={(event) => {
              if (!onReorder || locked || !event.altKey) return;
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
              event.preventDefault();
              onReorder(event.key === "ArrowUp" ? -1 : 1);
            }}
          >
            {thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="timeline-stop__thumb"
                src={`/api/places/photo?name=${encodeURIComponent(thumbnail.name)}&width=112`}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                onError={() => setFailedPhoto(thumbnail.name)}
              />
            )}
            <span className="timeline-stop__name">
              {number !== undefined && (
                <span className="sr-only">{t("stopNumber", { number })}: </span>
              )}
              {name}
            </span>
            {activity.detail !== name && (
              <span className="timeline-stop__detail">{activity.detail}</span>
            )}
            {activity.note && <span className="timeline-stop__note">{activity.note}</span>}
            <span className="timeline-stop__meta">
              {suggestion ? (
                <span className="timeline-tag">{t("restaurantSuggestion")}</span>
              ) : (
                placeTag && <span className={placeTag.className}>{placeTag.text}</span>
              )}
              {place?.id.startsWith("osm:") && <span className="timeline-tag">OpenStreetMap</span>}
              {!suggestion && activity.progress && activity.progress !== "planned" && (
                <span className="timeline-tag">{t(PROGRESS_TAG[activity.progress])}</span>
              )}
              {activity.booked && <span className="timeline-tag">{t("booked")}</span>}
            </span>
          </button>
          <ActionMenu
            label={t("actionsForV0V1", {
              v0: name,
              v1: idea ? t("ideas") : `${t("dayV0", { v0: activity.day ?? "" })} ${range}`,
            })}
            items={menu()}
          />
        </div>
        {conflicts.length > 0 && (
          <ul className="timeline-stop__conflicts" aria-label={t("openConflicts")}>
            {conflicts.map((notice, index) => (
              <li key={index}>{localizeNotice(notice)}</li>
            ))}
          </ul>
        )}
      </div>
      <span className="timeline-row__cost">
        {activity.estCost === undefined ? t("priceUnknown") : money(activity.estCost)}
      </span>
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
                aria-label={t("closePlaceDetails")}
                onClick={closeCard}
              >
                <CloseIcon />
              </button>
            </div>
          )}
          {!confirmed && status === "unconfirmed" && (
            <p className="stop-editor__hint">{t("theMapCouldNotFind")}</p>
          )}
          {matched && saveState === "failed" && (
            <p className="stop-editor__hint">{t("thisPlaceCouldNotBe")}</p>
          )}
          {searching && (
            <PlaceSearch
              draftKey={id}
              label={confirmed || matched ? t("replaceWithAnotherPlace") : t("findThisPlace")}
              locked={locked}
              edits={edits}
              focusOnMount={panel === "search"}
              phone={phone}
              onCancel={panel === "search" ? closePanel : undefined}
              onUse={async (placeId) => {
                const done = await edits.edit({ kind: "place", id, placeId });
                if (done) closePanel();
                return done;
              }}
            />
          )}
        </div>
      )}
      {popover && (
        <StopPopover
          title={t(
            popover === "time"
              ? "adjustSchedule"
              : popover === "details"
                ? "editDetails"
                : popover === "comment"
                  ? "addAComment"
                  : "scheduleOnADay",
          )}
          anchor={popover === "time" ? timeButton : undefined}
          onClose={closePopover}
        >
          {popover === "time" && (
            <TimeForm
              id={id}
              start={start}
              end={end}
              locked={locked}
              validTime={validTime}
              timeChanged={timeChanged}
              errors={edits.errors}
              onStart={setStart}
              onEnd={setEnd}
              onSubmit={async () => {
                const done = await edits.edit({ kind: "time", id, startTime: start, endTime: end });
                if (done) {
                  resetStart();
                  resetEnd();
                  closePopover();
                }
                return done;
              }}
              onCancel={() => {
                resetStart();
                resetEnd();
                closePopover();
              }}
            />
          )}
          {popover === "details" && (
            <ItemForm
              activity={activity}
              mode="details"
              days={days}
              labels={dayLabels}
              onCancel={closePopover}
              onSubmit={(action) => act(action, { key: "detailsSaved" })}
            />
          )}
          {popover === "comment" && (
            <ItemForm
              activity={activity}
              mode="note"
              days={days}
              labels={dayLabels}
              onCancel={closePopover}
              onSubmit={(action) => act(action, { key: "commentSaved" })}
            />
          )}
          {popover === "day" && (
            <ItemForm
              activity={activity}
              mode="schedule"
              days={days}
              labels={dayLabels}
              onCancel={closePopover}
              onSubmit={(action) =>
                act(action, {
                  key: "nameScheduledOnDayDay",
                  params: { name, day: action.kind === "day" ? action.day : 0 },
                })
              }
            />
          )}
        </StopPopover>
      )}
    </li>
  );
}
