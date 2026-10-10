import {
  BASE_CURRENCY,
  FlightAnswer as FlightAnswerSchema,
  moneyIn,
  type BookingPort,
  type FlightAnswer,
} from "@trip/shared";
import type { FlightQuery } from "./flight-query";

const ITINERARIES_SHOWN_IN_FULL = 2;

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
      .filter(
        (option) => Number.isFinite(option.price) && option.price >= 0 && option.carrier.trim(),
      )
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

      .sort((a, b) => a.price - b.price);

    if (booking.searchReturnLeg && query.return) {
      const shown = options.slice(0, ITINERARIES_SHOWN_IN_FULL);
      const legs = await Promise.all(
        shown.map((option) =>
          option.returnToken && option.roundTrip
            ? booking.searchReturnLeg!({
                from,
                to,
                depart,
                return: query.return,
                passengers,
                token: option.returnToken,
              }).catch(() => undefined)
            : Promise.resolve(undefined),
        ),
      );
      shown.forEach((option, index) => {
        const leg = legs[index];
        if (leg) option.inbound = leg;
      });
    }

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
