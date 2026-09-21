"use client";
import { useEffect, useState } from "react";
import { TripPlan, type ChatRequest } from "@trip/shared";
import { budgetHint, money, type Message } from "@/lib/workspace";

/** Every turn is a chat turn: there is no "apply a decision" request. */
export type Task = { kind: "chat"; request: ChatRequest };
export type DialogKind = "review" | "saved" | "language" | "account";
/** Narrow screens show one of chat or map; preferences, trip and navigation are drawers. */
export type MobileView = "chat" | "map";
const NARROW_QUERY = "(max-width: 1000px)";

export function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

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
    text: "Edit your trip preferences or tell me what to change. I'll build the plan here, and you can ask for changes in this chat at any time.",
  },
];
export const STORAGE_FULL =
  "Browser storage is unavailable or full. Your current plan is still in this tab. Retry after freeing space.";
