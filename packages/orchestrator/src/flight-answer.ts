import {
  BASE_CURRENCY,
  FlightAnswer as FlightAnswerSchema,
  moneyIn,
  type BookingPort,
  type FlightAnswer,
} from "@trip/shared";
import type { FlightQuery } from "./flight-query";

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

  let options: FlightAnswer["options"] = [];
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
      }))
      // Cheapest first whether or not they asked: it is the useful order, and
      // when they did ask it is the answer.
      .sort((a, b) => a.price - b.price);
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
