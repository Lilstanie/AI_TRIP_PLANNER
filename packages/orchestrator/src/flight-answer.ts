import {
  BASE_CURRENCY,
  FlightAnswer as FlightAnswerSchema,
  moneyIn,
  type BookingPort,
  type FlightAnswer,
} from "@trip/shared";
import type { FlightQuery } from "./flight-query";

/** How many itineraries are shown with both legs; each costs one extra search. */
const ITINERARIES_SHOWN_IN_FULL = 2;

/**
 * Answer "what does this flight cost" with fares and nothing else.
 *
 * The planning workflow exists to reconcile an itinerary, a stay, dining and a
 * budget against each other. A fare question needs none of that, so this calls
 * the one provider it needs and returns. Running five specialists to answer it
 * would cost five model calls and still bury the number in a trip plan.
 *
 * A provider failure is reported, not hidden: an empty list with a plain reason
 * beats a confident price nobody can honour.
 */
export async function answerFlightQuery(
  query: FlightQuery,
  booking: BookingPort,
): Promise<FlightAnswer> {
  const { from, to, depart, passengers } = query;
  const trip = `${from} → ${to} on ${depart}`;

  let options: (FlightAnswer["options"][number] & { returnToken?: string })[] = [];
  let failure: string | undefined;
  try {
    const found = await booking.searchFlights({
      from,
      to,
      depart,
      ...(query.return ? { return: query.return } : {}),
      passengers,
    });
    options = found
      .filter((option) => Number.isFinite(option.price) && option.price >= 0 && option.carrier.trim())
      .map((option) => ({
        carrier: option.carrier,
        price: option.price,
        ...(option.note ? { note: option.note } : {}),
        ...(option.stops !== undefined ? { stops: option.stops } : {}),
        ...(option.durationMin !== undefined ? { durationMin: option.durationMin } : {}),
        ...(option.outbound ? { outbound: option.outbound } : {}),
        ...(option.roundTrip ? { roundTrip: true } : {}),
        ...(option.returnToken ? { returnToken: option.returnToken } : {}),
      }))
      // Cheapest first whether or not they asked: it is the useful order, and
      // when they did ask it is the answer.
      .sort((a, b) => a.price - b.price);

    // The way home, for the itineraries that will be shown in full only.
    // Google Flights needs a separate search per itinerary for its returns, so
    // fetching every one would spend the monthly allowance on fares nobody
    // reads. Two is what fits on screen beside each other.
    if (booking.searchReturnLeg && query.return) {
      const shown = options.slice(0, ITINERARIES_SHOWN_IN_FULL);
      const legs = await Promise.all(
        shown.map((option) =>
          option.returnToken && option.roundTrip
            ? booking
                .searchReturnLeg!({
                  from,
                  to,
                  depart,
                  return: query.return,
                  passengers,
                  token: option.returnToken,
                })
                .catch(() => undefined)
            : Promise.resolve(undefined),
        ),
      );
      shown.forEach((option, index) => {
        const leg = legs[index];
        if (leg) option.inbound = leg;
      });
    }
    // The token is a provider handle, not something a reader needs.
    for (const option of options) delete option.returnToken;
  } catch (error) {
    failure = error instanceof Error ? error.message : "The flight provider was unavailable.";
  }

  const party = passengers === 1 ? "1 traveller" : `${passengers} travellers`;
  const cheapest = options[0];
  const reply = failure
    ? `I could not price ${trip}: ${failure}`
    : cheapest
      ? `Cheapest ${trip} for ${party}: ${cheapest.carrier} at ${moneyIn(cheapest.price, BASE_CURRENCY)}${
          options.length > 1 ? `, out of ${options.length} fares found` : ""
        }. Prices are whole-party totals and change without notice; nothing here is booked.`
      : `No fares came back for ${trip}. Try a nearby date, or a different pair of cities.`;

  return FlightAnswerSchema.parse({
    type: "flight_answer",
    reply,
    from,
    to,
    depart,
    ...(query.return ? { return: query.return } : {}),
    passengers,
    options,
    ...(cheapest?.note
      ? {
          source: {
            kind: "live",
            label: "Flight provider",
            freshness: cheapest.note,
          },
        }
      : {}),
  });
}
