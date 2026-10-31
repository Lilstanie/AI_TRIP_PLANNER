"use client";
import { keyForText } from "@/lib/i18n/locale";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { useLocale } from "../account/LocaleProvider";
import type { TripPlaces } from "../map/useTripPlaces";
import { deriveOpenItems, OPEN_ITEM_KINDS } from "@/lib/trip/open-items";

export function OpenItemsBadge({
  plan,
  tripPlaces,
  onSelectStop,
  onSelectDay,
}: {
  plan: TripPlan;
  tripPlaces: TripPlaces;
  onSelectStop(id: string): void;
  onSelectDay(day: number): void;
}) {
  const { t, notice } = useLocale();
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useMemo(() => deriveOpenItems(plan, tripPlaces), [plan, tripPlaces]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!items.length) setOpen(false);
  }, [items.length]);

  if (!items.length) return null;

  const select = (stopId: string) => {
    const day = plan.sections
      .flatMap((section) => section.proposal?.items ?? [])
      .find((item) => item.id === stopId)?.day;
    if (day !== undefined) onSelectDay(day);
    onSelectStop(stopId);
    setOpen(false);
  };

  return (
    <div ref={root} className="open-items">
      <button
        ref={button}
        type="button"
        className="open-items__badge"
        aria-label={t("openItemsCount", { count: items.length })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="open-items__count">{items.length}</span>
      </button>
      {open && (
        <div
          id={popoverId}
          className="open-items__popover glass-float glass-float--raised"
          role="dialog"
          aria-label={t("openItems")}
        >
          {OPEN_ITEM_KINDS.map((kind) => {
            const entries = items.filter((item) => item.kind === kind);
            if (!entries.length) return null;
            return (
              <section key={kind} className="open-items__group">
                <h3>
                  {t(keyForText(kind))} · {entries.length}
                </h3>
                <ul>
                  {entries.map((item) => (
                    <li key={item.key}>
                      {item.kind === "Itinerary issue" ? (
                        notice(item.notice)
                      ) : (
                        <button
                          type="button"
                          aria-label={`${t(keyForText(kind))}: ${item.label}`}
                          onClick={() => select(item.stopId)}
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
