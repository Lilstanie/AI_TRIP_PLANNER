"use client";
import type { ReactNode, RefObject } from "react";
import type { ProposalItem, TripPlan } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import { TripHomeActionDrawer } from "./TripHomeActionDrawer";
import type { Notice } from "@/lib/i18n/notice";
import type { TripAction } from "@/lib/workspace/layout";
import type { Draft } from "@/lib/workspace/workspace";

export function TripHomeActionHost({
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
  expandable,
  expanded,
  onToggleExpanded,
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
  onSwitch(action: TripAction): void;
  onSelectDay(day: number): void;
  returnFocus: RefObject<HTMLElement | null>;
  expandable: boolean;
  expanded: boolean;
  onToggleExpanded(): void;
  itinerary: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <>
      {action && (
        <button
          type="button"
          tabIndex={-1}
          className="trip-home-action-backdrop"
          aria-label={t("Close open panel")}
          onClick={onClose}
        />
      )}
      <TripHomeActionDrawer
        action={action}
        plan={plan}
        draft={draft}
        selectedDay={selectedDay}
        busy={busy}
        errors={errors}
        editErrors={editErrors}
        showEditNotice={showEditNotice}
        onUndo={onUndo}
        onSave={onSave}
        onReplan={onReplan}
        onSchedule={onSchedule}
        onClose={onClose}
        onSwitch={onSwitch}
        onSelectDay={onSelectDay}
        returnFocus={returnFocus}
        expandable={expandable}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
        itinerary={itinerary}
      />
    </>
  );
}
