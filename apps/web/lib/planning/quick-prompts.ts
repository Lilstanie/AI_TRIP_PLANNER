import type { MessageKey } from "@/lib/i18n/locale";
import { toIsoDate } from "./date-range";

export type QuickPrompt = { label: MessageKey; text: string };

export function quickPrompts(today: Date = new Date()): QuickPrompt[] {
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  };
  return [
    {
      label: "Sydney · 4 days",
      text: `Plan a 4-day trip to Sydney for 2 people from ${inDays(21)} to ${inDays(25)}, total budget 4000.`,
    },
    {
      label: "Melbourne → Sydney · 5 days",
      text: `Plan a 5-day trip from Melbourne to Sydney for 2 people from ${inDays(30)} to ${inDays(35)}, total budget 5000.`,
    },
    {
      label: "Melbourne → Sydney & Brisbane · 9 days",
      text: `Plan a 9-day trip from Melbourne to Sydney & Brisbane for 2 people from ${inDays(45)} to ${inDays(54)}, total budget 9000.`,
    },
    {
      label: "Sydney & Wollongong · 5 days",
      text: `Plan a 5-day trip to Sydney & Wollongong for 2 people from ${inDays(60)} to ${inDays(65)}, total budget 4500.`,
    },
  ];
}
