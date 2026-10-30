"use client";
import type { MessageKey } from "@/lib/i18n/locale";
import { useLocale } from "@/components/account/LocaleProvider";
import { useSettings } from "@/components/account/SettingsProvider";
import { distinctTripTitles, tripMeta, tripName } from "@/lib/workspace/trip-identity";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TripRecord } from "@/lib/workspace/catalog";
import { PlusIcon } from "../ui/icons";
import { TripHomeCalendar } from "./TripHomeCalendar";
import { useSegmentIndicator } from "../ui/motion";
import { TripCover } from "./TripCover";
import { TripUndo, type DeletedTrip } from "./TripUndo";
import { HistoryMenu } from "./WorkspaceSidebar";

export type Tab = "trips" | "calendar";
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "trips", label: "Trips" },
  { id: "calendar", label: "Calendar" },
];

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const todayUtc = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

export function TripsPage({
  trips,
  activeTripId,
  onOpenTrip,
  onNewTrip,
  onRenameTrip,
  onDeleteTrip,
  deletedTrip,
  embedded = false,
  allTrips = trips,
  tab: controlledTab,
  onTab,
  focusTripId,
}: {
  trips: TripRecord[];
  allTrips?: TripRecord[];
  activeTripId?: string;
  onOpenTrip(id: string): void;
  onNewTrip(): void;
  onRenameTrip(id: string): void;
  onDeleteTrip(id: string): void;
  deletedTrip?: DeletedTrip;
  embedded?: boolean;
  tab?: Tab;
  onTab?(tab: Tab): void;
  focusTripId?: string;
}) {
  const { t } = useLocale();
  const [ownTab, setOwnTab] = useState<Tab>("trips");
  const tab = controlledTab ?? ownTab;
  const setTab = (next: Tab) => {
    setOwnTab(next);
    onTab?.(next);
  };
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const tabList = useRef<HTMLDivElement>(null);
  useSegmentIndicator(tabList, tab);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "trips" ? "calendar" : "trips";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="trips-page">
      <div className="trips-page__inner">
        {!embedded && (
          <header className="trips-page__head">
            <h1>{t("Your trips")}</h1>
            <button type="button" className="trips-page__new" onClick={onNewTrip}>
              <PlusIcon />
              <span>{t("New trip")}</span>
            </button>
          </header>
        )}
        {!embedded && deletedTrip && <TripUndo deleted={deletedTrip} />}
        {(!embedded || allTrips.length > 0) && (
          <div
            ref={tabList}
            className="trips-page__tabs segmented"
            role="tablist"
            aria-label={t("Your trips")}
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node;
                }}
                type="button"
                role="tab"
                id={`trips-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`trips-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                onKeyDown={onTabKey}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        )}
        <div
          key={tab}
          role="tabpanel"
          id={`trips-panel-${tab}`}
          aria-labelledby={`trips-tab-${tab}`}
          className="trips-page__panel tab-panel-enter"
        >
          {tab === "trips" ? (
            <TripCards
              trips={trips}
              allTrips={allTrips}
              activeTripId={activeTripId}
              onOpenTrip={onOpenTrip}
              onRenameTrip={onRenameTrip}
              onDeleteTrip={onDeleteTrip}
            />
          ) : (
            <TripCalendar
              trips={trips}
              allTrips={allTrips}
              onOpenTrip={onOpenTrip}
              focusTripId={focusTripId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TripCards({
  trips,
  allTrips,
  activeTripId,
  onOpenTrip,
  onRenameTrip,
  onDeleteTrip,
}: {
  trips: TripRecord[];
  allTrips: TripRecord[];
  activeTripId?: string;
  onOpenTrip(id: string): void;
  onRenameTrip(id: string): void;
  onDeleteTrip(id: string): void;
}) {
  const { t, locale } = useLocale();
  const { settings } = useSettings();
  const groups = useMemo(() => {
    const today = todayUtc();
    const byStart = [...trips].sort(
      (a, b) => utc(a.snapshot.plan.brief.dates[0]) - utc(b.snapshot.plan.brief.dates[0]),
    );
    return [
      {
        title: "Upcoming" as const,
        items: byStart.filter((trip) => utc(trip.snapshot.plan.brief.dates[1]) >= today),
      },
      {
        title: "Past" as const,
        items: byStart.filter((trip) => utc(trip.snapshot.plan.brief.dates[1]) < today).reverse(),
      },
    ].filter((group) => group.items.length);
  }, [trips]);
  const titles = distinctTripTitles(allTrips, (trip) => tripName(trip, t));

  if (!trips.length) return <p className="trips-page__empty">{t("No trips yet.")}</p>;

  return groups.map((group) => (
    <section key={group.title} className="trips-page__group" aria-label={t(group.title)}>
      <h2>{t(group.title)}</h2>
      <ul className="trip-cards">
        {group.items.map((trip) => {
          const { destination } = trip.snapshot.plan.brief;
          return (
            <li key={trip.id}>
              <button
                type="button"
                className="trip-card"
                aria-current={trip.id === activeTripId ? "true" : undefined}
                onClick={() => onOpenTrip(trip.id)}
              >
                <TripCover destination={destination} size="card" />
                <span className="trip-card__text">
                  <span className="trip-card__title">{titles.get(trip.id)}</span>
                  <span className="trip-card__meta">
                    {tripMeta(trip, locale, settings.displayCurrency, t)}
                  </span>
                </span>
              </button>
              <HistoryMenu
                title={titles.get(trip.id)!}
                onRename={() => onRenameTrip(trip.id)}
                onDelete={() => onDeleteTrip(trip.id)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  ));
}

function TripCalendar({
  trips,
  allTrips,
  onOpenTrip,
  focusTripId,
}: {
  trips: TripRecord[];
  allTrips: TripRecord[];
  focusTripId?: string;
  onOpenTrip(id: string): void;
}) {
  const { t } = useLocale();
  const titles = distinctTripTitles(allTrips, (trip) => tripName(trip, t));
  const [tripId, setTripId] = useState(() => {
    if (focusTripId) return focusTripId;
    const today = todayUtc();
    return [...trips]
      .sort((a, b) => utc(a.snapshot.plan.brief.dates[0]) - utc(b.snapshot.plan.brief.dates[0]))
      .find((trip) => utc(trip.snapshot.plan.brief.dates[1]) >= today)?.id;
  });
  const [day, setDay] = useState<number>();
  const trip = trips.find((item) => item.id === tripId) ?? trips[0];
  if (!trip)
    return <p className="trips-page__empty">{t("Trips you plan will appear on the calendar.")}</p>;
  return (
    <div className="trips-calendar">
      <div className="trips-calendar__head">
        <div className="trips-calendar__picker" role="group" aria-label={t("Trips")}>
          {trips.map((item) => (
            <button
              type="button"
              key={item.id}
              className="trips-calendar__trip"
              aria-pressed={item.id === trip.id}
              onClick={() => {
                setTripId(item.id);
                setDay(undefined);
              }}
            >
              {titles.get(item.id) ?? tripName(item, t)}
            </button>
          ))}
        </div>
        <button type="button" className="trips-calendar__open" onClick={() => onOpenTrip(trip.id)}>
          {t("View trip")}
        </button>
      </div>
      <TripHomeCalendar
        key={trip.id}
        plan={trip.snapshot.plan}
        selectedDay={day}
        onSelectDay={setDay}
        onSelectActivity={() => onOpenTrip(trip.id)}
      />
    </div>
  );
}
