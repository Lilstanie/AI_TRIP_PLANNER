"use client";
import { useEffect, useMemo, useState } from "react";
import type { TripPlan } from "@trip/shared";
import {
  DAY_MS,
  calendarDays,
  dateTime,
  monthStart,
  monthStarts,
  tripDay,
  weekStart,
  weekStarts,
  type CalendarCategory,
  type CalendarDay,
  type CalendarEntry,
} from "@/lib/trip/calendar";
import { intlLocale, translate, type AppLocale } from "@/lib/i18n/locale";
import { useLocale } from "../account/LocaleProvider";
import { FlowAttractionIcon, FlowFlightIcon, FlowStayIcon } from "../ui/flow-icons";

type CalendarView = "week" | "month";

function categoryLabel(category: CalendarCategory, locale: AppLocale) {
  if (category === "activity") return translate(locale, "Stops");
  if (category === "stay") return translate(locale, "Stay");
  if (category === "transport") return translate(locale, "Transport");
  return translate(locale, "Flight");
}

function CategoryIcon({ category, size }: { category: CalendarCategory; size: number }) {
  const Icon =
    category === "activity"
      ? FlowAttractionIcon
      : category === "stay"
        ? FlowStayIcon
        : FlowFlightIcon;
  return <Icon size={size} />;
}

function statusLabel(entry: CalendarEntry, locale: AppLocale) {
  if (entry.allDay) {
    return entry.category === "activity"
      ? translate(locale, "Untimed")
      : translate(locale, "All day");
  }
  return [entry.startTime, entry.endTime].filter(Boolean).join("–");
}

function CalendarEvent({
  entry,
  locale,
  selected,
  onSelect,
}: {
  entry: CalendarEntry;
  locale: AppLocale;
  selected: boolean;
  onSelect(activityId: string, day: number): void;
}) {
  const status = statusLabel(entry, locale);
  const activityId = entry.activity?.id;
  const content = (
    <>
      <span className="trip-home-calendar__event-head">
        <CategoryIcon category={entry.category} size={12} />
        <span className="trip-home-calendar__event-title">{entry.title}</span>
      </span>
      <span className="trip-home-calendar__event-meta">
        {entry.allDay && entry.category === "activity" && (
          <span>{translate(locale, "All day")}</span>
        )}
        <span>{status}</span>
        {entry.overlap && <span>{translate(locale, "Overlap")}</span>}
      </span>
    </>
  );
  const common = {
    className: "trip-home-calendar__event",
    "data-category": entry.category,
    "data-time": entry.allDay ? "untimed" : "timed",
    "data-overlap": entry.overlap ? "true" : undefined,
    ...(entry.category === "activity" ? {} : { "data-row-type": entry.category }),
  };
  if (!activityId) return <span {...common}>{content}</span>;
  return (
    <button
      {...common}
      type="button"
      data-activity-id={activityId}
      data-selected={selected || undefined}
      aria-label={[entry.title, categoryLabel(entry.category, locale), status, entry.detail]
        .filter(Boolean)
        .join(", ")}
      onClick={() => onSelect(activityId, entry.day)}
    >
      {content}
    </button>
  );
}

function CalendarEntries({
  day,
  locale,
  selectedActivity,
  onSelectActivity,
}: {
  day: CalendarDay;
  locale: AppLocale;
  selectedActivity?: string;
  onSelectActivity(activityId: string, day: number): void;
}) {
  const allDay = day.entries.filter((entry) => entry.allDay);
  const timed = day.entries.filter((entry) => !entry.allDay);
  return (
    <div className="trip-home-calendar__entries">
      {allDay.length > 0 && (
        <section
          className="trip-home-calendar__row trip-home-calendar__row--all-day"
          aria-label={translate(locale, "All day activities")}
        >
          <h4>{translate(locale, "All day")}</h4>
          {allDay.map((entry) => (
            <CalendarEvent
              key={entry.key}
              entry={entry}
              locale={locale}
              selected={!!entry.activity?.id && entry.activity.id === selectedActivity}
              onSelect={onSelectActivity}
            />
          ))}
        </section>
      )}
      {timed.length > 0 && (
        <section
          className="trip-home-calendar__row trip-home-calendar__row--timed"
          aria-label={translate(locale, "Timed activities")}
        >
          {timed.map((entry) => (
            <CalendarEvent
              key={entry.key}
              entry={entry}
              locale={locale}
              selected={!!entry.activity?.id && entry.activity.id === selectedActivity}
              onSelect={onSelectActivity}
            />
          ))}
        </section>
      )}
    </div>
  );
}

