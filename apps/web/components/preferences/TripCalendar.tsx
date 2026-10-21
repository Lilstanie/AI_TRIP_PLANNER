"use client";
import { zhCN } from "react-day-picker/locale";
import { useLocale } from "../account/LocaleProvider";
import { DayButton as BaseDayButton, DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

export function TripCalendar({
  range,
  onSelect,
  numberOfMonths = 2,
  defaultMonth,
  ariaDescribedBy,
}: {
  range: DateRange | undefined;
  onSelect(range: DateRange | undefined): void;
  numberOfMonths?: number;
  defaultMonth?: Date;
  ariaDescribedBy?: string;
}) {
  const { locale } = useLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <DayPicker
      className="trip-calendar"
      locale={locale === "zh" ? zhCN : undefined}
      mode="range"
      selected={range}
      defaultMonth={defaultMonth}
      onSelect={onSelect}
      components={{
        DayButton: (props) => (
          <BaseDayButton
            {...props}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaDescribedBy ? true : undefined}
          />
        ),
      }}
      disabled={{ before: today }}
      numberOfMonths={numberOfMonths}
      showOutsideDays
    />
  );
}
