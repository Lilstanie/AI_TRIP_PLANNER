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
      label: "Sydney · 4 days",
      text: "Plan a 4-day trip to Sydney for 2 people from {start} to {end}, total budget 4000.",
      params: { start: inDays(21), end: inDays(24) },
    },
    {
      label: "Melbourne → Sydney · 5 days",
      text: "Plan a 5-day trip from Melbourne to Sydney for 2 people from {start} to {end}, total budget 5000.",
      params: { start: inDays(30), end: inDays(34) },
    },
    {
      label: "Melbourne → Sydney & Brisbane · 9 days",
      text: "Plan a 9-day trip from Melbourne to Sydney & Brisbane for 2 people from {start} to {end}, total budget 9000.",
      params: { start: inDays(45), end: inDays(53) },
    },
    {
      label: "Sydney & Wollongong · 5 days",
      text: "Plan a 5-day trip to Sydney & Wollongong for 2 people from {start} to {end}, total budget 4500.",
      params: { start: inDays(60), end: inDays(64) },
    },
  ];
}