export function TripHomeCalendar({
  plan,
  onSelectDay,
  onSelectActivity,
  selectedActivity,
  selectedDay,
}: {
  plan: TripPlan;
  onSelectDay(day: number): void;
  onSelectActivity(activityId: string, day: number): void;
  selectedActivity?: string;
  selectedDay?: number;
}) {
  const { locale } = useLocale();
  const intl = intlLocale(locale);
  const days = useMemo(() => calendarDays(plan, locale), [plan, locale]);
  const weeks = useMemo(() => weekStarts(plan), [plan]);
  const months = useMemo(() => monthStarts(plan), [plan]);
  const selected = Math.min(Math.max(1, selectedDay ?? 1), days.length);
  const selectedTime = dateTime(days[selected - 1]?.date) ?? 0;
  const tripStart = dateTime(days[0]?.date) ?? selectedTime;
  const selectedMonday = weekStart(selectedTime);
  const selectedWeek = selectedMonday < tripStart ? tripStart : selectedMonday;
  const selectedMonth = monthStart(selectedTime);
  const [view, setView] = useState<CalendarView>("week");
  const [visibleWeek, setVisibleWeek] = useState(selectedWeek);
  const [visibleMonth, setVisibleMonth] = useState(selectedMonth);

  useEffect(() => {
    setVisibleWeek(selectedWeek);
    setVisibleMonth(selectedMonth);
  }, [selectedWeek, selectedMonth]);

  if (!days.length) return null;

  const weekdays = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    timeZone: "UTC",
  });
  const fullDate = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthLabel = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekLabel = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const weekIndex = Math.max(0, weeks.indexOf(visibleWeek));
  const monthIndex = Math.max(0, months.indexOf(visibleMonth));
  const weekDays = Array.from({ length: 7 }, (_, index) => visibleWeek + index * DAY_MS);
  const currentMonth = new Date(visibleMonth);
  const leading = (currentMonth.getUTCDay() + 6) % 7;
  const monthDays = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const monthWeek = weekStart(visibleMonth);
  const previousLabel = view === "week" ? "Previous week" : "Previous month";
  const nextLabel = view === "week" ? "Next week" : "Next month";
  const canPrevious = view === "week" ? weekIndex > 0 : monthIndex > 0;
  const canNext = view === "week" ? weekIndex < weeks.length - 1 : monthIndex < months.length - 1;

  return (
    <div
      className="trip-home-calendar"
      data-view={view}
      data-selected-day={selected}
      data-selected-date={days[selected - 1]!.date}
    >
      <div className="trip-home-calendar__toolbar">
        <div
          className="trip-home-calendar__views"
          role="group"
          aria-label={translate(locale, "Calendar view")}
        >
          {(["week", "month"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {translate(locale, value === "week" ? "Week" : "Month")}
            </button>
          ))}
        </div>
        <div className="trip-home-calendar__legend" aria-label={translate(locale, "Trip details")}>
          {(["activity", "flight", "stay"] as const).map((category) => (
            <span data-category={category} key={category}>
              <CategoryIcon category={category} size={14} />
              {categoryLabel(category, locale)}
            </span>
          ))}
        </div>
      </div>

      <div className="trip-home-calendar__period">
        <button
          type="button"
          disabled={!canPrevious}
          aria-label={translate(locale, previousLabel)}
          onClick={() => {
            if (view === "week") setVisibleWeek(weeks[weekIndex - 1]!);
            else setVisibleMonth(months[monthIndex - 1]!);
          }}
        >
          ‹
        </button>
        <h3>
          {view === "week"
            ? `${weekLabel.format(weekDays[0])} – ${weekLabel.format(weekDays.at(-1)!)}`
            : monthLabel.format(visibleMonth)}
        </h3>
        <button
          type="button"
          disabled={!canNext}
          aria-label={translate(locale, nextLabel)}
          onClick={() => {
            if (view === "week") setVisibleWeek(weeks[weekIndex + 1]!);
            else setVisibleMonth(months[monthIndex + 1]!);
          }}
        >
          ›
        </button>
      </div>

      {view === "week" ? (
        <div className="trip-home-calendar__week" role="list">
          {weekDays.map((time) => {
            const day = tripDay(plan, time);
            const entry = day === undefined ? undefined : days[day - 1];
            return (
              <section className="trip-home-calendar__week-day" role="listitem" key={time}>
                <span className="trip-home-calendar__weekday">
                  {weekdays.format(new Date(time))}
                </span>
                {entry ? (
                  <>
                    <button
                      type="button"
                      className="trip-home-calendar__date"
                      data-day={entry.day}
                      aria-pressed={selected === entry.day}
                      aria-label={fullDate.format(new Date(time))}
                      onClick={() => onSelectDay(entry.day)}
                    >
                      {new Date(time).getUTCDate()}
                    </button>
                    <CalendarEntries
                      day={entry}
                      locale={locale}
                      selectedActivity={selectedActivity}
                      onSelectActivity={onSelectActivity}
                    />
                  </>
                ) : (
                  <span className="trip-home-calendar__outside" aria-hidden="true" />
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <section className="trip-home-calendar__month" aria-label={monthLabel.format(visibleMonth)}>
          <div className="trip-home-calendar__weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index}>{weekdays.format(new Date(monthWeek + index * DAY_MS))}</span>
            ))}
          </div>
          <div className="trip-home-calendar__grid">
            {Array.from({ length: leading }, (_, index) => (
              <span className="trip-home-calendar__blank" key={`blank-${index}`} />
            ))}
            {Array.from({ length: monthDays }, (_, index) => {
              const time = visibleMonth + index * DAY_MS;
              const day = tripDay(plan, time);
              const entry = day === undefined ? undefined : days[day - 1];
              if (!entry) return <span className="trip-home-calendar__blank" key={index + 1} />;
              return (
                <section className="trip-home-calendar__month-day" key={index + 1}>
                  <button
                    type="button"
                    className="trip-home-calendar__date"
                    data-day={entry.day}
                    aria-pressed={selected === entry.day}
                    aria-label={fullDate.format(new Date(time))}
                    onClick={() => onSelectDay(entry.day)}
                  >
                    {index + 1}
                  </button>
                  <CalendarEntries
                    day={entry}
                    locale={locale}
                    selectedActivity={selectedActivity}
                    onSelectActivity={onSelectActivity}
                  />
                </section>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
