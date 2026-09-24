"use client";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

/**
 * The trip date-range calendar, styled with the app's tokens: rounded day cells, a soft accent
 * band filling a picked range and solid accent circles at its start and end, today marked. Shared
 * by the When chip's inline picker (`FactFields`) and `DateRangePicker`'s dialog, so the two never
 * drift apart. Past dates are always disabled — a trip cannot be planned into the past.
 */
export function TripCalendar({
  range,
  onSelect,
  numberOfMonths = 2,
}: {
  range: DateRange | undefined;
  onSelect(range: DateRange | undefined): void;
  numberOfMonths?: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <DayPicker
      className="trip-calendar"
      mode="range"
      selected={range}
      onSelect={onSelect}
      disabled={{ before: today }}
      numberOfMonths={numberOfMonths}
      showOutsideDays
    />
  );
}
