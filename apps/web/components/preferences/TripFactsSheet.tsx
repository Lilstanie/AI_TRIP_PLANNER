"use client";
import type { RefObject } from "react";
import type { TripPlan } from "@trip/shared";
import type { Draft } from "@/lib/workspace";
import { draftPreferences } from "@/lib/workspace/workspace";
import { FACTS, factLabels, type FactKey } from "@/lib/workspace/trip-facts";
import type { MessageKey } from "@/lib/i18n/locale";
import { ChevronIcon } from "../ui/icons";
import { useLocale } from "../account/LocaleProvider";
import { FactPopover, type CloseReason } from "./FactPopover";

const NAMES: Record<FactKey, MessageKey> = {
  where: "Where",
  when: "When",
  who: "Who",
  budget: "Budget",
  preferences: "Preferences",
};

export const TRIP_FACTS_SHEET_ID = "trip-facts-sheet";

export function TripFactsSheet({
  draft,
  plan,
  anchor,
  leaving,
  onPick,
  onClose,
}: {
  draft: Draft;
  plan: TripPlan | undefined;

  anchor: RefObject<HTMLElement | null>;
  leaving: boolean;
  onPick(fact: FactKey): void;
  onClose(reason: CloseReason): void;
}) {
  const { locale, currency, t } = useLocale();
  const labels: Partial<Record<FactKey, string>> = factLabels(draft, plan?.brief, {
    locale,
    currency,
  });
  const preferences = draftPreferences(draft).length;
  return (
    <FactPopover
      id={TRIP_FACTS_SHEET_ID}
      title={t("Trip details")}
      anchor={anchor}
      onClose={onClose}
      modal
      leaving={leaving}
      className="fact-popover--facts"
    >
      <ul className="facts-sheet">
        {FACTS.map((fact, index) => {
          const value = fact === "preferences" ? preferences || undefined : labels[fact];
          return (
            <li key={fact}>
              <button
                type="button"
                className="facts-sheet__row"
                data-fact={fact}
                data-empty={value === undefined || undefined}
                data-autofocus={index === 0 || undefined}
                aria-haspopup="dialog"
                onClick={() => onPick(fact)}
              >
                <span className="facts-sheet__name">{t(NAMES[fact])}</span>
                {value !== undefined && <span className="facts-sheet__value">{value}</span>}
                <ChevronIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </FactPopover>
  );
}
