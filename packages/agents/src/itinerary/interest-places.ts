import type { TripBrief } from "@trip/shared";

const INTEREST_QUERY: Partial<Record<string, string>> = {
  temples: "famous temples and shrines",
  history: "historic landmarks, castles and old towns",
  nature: "parks, gardens, beaches and viewpoints",
  food: "famous food markets and street food areas",
  shopping: "popular shopping streets and markets",
  nightlife: "night markets and nightlife districts",
};

export function interestQueries(brief: TripBrief): string[] {
  const party = brief.party;
  return [
    ...new Set(
      (brief.intent?.interests ?? []).flatMap((interest) => {
        const query = INTEREST_QUERY[interest];
        return query ? [query] : [];
      }),
    ),
    ...((party?.children ?? 0) + (party?.infants ?? 0) > 0 ? ["family attractions for kids"] : []),
  ];
}

export function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  return Array.from({ length: longest }, (_, index) =>
    lists.flatMap((list) => (index < list.length ? [list[index]!] : [])),
  ).flat();
}
