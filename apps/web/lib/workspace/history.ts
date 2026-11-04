import { effectiveCurrency, type Currency } from "@trip/shared";
import type { AppLocale, MessageKey } from "../i18n/locale";
import { moneyDisplay } from "../money";
import {
  conversationTitle,
  isUntouchedConversation,
  searchCatalog,
  type WorkspaceCatalog,
} from "./catalog";
import { distinctTripTitles, tripMeta, tripName } from "./trip-identity";
import type { Draft } from "./workspace";

export type HistoryInput = {
  catalog: WorkspaceCatalog;
  query: string;
  locale: AppLocale;
  displayCurrency: Currency;
  defaults: Draft;
  blank: boolean;
  t: (text: MessageKey, params?: Record<string, string | number>) => string;
};

export function historyLists({
  catalog,
  query,
  locale,
  displayCurrency,
  defaults,
  blank,
  t,
}: HistoryInput) {
  const tripTitles = distinctTripTitles(catalog.trips, (item) => tripName(item, t));
  const filtered = searchCatalog(catalog, query, (item) => [
    tripTitles.get(item.id)!,
    tripMeta(item, locale, displayCurrency, t),
  ]);
  const chats = filtered.conversations.map((item) => {
    const trip = item.tripId && catalog.trips.find((record) => record.id === item.tripId);
    return {
      id: item.id,
      title: conversationTitle(item, locale),
      subtitle: trip ? tripTitles.get(trip.id) : undefined,
      active: item.id === catalog.activeConversationId,
      untouched: !item.renamed && isUntouchedConversation(item, defaults),
    };
  });
  const trips = filtered.trips.map((item) => ({
    id: item.id,
    title: tripTitles.get(item.id)!,
    destination: item.snapshot.plan.brief.destination,
    subtitle: `${item.snapshot.plan.brief.dates.join(" – ")} · ${moneyDisplay({
      currency: effectiveCurrency(item.snapshot.plan.brief, displayCurrency),
      locale,
    }).money(item.snapshot.plan.estTotal)}`,
    active: !blank && item.id === catalog.activeTripId,
  }));
  return { chats, trips };
}
