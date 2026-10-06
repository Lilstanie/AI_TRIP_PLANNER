"use client";
import { useEffect, useState } from "react";
import { TripPlan } from "@trip/shared";
import { budgetHint, money, WELCOME_MESSAGE, type Message } from "@/lib/workspace";

export type DialogKind = "review" | "settings";
/**
 * Narrow screens show one view at a time. Up to 1000 px that is chat or map, with trip and
 * navigation as drawers; phones (520 px and narrower) add the Trip and Mine tabs instead.
 */
export type MobileView = "chat" | "map" | "trip" | "mine";
export const PHONE_VIEWS: readonly MobileView[] = ["chat", "map", "trip", "mine"];
const NARROW_QUERY = "(max-width: 1000px)";
const PHONE_QUERY = "(max-width: 520px)";

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useIsNarrow = () => useMedia(NARROW_QUERY);
/** The phone shell: a bottom tab bar and a one-row top bar. */
export const useIsPhone = () => useMedia(PHONE_QUERY);

/** Topbar facts from the plan only; nothing is shown for values the trip does not have. */
export function tripFacts(plan: TripPlan) {
  const { dates, groupSize, budgetTotal } = plan.brief;
  const days = (Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000 + 1;
  return [
    Number.isFinite(days) && days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : undefined,
    `${groupSize} ${groupSize === 1 ? "traveller" : "travellers"}`,
    `${money(budgetTotal)}${budgetHint(plan.brief)} budget`,
  ].filter(Boolean);
}
export const seed: Message[] = [
  {
    role: "agent",
    text: WELCOME_MESSAGE,
  },
];
export const STORAGE_FULL =
  "Browser storage is unavailable or full. Your current plan is still in this tab. Retry after freeing space.";
