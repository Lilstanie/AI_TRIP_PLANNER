import { DATE_TOKEN, parseTripDate } from "./dates";

export interface FlightQuery {
  from: string;
  to: string;
  depart: string;
  return?: string;
  passengers: number;

  cheapestFirst: boolean;
}

const FLIGHT_WORDS = /\b(?:flights?|flying|fly|airfare|airfares|fares?)\b|机票|航班|航線/i;
const PLANNING_WORDS = /\b(?:plan|planning|itinerary|organi[sz]e)\b|规划|行程|安排/i;

const EDIT_WORDS =
  /\b(?:change|swap|replace|update|move|instead|remove|cancel|rebook|make it)\b|改成|换成|改为|换一/i;
const CHEAPEST_WORDS = /\b(?:cheapest|lowest|least expensive|best price|budget)\b|最便宜|最低价/i;

const PAIR =
  /(?:from\s+)?([A-Za-z][A-Za-z'’.\- ]{1,30}?)\s+(?:to|→)\s+([A-Za-z][A-Za-z'’.\- ]{1,30}?)(?=\s+(?:flights?|fly|on|for|in|departing|leaving|at|\d)|[,.?!]|$)/i;
const PAIR_CN = /([\p{Script=Han}]{2,10})\s*(?:到|飞|前往)\s*([\p{Script=Han}]{2,10})/u;

const LEADING =
  /^(?:what(?:'s|s| is)?|which|the|a|an|any|cheap(?:est)?|lowest|best|price|prices|flights?|flying|fly|airfares?|fares?|tickets?|from|for|show|find|me|is|are|there)\s+/i;
const TRAILING =
  /\s+(?:flights?|flying|fly|airfares?|fares?|tickets?|price|prices|one[- ]way|return)$/i;

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

  if (!cleaned || cleaned.split(" ").length > 3) return undefined;
  return /[A-Za-z\p{Script=Han}]/u.test(cleaned) ? cleaned : undefined;
}

export function parseFlightQuery(message: string): FlightQuery | undefined {
  if (!FLIGHT_WORDS.test(message)) return undefined;

  if (PLANNING_WORDS.test(message) || EDIT_WORDS.test(message)) return undefined;

  const pair = message.match(PAIR) ?? message.match(PAIR_CN);
  const from = city(pair?.[1]);
  const to = city(pair?.[2]);
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return undefined;

  const found = [...message.matchAll(new RegExp(DATE_TOKEN, "gi"))]
    .map((match) => parseTripDate(match[0]))
    .filter((parsed): parsed is { iso: string } => !!parsed && "iso" in parsed);
  if (!found.length) return undefined;

  const passengers = Number(
    message.match(/(\d+)\s*(?:people|persons?|passengers?|adults?|人)/i)?.[1],
  );

  return {
    from,
    to,
    depart: found[0]!.iso,
    ...(found[1] ? { return: found[1].iso } : {}),
    passengers: Number.isInteger(passengers) && passengers > 0 ? passengers : 1,
    cheapestFirst: CHEAPEST_WORDS.test(message),
  };
}
