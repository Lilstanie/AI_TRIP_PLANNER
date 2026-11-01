import type { StaySelection } from "@trip/shared";

type StayCandidate = StaySelection["candidates"][number];

export type StayOfferTag = "selected" | "cheapest" | "topRated";

export type StayOffer = {
  candidate: StayCandidate;
  tags: StayOfferTag[];
  total: number;
};

export const STAY_OFFER_LIMIT = 6;

export function stayOffers(stay: StaySelection, limit = STAY_OFFER_LIMIT): StayOffer[] {
  const selected = stay.candidates.find((candidate) => candidate.id === stay.selectedId);
  const seen = new Set<string>();
  const unique: StayCandidate[] = [];
  for (const candidate of selected ? [selected, ...stay.candidates] : stay.candidates) {
    const key = candidate.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  const byPrice = [...unique].sort((a, b) => a.pricePerNight - b.pricePerNight);
  const cheapest = byPrice[0];
  const topRated = [...unique].sort(
    (a, b) => b.rating - a.rating || a.pricePerNight - b.pricePerNight,
  )[0];
  const anchor = selected?.pricePerNight ?? cheapest?.pricePerNight ?? 0;
  const nearest = [...unique].sort(
    (a, b) => Math.abs(a.pricePerNight - anchor) - Math.abs(b.pricePerNight - anchor),
  );
  const shown: StayCandidate[] = [];
  for (const candidate of [selected, cheapest, topRated, ...nearest]) {
    if (!candidate || shown.includes(candidate)) continue;
    shown.push(candidate);
    if (shown.length === limit) break;
  }
  const several = shown.length > 1;
  return shown.map((candidate) => {
    const tags: StayOfferTag[] = [];
    if (candidate === selected) tags.push("selected");
    if (several && candidate === cheapest) tags.push("cheapest");
    if (several && candidate === topRated && candidate.rating > 0) tags.push("topRated");
    return { candidate, tags, total: candidate.pricePerNight * stay.rooms * stay.nights };
  });
}
