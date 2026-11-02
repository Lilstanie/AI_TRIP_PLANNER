import {
  BASE_CURRENCY,
  FlightAnswer as FlightAnswerSchema,
  formatMoney,
  type BookingPort,
  type FlightAnswer,
  type FlightPriceInsight,
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
  let priceInsight: FlightPriceInsight | undefined;
  try {
    const found = await booking.searchFlights({
      from,
      to,
      depart,
      ...(query.return ? { return: query.return } : {}),
      passengers,
    });
    priceInsight = found.find((option) => option.priceInsight)?.priceInsight;
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
  const chinese = query.language ? query.language === "zh" : /\p{Script=Han}/u.test(`${from}${to}`);
  const range = priceInsight?.typicalRange
    ?.map((price) => formatMoney(price, BASE_CURRENCY))
    .join("–");

  const reply = chinese ? chineseReply() : englishReply();

  function chineseAdvice() {
    if (!priceInsight) return "";
    const usual = range ? `Google 常见的 ${range}` : "这条航线的常见价位";
    if (priceInsight.level === "low") return `这个价比 ${usual} 低，合适的话可以早点订。`;
    if (priceInsight.level === "high")
      return `这个价比 ${usual} 高，日期灵活的话可以换相近日期，或者再等等看。`;
    return range ? `这个价在 Google 常见的 ${range} 之内，属于正常价位。` : "这个价属于正常价位。";
  }

  function englishAdvice() {
    if (!priceInsight) return "";
    const usual = range ? `Google's usual ${range}` : "the usual fare for this route";
    if (priceInsight.level === "low")
      return ` That is below ${usual}, so booking soon is reasonable.`;
    if (priceInsight.level === "high")
      return ` That is above ${usual}; if your dates are flexible, try nearby days or wait for a drop.`;
    return range
      ? ` That is within Google's usual ${range}.`
      : " That is a typical fare for this route.";
  }

  function chineseReply() {
    const route = `${from} → ${to} ${depart}`;
    if (failure) return `暂时查不到 ${route} 的票价：${failure}`;
    if (!cheapest) return `${route} 没有查到票价，可以换个相近的日期或城市试试。`;
    const count = options.length > 1 ? `，共找到 ${options.length} 个票价` : "";
    const each =
      passengers > 1 ? `（每人约 ${formatMoney(cheapest.price / passengers, BASE_CURRENCY)}）` : "";
    return `${route}，${passengers} 位旅客最便宜的是 ${cheapest.carrier}，${formatMoney(cheapest.price, BASE_CURRENCY)}${each}${count}。${chineseAdvice()}价格是全体旅客的总价，随时可能变动，这里不会预订。`;
  }

  function englishReply() {
    const party = passengers === 1 ? "1 traveller" : `${passengers} travellers`;
    if (failure) return `I could not price ${trip}: ${failure}`;
    if (!cheapest)
      return `No fares came back for ${trip}. Try a nearby date, or a different pair of cities.`;
    const count = options.length > 1 ? `, out of ${options.length} fares found` : "";
    const each =
      passengers > 1
        ? ` (about ${formatMoney(cheapest.price / passengers, BASE_CURRENCY)} each)`
        : "";
    return `Cheapest ${trip} for ${party}: ${cheapest.carrier} at ${formatMoney(cheapest.price, BASE_CURRENCY)}${each}${count}.${englishAdvice()} Prices are whole-party totals and change without notice; nothing here is booked.`;
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
    ...(cheapest && priceInsight ? { priceInsight } : {}),
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
