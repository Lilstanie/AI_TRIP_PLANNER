import { toIsoDate } from "./date-range";

/** A one-click example trip: a short button label, and the message it sends. */
export type QuickPrompt = { label: string; text: string };

/**
 * Ready-to-run example trips for the blank chat.
 *
 * Each states destination, dates, travellers and budget, so one click produces
 * a finished plan rather than the assistant asking three follow-up questions.
 * That is both a better first impression and the fastest way to exercise the
 * whole planning path by hand while developing.
 *
 * Dates are offsets from today, never literals: a hardcoded date quietly
 * becomes a past date, and live provider searches reject those — the prompt
 * would keep looking fine while only ever failing.
 *
 * Phrase these as "trip to <city>". TripBrief has no origin field, so a
 * "from A to B" prompt states something the planner cannot use — and the
 * offline extractor, whose destination pattern keys on "trip to", drops the
 * destination entirely when it sees that shape.
 */
export function quickPrompts(today: Date = new Date()): QuickPrompt[] {
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  };
  return [
    {
      label: "Sydney · 4 days",
      text: `Plan a 4-day trip to Sydney for 2 people from ${inDays(21)} to ${inDays(25)}, total budget 4000 AUD.`,
    },
    {
      label: "Seoul · 5 days",
      text: `Plan a 5-day trip to Seoul for 2 people from ${inDays(30)} to ${inDays(35)}, total budget 6000 AUD.`,
    },
    {
      label: "Paris & Lisbon · 8 days",
      text: `Plan an 8-day trip to Paris & Lisbon for 3 people from ${inDays(45)} to ${inDays(53)}, total budget 9000 AUD.`,
    },
    {
      label: "Singapore solo · 3 days",
      text: `Plan a 3-day solo trip to Singapore from ${inDays(14)} to ${inDays(17)}, total budget 1800 AUD.`,
    },
  ];
}
