"use client";
import { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { isoDateRange } from "@/lib/planning/date-range";
import { Dialog } from "../ui/Dialog";

/**
 * A calendar for picking a date range by click, as an alternative to typing
 * two dates by hand. Reused from two places (the chat composer and the When
 * chip's editor in the top bar) with different `onConfirm` handlers — this component
 * only turns clicks into a validated {start, end} ISO pair; what each caller
 * does with that (fill a chat message vs. patch a form draft directly) is
 * entirely up to them.
 */
export function DateRangePicker({
  title = "When are you travelling?",
  onConfirm,
  onClose,
}: {
  title?: string;
  onConfirm: (range: { start: string; end: string }) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState<DateRange>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = range ? isoDateRange(range) : undefined;

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="date-picker">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          disabled={{ before: today }}
          numberOfMonths={2}
          showOutsideDays
        />
      </div>
      <div className="date-picker__actions">
        <button type="button" onClick={onClose}>
          Cancel
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
          Use these dates
        </button>
      </div>
    </Dialog>
  );
}
