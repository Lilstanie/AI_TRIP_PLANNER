"use client";
import { useEffect, useRef, useState } from "react";
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

function savedFolded(tripId: string): boolean | undefined {
  try {
    const value = window.localStorage.getItem(FOLDED_KEY(tripId));
    return value === "1" ? true : value === "0" ? false : undefined;
  } catch {
    return undefined;
  }
}

function rememberFolded(tripId: string, value: boolean) {
  try {
    window.localStorage.setItem(FOLDED_KEY(tripId), value ? "1" : "0");
  } catch {
    return;
  }
}

export function TripTips({ plan, onTrip = false }: { plan: TripPlan; onTrip?: boolean }) {
  const { t } = useLocale();
  const items = (
    plan.sections.find((section) => section.id === "destination-guide")?.proposal?.items ?? []
  ).filter((item) => item.detail.trim());

  const preference = useRef(savedFolded(plan.tripId));
  const [open, setOpen] = useState(() =>
    preference.current === undefined ? false : !preference.current,
  );
  useEffect(() => {
    if (preference.current === undefined) setOpen(false);
  }, [onTrip]);
  if (!items.length) return null;
  return (
    <details
      className="disclosure trip-tips"
      open={open}
      onClick={(event) => {
        if (!(event.target instanceof HTMLElement) || !event.target.closest("summary")) return;
        event.preventDefault();
        const nextOpen = !open;
        preference.current = !nextOpen;
        setOpen(nextOpen);
        rememberFolded(plan.tripId, !nextOpen);
      }}
    >
      <summary>{t("Travel tips")}</summary>
      <ul className="trip-tips__list">
        {items.map((item, index) => (
          <li key={index}>
            <p className="trip-tips__kind">
              {KIND_LABEL[item.kind] ? t(KIND_LABEL[item.kind]!) : item.kind}
            </p>
            <p>{item.detail}</p>
            {item.packing?.length ? (
              <ul className="trip-tips__packing">
                {item.packing.map((entry, entryIndex) => (
                  <li key={entryIndex}>{entry}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
