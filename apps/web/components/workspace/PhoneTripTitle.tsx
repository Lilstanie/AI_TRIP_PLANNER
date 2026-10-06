"use client";
import { useEffect, useRef } from "react";
import { factLabels, type FactKey } from "@/lib/workspace/trip-facts";
import { useLocale } from "../account/LocaleProvider";
import { TRIP_FACTS_SHEET_ID, TripFactsSheet } from "../preferences/TripFactsSheet";
import type { CloseReason } from "../preferences/FactPopover";
import { ChevronIcon } from "../ui/icons";
import { usePresence } from "../ui/motion";
import type { WorkspaceController } from "./useWorkspaceController";

/** "Sydney · 1 Oct – 4 Oct" from what the traveller stated, or "New trip" before anything is. */
export function usePhoneTripTitle(model: Pick<WorkspaceController, "draft" | "plan">) {
  const { locale, currency, t } = useLocale();
  const labels = factLabels(model.draft, model.plan?.brief, { locale, currency });
  const range = labels.when?.split(" · ")[0];
  return [labels.where, range].filter(Boolean).join(" · ") || t("New trip");
}

/**
 * The phone top bar's single line: the trip title, as a button that opens the trip facts sheet.
 * The chips are hidden on a phone, so focus that a closing fact editor would hand back to its chip
 * comes back here instead.
 */
export function PhoneTripTitle({ model }: { model: WorkspaceController }) {
  const { t } = useLocale();
  const title = usePhoneTripTitle(model);
  const { draft, plan, openFact, openPreferences, openFactsSheet, closeFactsSheet } = model;
  const button = useRef<HTMLButtonElement>(null);
  // The sheet is a panel: opening an editor (here, from the chat's Edit, or a rejected brief)
  // takes its place.
  const open = model.surface.sheet === "facts";
  // The sheet stays mounted briefly after it closes so it can sink away, as the editors do.
  const sheet = usePresence(open || undefined, 220);

  // A fact editor just closed. Its chip is hidden, so its focus would fall to the page.
  const editing = useRef(openFact);
  useEffect(() => {
    const wasEditing = editing.current;
    editing.current = openFact;
    if (!wasEditing || openFact) return;
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || active.closest(".fact-popover"))
        button.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [openFact]);

  const close = (reason: CloseReason) => {
    closeFactsSheet();
    if (reason === "dismiss") button.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <h1 className="topbar-title phone-topbar__title">
        <button
          ref={button}
          type="button"
          className="phone-topbar__title-button"
          aria-label={t("Trip details: {title}", { title })}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? TRIP_FACTS_SHEET_ID : undefined}
          onClick={open ? closeFactsSheet : openFactsSheet}
        >
          <span className="phone-topbar__title-text">{title}</span>
          <ChevronIcon />
        </button>
      </h1>
      {sheet.value && (
        <TripFactsSheet
          // A fresh instance for the exit, so reopening mid-exit mounts (and focuses) anew.
          key={sheet.leaving ? "leaving" : "open"}
          draft={draft}
          plan={plan}
          anchor={button}
          leaving={sheet.leaving}
          onClose={close}
          onPick={(fact: FactKey) => openPreferences(fact)}
        />
      )}
    </>
  );
}
