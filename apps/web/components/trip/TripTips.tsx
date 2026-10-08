"use client";
import { useState } from "react";
import type { TripPlan } from "@trip/shared";
import type { MessageKey } from "@/lib/i18n/locale";
import { useLocale } from "../account/LocaleProvider";

const KIND_LABEL: Record<string, MessageKey> = {
  attraction: "Place to explore",
  customs: "Customs & etiquette",
  safety: "Safety notes",
  "entry-health": "Entry & health",
  "weather-packing": "Weather & packing",
  note: "Travel note",
};

const FOLDED_KEY = (tripId: string) => `trip-tips-folded:${tripId}`;

/** Whether this viewer folded the trip's tips last time. Storage may be missing or refuse access. */
function folded(tripId: string): boolean {
  try {
    return window.localStorage.getItem(FOLDED_KEY(tripId)) === "1";
  } catch {
    return false;
  }
}

function rememberFolded(tripId: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(FOLDED_KEY(tripId), "1");
    else window.localStorage.removeItem(FOLDED_KEY(tripId));
  } catch {
    // Not remembered: the tips open again next time, which is the default.
  }
}

/**
 * The destination guide's advice, at the top of the day view. It opens the first time and then keeps
 * whatever the viewer last chose for this trip. Absent when the plan has no guide.
 */
export function TripTips({ plan }: { plan: TripPlan }) {
  const { t } = useLocale();
  const items = (
    plan.sections.find((section) => section.id === "destination-guide")?.proposal?.items ?? []
  ).filter((item) => item.detail.trim());
  // Read once, when the block mounts (the view is keyed by trip). The attribute is not driven after
  // that: the browser's toggle event from mounting an open block would otherwise undo the stored fold.
  const [startOpen] = useState(() => !folded(plan.tripId));
  if (!items.length) return null;
  return (
    <details
      className="trip-tips"
      open={startOpen}
      onToggle={(event) => rememberFolded(plan.tripId, !event.currentTarget.open)}
    >
      <summary>{t("Travel tips")}</summary>
      <ul className="trip-tips__list">
        {items.map((item, index) => (
          <li key={index}>
            <p className="trip-tips__kind">
              {KIND_LABEL[item.kind] ? t(KIND_LABEL[item.kind]!) : item.kind}
            </p>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
