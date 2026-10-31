import type { MessageKey } from "@/lib/i18n/locale";
import { toIsoDate } from "./date-range";

export type QuickPrompt = {
  label: MessageKey;
  text: MessageKey;
  params: { start: string; end: string };
};

export function quickPrompts(today: Date = new Date()): QuickPrompt[] {
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  };
  return [
    {
      label: "sydney4Days",
      text: "planA4DayTrip",
      params: { start: inDays(21), end: inDays(24) },
    },
    {
      label: "melbourneSydney5Days",
      text: "planA5DayTrip",
      params: { start: inDays(30), end: inDays(34) },
    },
    {
      label: "melbourneSydneyBrisbane9Days",
      text: "planA9DayTrip",
      params: { start: inDays(45), end: inDays(53) },
    },
    {
      label: "sydneyWollongong5Days",
      text: "planA5DayTripTo",
      params: { start: inDays(60), end: inDays(64) },
    },
  ];
}
