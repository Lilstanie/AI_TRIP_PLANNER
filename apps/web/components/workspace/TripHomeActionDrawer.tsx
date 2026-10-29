"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { ProposalItem, TripPlan } from "@trip/shared";
import { Drawer } from "../ui/Drawer";
import { useLocale } from "../account/LocaleProvider";
import { TripHomeBookings, TripHomeIdeas } from "./TripHomeIdeasBookings";
import { TripHomePreferences } from "./TripHomePreferences";
import { TripHomeCalendar } from "./TripHomeCalendar";
import type { Notice } from "@/lib/i18n/notice";
import { TRIP_ACTIONS, type TripAction } from "@/lib/workspace/layout";
import { sameDraft, type Draft } from "@/lib/workspace/workspace";

const TITLES = {
  itinerary: "Itinerary",
  ideas: "Ideas",
  bookings: "Bookings",
  preferences: "Trip preferences",
  calendar: "Calendar",
} as const;

export function TripHomeActionDrawer({
  action,
  plan,
  draft,
  selectedDay,
  busy,
  errors,
  editErrors,
  showEditNotice,
  onUndo,
  onSave,
  onReplan,
  onSchedule,
  onClose,
  onSwitch,
  onSelectDay,
  returnFocus,
  itinerary,
  expandable,
  expanded,
  onToggleExpanded,
}: {
  action?: TripAction;
  plan: TripPlan;
  draft: Draft;
  selectedDay?: number;
  busy: boolean;
  errors: Record<string, Notice>;
  editErrors: Notice[];
  showEditNotice: boolean;
  onUndo(): void;
  onSave(next: Draft): void;
  onReplan(next: Draft): boolean;
  onSchedule(idea: ProposalItem, day: number): boolean | Promise<boolean>;
  onClose(): void;
  onSwitch(action: TripAction): void;
  onSelectDay(day: number): void;
  returnFocus: RefObject<HTMLElement | null>;
  itinerary: ReactNode;
  expandable: boolean;
  expanded: boolean;
  onToggleExpanded(): void;
}) {
  const { t } = useLocale();
  const id = useId();
  const tabs = useRef<Partial<Record<TripAction, HTMLButtonElement | null>>>({});
  const titleKey = TITLES[action ?? "itinerary"];
  const title = t(titleKey);
  const active = action ?? "itinerary";
  const [preferencesEdit, setPreferencesEdit] = useState({
    tripId: plan.tripId,
    value: draft,
    baseline: draft,
  });
  const overlayPreferences = (value: Draft) => {
    const keys = [
      "preferences",
      "noAccommodation",
      "learnedPreferences",
      "legModes",
      "excludeFlights",
      "bookedStay",
    ] as const;
    const changed = Object.fromEntries(
      keys
        .filter(
          (key) => JSON.stringify(value[key]) !== JSON.stringify(preferencesEdit.baseline[key]),
        )
        .map((key) => [key, value[key]]),
    );
    return { ...draft, ...changed };
  };
  const preferencesDraft =
    preferencesEdit.tripId !== plan.tripId ||
    sameDraft(preferencesEdit.value, preferencesEdit.baseline)
      ? draft
      : overlayPreferences(preferencesEdit.value);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + 1) % TRIP_ACTIONS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + TRIP_ACTIONS.length) % TRIP_ACTIONS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TRIP_ACTIONS.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    const nextAction = TRIP_ACTIONS[next]!;
    onSwitch(nextAction);
    tabs.current[nextAction]?.focus();
  };
  return (
    <Drawer
      side="right"
      open={action !== undefined}
      title={title}
      closeLabel={t("Close {v0}", { v0: title })}
      onClose={onClose}
      returnFocus={returnFocus}
      className={`trip-home-action-surface${expanded ? " is-expanded" : ""}`}
      meta={
        <div className="trip-home-action-switcher">
          <div
            className="trip-home-action-switcher__tabs"
            role="tablist"
            aria-label={t("Trip actions")}
          >
            {TRIP_ACTIONS.map((item, index) => (
              <button
                ref={(node) => {
                  tabs.current[item] = node;
                }}
                type="button"
                role="tab"
                id={`${id}-${item}-tab`}
                aria-controls={`${id}-${item}-panel`}
                aria-selected={item === active}
                tabIndex={item === active ? 0 : -1}
                onClick={() => onSwitch(item)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                key={item}
              >
                {t(TITLES[item])}
              </button>
            ))}
          </div>
          {expandable && (
            <button
              type="button"
              className="trip-home-action-switcher__size"
              aria-expanded={expanded}
              onClick={onToggleExpanded}
            >
              {t(expanded ? "Collapse panel" : "Expand panel")}
            </button>
          )}
        </div>
      }
    >
      <div
        id={`${id}-${active}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${active}-tab`}
        className="trip-home-action-content"
      >
        {active === "itinerary" && itinerary}
        {active === "ideas" && (
          <TripHomeIdeas
            plan={plan}
            onSchedule={onSchedule}
            disabled={busy}
            errors={editErrors}
            showNotice={showEditNotice}
            onUndo={onUndo}
          />
        )}
        {active === "bookings" && <TripHomeBookings plan={plan} />}
        {active === "preferences" && (
          <TripHomePreferences
            value={preferencesDraft}
            plan={plan}
            busy={busy}
            errors={errors}
            onChange={(next) =>
              setPreferencesEdit((current) => ({
                ...current,
                tripId: plan.tripId,
                value: next,
              }))
            }
            onSave={(next) => {
              const merged = overlayPreferences(next);
              setPreferencesEdit({ tripId: plan.tripId, value: merged, baseline: merged });
              onSave(merged);
            }}
            onReplan={(next) => {
              const merged = overlayPreferences(next);
              const done = onReplan(merged);
              if (done)
                setPreferencesEdit({ tripId: plan.tripId, value: merged, baseline: merged });
              return done;
            }}
            onDone={onClose}
          />
        )}
        {active === "calendar" && (
          <TripHomeCalendar plan={plan} selectedDay={selectedDay} onSelectDay={onSelectDay} />
        )}
      </div>
    </Drawer>
  );
}
