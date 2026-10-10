"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { isoDateRange } from "@/lib/planning/date-range";
import { Dialog } from "../ui/Dialog";
import { TripCalendar } from "./TripCalendar";

export function DateRangePicker({
  title = "When are you travelling?",
  onConfirm,
  onClose,
}: {
  title?: string;
  onConfirm: (range: { start: string; end: string }) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [range, setRange] = useState<DateRange>();
  const iso = range ? isoDateRange(range) : undefined;

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="date-picker">
        <TripCalendar range={range} onSelect={setRange} numberOfMonths={2} />
      </div>
      <div className="date-picker__actions">
        <button type="button" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!iso}
          onClick={() => {
            if (iso) onConfirm(iso);
            onClose();
          }}
        >
          {t("Use these dates")}
        </button>
      </div>
    </Dialog>
  );
}
