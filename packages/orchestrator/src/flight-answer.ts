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

  const cheapest = options[0];
  const reply = /\p{Script=Han}/u.test(`${from}${to}`) ? chineseReply() : englishReply();

  function chineseReply() {
    const route = `${from} → ${to} ${depart}`;
    if (failure) return `暂时查不到 ${route} 的票价：${failure}`;
    if (!cheapest) return `${route} 没有查到票价，可以换个相近的日期或城市试试。`;
    const count = options.length > 1 ? `，共找到 ${options.length} 个票价` : "";
    return `${route}，${passengers} 位旅客最便宜的是 ${cheapest.carrier}，${moneyIn(cheapest.price, BASE_CURRENCY)}${count}。价格是全体旅客的总价，随时可能变动，这里不会预订。`;
  }

  function englishReply() {
    const party = passengers === 1 ? "1 traveller" : `${passengers} travellers`;
    if (failure) return `I could not price ${trip}: ${failure}`;
    if (!cheapest)
      return `No fares came back for ${trip}. Try a nearby date, or a different pair of cities.`;
    const count = options.length > 1 ? `, out of ${options.length} fares found` : "";
    return `Cheapest ${trip} for ${party}: ${cheapest.carrier} at ${moneyIn(cheapest.price, BASE_CURRENCY)}${count}. Prices are whole-party totals and change without notice; nothing here is booked.`;
  }

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
