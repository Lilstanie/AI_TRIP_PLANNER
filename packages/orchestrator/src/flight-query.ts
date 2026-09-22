import { DATE_TOKEN, parseTripDate } from "./dates";

/**
 * A direct "what does this flight cost" question, as opposed to a request to
 * plan a trip.
 *
 * Answering one needs a fraction of what planning needs — two cities and a
 * date, not a group size, a budget or five specialists — so recognising it is
 * what lets the assistant answer instead of interrogating.
 *
 * Recognition is deliberately conservative. Mistaking a planning request for a
 * lookup skips the whole itinerary and hands back a bare fare, which is far
 * worse than missing a lookup and planning a trip the traveller can refine. So
 * an explicit planning verb always wins, and a query missing a date is not one.
 */
export interface FlightQuery {
  from: string;
  to: string;
  depart: string;
  return?: string;
  passengers: number;
  /** They asked for the cheapest specifically, so lead with it. */
  cheapestFirst: boolean;
}

const FLIGHT_WORDS = /\b(?:flights?|flying|fly|airfare|airfares|fares?)\b|机票|航班|航線/i;
const PLANNING_WORDS = /\b(?:plan|planning|itinerary|organi[sz]e)\b|规划|行程|安排/i;
/**
 * Editing an open trip, not asking what something costs. "Change the flight to
 * Tokyo on the 25th" names a flight, two cities and a date, and is still a
 * request to the planner rather than a lookup.
 */
const EDIT_WORDS =
  /\b(?:change|swap|replace|update|move|instead|remove|cancel|rebook|make it)\b|改成|换成|改为|换一/i;
const CHEAPEST_WORDS = /\b(?:cheapest|lowest|least expensive|best price|budget)\b|最便宜|最低价/i;

/** "Sydney to Seoul", "from Melbourne to Tokyo", "悉尼到首尔". */
const PAIR =
  /(?:from\s+)?([A-Za-z][A-Za-z'’.\- ]{1,30}?)\s+(?:to|→)\s+([A-Za-z][A-Za-z'’.\- ]{1,30}?)(?=\s+(?:flights?|fly|on|for|in|departing|leaving|at|\d)|[,.?!]|$)/i;
const PAIR_CN = /([\p{Script=Han}]{2,10})\s*(?:到|飞|前往)\s*([\p{Script=Han}]{2,10})/u;

// A question wraps the two cities in words that are not part of either name.
// Both ends are stripped repeatedly, so "what is the cheapest flight from
// Melbourne" reduces to "Melbourne" rather than to "the cheapest flight from".
const LEADING =
  /^(?:what(?:'s|s| is)?|which|the|a|an|any|cheap(?:est)?|lowest|best|price|prices|flights?|flying|fly|airfares?|fares?|tickets?|from|for|show|find|me|is|are|there)\s+/i;
const TRAILING =
  /\s+(?:flights?|flying|fly|airfares?|fares?|tickets?|price|prices|one[- ]way|return)$/i;
/** The same job in Chinese: "首尔的机票" is a destination plus two trailing words. */
const TRAILING_CN = /(?:的)?(?:机票|航班|飞机票|票价|价格)$|的$/u;

function strip(value: string, pattern: RegExp): string {
  let result = value;
  for (let guard = 0; guard < 8; guard += 1) {
    const next = result.replace(pattern, "").trim();
    if (next === result) break;
    result = next;
  }
  return result;
}

function city(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = strip(strip(strip(value.trim(), LEADING), TRAILING), TRAILING_CN)
    .replace(/\s+/g, " ")
    .trim();
  // A city name is short; anything longer is sentence fragments, not a place.
  if (!cleaned || cleaned.split(" ").length > 3) return undefined;
  return /[A-Za-z\p{Script=Han}]/u.test(cleaned) ? cleaned : undefined;
}

export function parseFlightQuery(message: string): FlightQuery | undefined {
  if (!FLIGHT_WORDS.test(message)) return undefined;
  // "Plan a trip … and book a flight" is a trip, not a lookup, and "change the
  // flight to …" is an edit to one.
  if (PLANNING_WORDS.test(message) || EDIT_WORDS.test(message)) return undefined;

  const pair = message.match(PAIR) ?? message.match(PAIR_CN);
  const from = city(pair?.[1]);
  const to = city(pair?.[2]);
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return undefined;

  // Every date in the sentence, in order: one is a one-way, two is a return.
  const found = [...message.matchAll(new RegExp(DATE_TOKEN, "gi"))]
    .map((match) => parseTripDate(match[0]))
    .filter((parsed): parsed is { iso: string } => !!parsed && "iso" in parsed);
  if (!found.length) return undefined;

  const passengers = Number(message.match(/(\d+)\s*(?:people|persons?|passengers?|adults?|人)/i)?.[1]);

  return {
    from,
    to,
    depart: found[0]!.iso,
    ...(found[1] ? { return: found[1].iso } : {}),
    passengers: Number.isInteger(passengers) && passengers > 0 ? passengers : 1,
    cheapestFirst: CHEAPEST_WORDS.test(message),
  };
}
