import {
  DATE_TOKEN,
  MONTH_DAY_TOKEN,
  isAmbiguous,
  parseMonthDay,
  parseTripDate,
  type ParsedDate,
} from "./dates";

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

const LEADING_CN =
  /^(?:请|麻烦|帮忙|帮我|给我|我想|我要|想要|想|查询|查一下|查查|查|看一下|看看|看|搜索|搜一下|搜|找一下|找|从)/u;
const TRAILING_CN = /(?:的)?(?:机票|航班|飞机票|票价|价格|往返|来回|单程)$|的$/u;

const TRIP_DATES = new RegExp(`${DATE_TOKEN}|${MONTH_DAY_TOKEN}`, "gi");

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
  const cleaned = strip(
    strip(strip(strip(value.trim(), LEADING), LEADING_CN), TRAILING),
    TRAILING_CN,
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.split(" ").length > 3) return undefined;
  return /[A-Za-z\p{Script=Han}]/u.test(cleaned) ? cleaned : undefined;
}

function tripDates(message: string, today: Date): ParsedDate[] {
  let earliest = today.toISOString().slice(0, 10);
  return [...message.matchAll(TRIP_DATES)].map((match) => {
    const parsed = parseTripDate(match[0]) ?? parseMonthDay(match[0], earliest);
    if (parsed && "iso" in parsed) earliest = parsed.iso;
    return parsed;
  });
}

export function parseFlightQuery(
  message: string,
  today: Date = new Date(),
): FlightQuery | undefined {
  if (!FLIGHT_WORDS.test(message)) return undefined;

  if (PLANNING_WORDS.test(message) || EDIT_WORDS.test(message)) return undefined;

  const undated = message.replace(TRIP_DATES, ",");
  const pair = undated.match(PAIR) ?? undated.match(PAIR_CN);
  const from = city(pair?.[1]);
  const to = city(pair?.[2]);
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return undefined;

  const parsedDates = tripDates(message, today);
  if (parsedDates.some(isAmbiguous)) return undefined;
  const found = parsedDates.filter((parsed): parsed is { iso: string } => !!parsed);
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
