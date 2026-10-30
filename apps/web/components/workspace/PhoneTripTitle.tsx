"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { factLabels, type FactKey } from "@/lib/workspace/trip-facts";
import { useLocale } from "../account/LocaleProvider";
import { TRIP_FACTS_SHEET_ID, TripFactsSheet } from "../preferences/TripFactsSheet";
import type { CloseReason } from "../preferences/FactPopover";
import { ChevronIcon, SlidersIcon } from "../ui/icons";
import { usePresence } from "../ui/motion";
import type { WorkspaceModel } from "./useWorkspace";

export function usePhoneTripTitle(
  { draft, plan }: Pick<WorkspaceModel["session"], "draft" | "plan">,
  name?: string,
) {
  const { locale, currency, t } = useLocale();
  const labels = factLabels(draft, plan?.brief, { locale, currency });
  const range = labels.when?.split(" · ")[0];
  return [name ?? labels.where, range].filter(Boolean).join(" · ") || t("New trip");
}

export function PhoneTripTitle({
  model,
  chatHeader,
}: {
  model: WorkspaceModel;
  chatHeader?: ReactNode;
}) {
  const { t } = useLocale();
  const { draft, plan } = model.session;
  const title = usePhoneTripTitle(model.session, model.history.activeTripName);
  const { openFact, openPreferences, openFactsSheet, closeFactsSheet } = model.layout;
  const button = useRef<HTMLButtonElement>(null);

  const open = model.layout.surface.sheet === "facts";

  const sheet = usePresence(open || undefined, 220);
  const Title = chatHeader ? "div" : "h1";

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
      {chatHeader}
      <Title
        className={`topbar-title phone-topbar__title${chatHeader ? " phone-topbar__details" : ""}`}
      >
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
          {chatHeader ? (
            <SlidersIcon />
          ) : (
            <>
              <span className="phone-topbar__title-text">{title}</span>
              <ChevronIcon />
            </>
          )}
        </button>
      </Title>
      {sheet.value && (
        <TripFactsSheet
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
