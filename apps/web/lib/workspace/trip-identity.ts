import { effectiveCurrency, type Currency } from "@trip/shared";
import type { AppLocale } from "@/lib/i18n/locale";
import { moneyDisplay } from "@/lib/money";
import type { TripRecord } from "./catalog";
import { dateRangeLabel } from "./trip-facts";

export function tripName(
  trip: TripRecord,
  t: (text: "tripToDestination", params: { destination: string }) => string,
): string {
  return trip.renamed
    ? trip.title
    : t("tripToDestination", { destination: trip.snapshot.plan.brief.destination });
}

export function distinctTripTitles(
  trips: readonly TripRecord[],
  titleFor: (trip: TripRecord) => string,
) {
  const identity = (trip: TripRecord) => {
    const { brief } = trip.snapshot.plan;
    return JSON.stringify([brief.destination, brief.dates, brief.groupSize, brief.budgetTotal]);
  };
  const counts = new Map<string, number>();
  for (const trip of trips) counts.set(identity(trip), (counts.get(identity(trip)) ?? 0) + 1);
  const positions = new Map<string, number>();
  return new Map(
    trips.map((trip) => {
      const key = identity(trip);
      const position = (positions.get(key) ?? 0) + 1;
      positions.set(key, position);
      const title = titleFor(trip);
      return [trip.id, counts.get(key)! > 1 ? `${title} · ${position}` : title];
    }),
  );
}

export function tripDays(trip: TripRecord): number {
  const [start, end] = trip.snapshot.plan.brief.dates.map((date) =>
    Date.parse(`${date}T00:00:00Z`),
  );
  return Math.max(1, Math.round((end! - start!) / 86_400_000) + 1);
}

export function tripMeta(
  trip: TripRecord,
  locale: AppLocale,
  displayCurrency: Currency,
  t: (text: "day" | "days") => string,
): string {
  const { brief, estTotal } = trip.snapshot.plan;
  const length = tripDays(trip);
  const dateRange = dateRangeLabel(brief.dates[0], brief.dates[1], locale);
  const total = moneyDisplay({ currency: effectiveCurrency(brief, displayCurrency), locale }).money(
    estTotal,
  );
  return `${brief.destination} · ${dateRange ? `${dateRange} · ` : ""}${length} ${length === 1 ? t("day") : t("days")} · ${total}`;
}

export function tripTags(
  trip: TripRecord,
  locale: AppLocale,
  displayCurrency: Currency,
  t: (
    text: "day" | "days" | "{count} traveller" | "{count} travellers",
    params?: { count: number },
  ) => string,
): string[] {
  const { brief } = trip.snapshot.plan;
  const days = tripDays(trip);
  const travellers = brief.groupSize;
  return [
    brief.destination.trim(),
    dateRangeLabel(brief.dates[0], brief.dates[1], locale) ??
      `${days} ${days === 1 ? t("day") : t("days")}`,
    travellers > 0
      ? t(travellers === 1 ? "{count} traveller" : "{count} travellers", { count: travellers })
      : "",
    brief.budgetTotal > 0
      ? moneyDisplay({
          currency: effectiveCurrency(brief, displayCurrency),
          locale,
          whole: true,
        }).money(brief.budgetTotal, brief.budgetSource)
      : "",
  ].filter(Boolean);
}
