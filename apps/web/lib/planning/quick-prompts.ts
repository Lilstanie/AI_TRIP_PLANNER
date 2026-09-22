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
 * Between them they exercise the planner's four travel shapes, so a change
 * that breaks one is visible from the blank chat rather than only under test:
 * a single city (stops connected by local transport), one city to another (a
 * priced flight), a multi-city run whose hops are too far to travel on the
 * ground (each promoted to its own flight), and a multi-city run close enough
 * to stay on the ground.
 */
export function quickPrompts(today: Date = new Date()): QuickPrompt[] {
  const inDays = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  };
  return [
    {
      // One city: two stops a day, each connected by real local transport.
      label: "Sydney · 4 days",
      text: `Plan a 4-day trip to Sydney for 2 people from ${inDays(21)} to ${inDays(25)}, total budget 4000 AUD.`,
    },
    {
      // A to B: states an origin, so the arrival is a priced flight.
      label: "Melbourne → Sydney · 5 days",
      text: `Plan a 5-day trip from Melbourne to Sydney for 2 people from ${inDays(30)} to ${inDays(35)}, total budget 5000 AUD.`,
    },
    {
      // Hops far enough apart that the ground journey cannot fit a planning
      // day, so each is flown: Sydney to Brisbane is 15 hours by coach.
      label: "Melbourne → Sydney & Brisbane · 9 days",
      text: `Plan a 9-day trip from Melbourne to Sydney & Brisbane for 2 people from ${inDays(45)} to ${inDays(54)}, total budget 9000 AUD.`,
    },
    {
      // Close enough to stay on the ground: 95 minutes by train, so the hop is
      // never promoted to a flight. Google's transit routing does not cover
      // intercity rail everywhere — Tokyo to Kyoto returns nothing at all —
      // so this example uses a pair it can actually answer.
      label: "Sydney & Wollongong · 5 days",
      text: `Plan a 5-day trip to Sydney & Wollongong for 2 people from ${inDays(60)} to ${inDays(65)}, total budget 4500 AUD.`,
    },
  ];
}
