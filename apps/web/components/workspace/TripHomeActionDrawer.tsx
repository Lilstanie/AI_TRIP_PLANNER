"use client";
import { type ReactNode, type RefObject } from "react";
import type { ProposalItem, TripPlan } from "@trip/shared";
import { Drawer } from "../ui/Drawer";
import { useLocale } from "../account/LocaleProvider";
import { TripHomeBookings, TripHomeIdeas } from "./TripHomeIdeasBookings";
import { TripHomePreferences } from "./TripHomePreferences";
import { TripHomeCalendar } from "./TripHomeCalendar";
import type { Notice } from "@/lib/i18n/notice";
import type { TripAction } from "@/lib/workspace/layout";
import type { Draft } from "@/lib/workspace/workspace";

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
  onSelectDay,
  returnFocus,
  itinerary,
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
  onSelectDay(day: number): void;
  returnFocus: RefObject<HTMLElement | null>;
  itinerary: ReactNode;
}) {
  const { t } = useLocale();
  const titleKey = TITLES[action ?? "itinerary"];
  const title = t(titleKey);
  return (
    <Drawer
      side="right"
      open={action !== undefined}
      title={title}
      closeLabel={t("Close {v0}", { v0: title })}
      onClose={onClose}
      returnFocus={returnFocus}
      className="trip-home-action-surface"
    >
      {action === "itinerary" && itinerary}
      {action === "ideas" && (
        <TripHomeIdeas
          plan={plan}
          onSchedule={onSchedule}
          disabled={busy}
          errors={editErrors}
          showNotice={showEditNotice}
          onUndo={onUndo}
        />
      )}
      {action === "bookings" && <TripHomeBookings plan={plan} />}
      {action === "preferences" && (
        <TripHomePreferences
          draft={draft}
          plan={plan}
          busy={busy}
          errors={errors}
          onSave={onSave}
          onReplan={onReplan}
          onDone={onClose}
        />
      )}
      {action === "calendar" && (
        <TripHomeCalendar plan={plan} selectedDay={selectedDay} onSelectDay={onSelectDay} />
      )}
    </Drawer>
  );
}
