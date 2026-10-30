import { detectCurrency, partyPeople, toAud, type TravellerParty } from "@trip/shared";
import { BriefPatchSchema, type BriefPatch } from "./brief";
import { DATE_TOKEN, addDays, parseTripDate } from "./dates";

function amount(value: string): number | undefined {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const NOT_A_PLACE =
  /^(?:旅游|旅行|度假|玩|玩玩|走走|逛逛|散心|出游|出去玩|休假|(?:a\s+)?(?:holiday|vacation|trip|break|getaway))$/iu;

function cleanDestination(value: string): string {
  const place = value
    .trim()
    .replace(/\s+(?:trip|travel|holiday)$/i, "")
    .replace(/[，,。.]+$/, "")
    .trim();
  return NOT_A_PLACE.test(place) ? "" : place;
}

const CHINESE_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function chineseNumber(token: string | undefined): number | undefined {
  if (
    !token ||
    !/^(?:[一二两三四五六七八九]|十[一二三四五六七八九]?|[二三四五六七八九]十[一二三四五六七八九]?)$/.test(
      token,
    )
  )
    return undefined;
  if (!token.includes("十")) return CHINESE_DIGITS[token];
  const [tens, ones] = token.split("十");
  return (CHINESE_DIGITS[tens!] ?? 1) * 10 + (CHINESE_DIGITS[ones!] ?? 0);
}

const ENDS_WITH_FUNCTION_WORD = /\b(?:it|to|by|for|of|be|is|than|into|this|that|them)\s*$/i;

const COUNT = "\\d+|[零〇一二两三四五六七八九十]+";
const PARTY_PATTERNS = [
  ["adults", new RegExp(`(${COUNT})\\s*(?:位|个|名)?\\s*(?:adults?\\b|大人|成人)`, "iu")],
  [
    "children",
    new RegExp(
      `(${COUNT})\\s*(?:位|个|名)?\\s*(?:children\\b|child\\b|kids?\\b|小孩|儿童|孩子)`,
      "iu",
    ),
  ],
  [
    "infants",
    new RegExp(`(${COUNT})\\s*(?:位|个|名)?\\s*(?:infants?\\b|bab(?:y|ies)\\b|婴儿)`, "iu"),
  ],
  [
    "seniors",
    new RegExp(`(${COUNT})\\s*(?:位|个|名)?\\s*(?:seniors?\\b|elderly\\b|老人|长者)`, "iu"),
  ],
  [
    "pets",
    new RegExp(`(${COUNT})\\s*(?:只|条|个)?\\s*(?:pets?\\b|dogs?\\b|cats?\\b|宠物|狗|猫)`, "iu"),
  ],
] as const;

function extractParty(message: string): TravellerParty | undefined {
  const counts = PARTY_PATTERNS.map(([, pattern]) => {
    const token = message.match(pattern)?.[1];
    if (!token) return undefined;
    const parsed = /^\d+$/.test(token) ? Number(token) : chineseNumber(token);
    return parsed !== undefined && parsed >= 0 && parsed <= 99 ? parsed : undefined;
  });
  if (counts.every((entry) => entry === undefined)) return undefined;
  const party = Object.fromEntries(
    PARTY_PATTERNS.map(([key], index) => [key, counts[index] ?? 0]),
  ) as TravellerParty;
  return partyPeople(party) > 0 ? party : undefined;
}

export function statedTripDays(message: string): number | undefined {
  const counts = [
    ...message.matchAll(/(?<!\b(?:in|within|after)\s+)\b(\d{1,2})[\s-]*days?\b/gi),
    ...message.matchAll(/(?<!第\s*)(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:天|日游)/g),
  ].map((match) => Number(match[1]) || chineseNumber(match[1]) || 0);
  const days = counts.reduce((sum, count) => sum + count, 0);
  return days >= 1 ? days : undefined;
}

export function extractBriefPatchLocally(message: string, knownGroupSize?: number): BriefPatch {
  const patch: BriefPatch = {};

  const days = statedTripDays(message);
  const from = message.match(new RegExp(`\\bfrom\\s+${DATE_TOKEN}`, "i"));
  const start = from?.[1] ? parseTripDate(from[1]) : undefined;
  if (days && start && "iso" in start) patch.dates = [start.iso, addDays(start.iso, days - 1)];

  const dates = message.match(
    new RegExp(`${DATE_TOKEN}\\s*(?:to|through|until|–|—|至|到)\\s*${DATE_TOKEN}`, "i"),
  );
  if (dates?.[1] && dates[2]) {
    const start = parseTripDate(dates[1]);
    const end = parseTripDate(dates[2]);
    if (start && end && "iso" in start && "iso" in end) patch.dates = [start.iso, end.iso];
  }

  const budget =
    message.match(
      /(?:budget|预算(?:改成|调整为|是|为)?)[^\d]{0,12}(?:(?:AUD|USD|CNY|RMB|JPY)\s*)?[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    ) ?? message.match(/[$￥¥]\s*([\d,]+(?:\.\d+)?)/);
  const stated = budget?.[1] ? amount(budget[1]) : undefined;
  if (stated !== undefined) {
    const currency = detectCurrency(message);

    patch.budgetTotal = currency ? toAud(stated, currency) : stated;
    if (currency && currency !== "AUD") patch.budgetSource = { amount: stated, currency };
  }

  const named = detectCurrency(message);
  if (named) patch.displayCurrency = named;

  const group = message.match(/(\d+)\s*(?:people|persons?|travell?ers?|人(?!民))/i);
  if (group?.[1]) patch.groupSize = amount(group[1]);
  if (!patch.groupSize) {
    const chineseGroup = message.match(/([零〇一二两三四五六七八九十百千万亿]+)\s*(?:个)?人(?!民)/);
    const written = chineseNumber(chineseGroup?.[1]);
    if (written !== undefined) patch.groupSize = written;
  }

  const party = extractParty(message);
  if (party) {
    if (patch.groupSize === undefined && knownGroupSize === undefined)
      patch.groupSize = partyPeople(party);
    patch.party = party;
  }

  const fromTo = message.match(
    /\b(?:trip|travel|flight|fly(?:ing)?|go(?:ing)?)\s+from\s+([A-Za-z][\w'&.\- ]*?)\s+to\s+([A-Za-z][\w'&.\- ]*?)(?=\s+(?:for|between|on|with|budget|departing|from)\b|[,.;]|$)/i,
  );

  const departing = message.match(
    /\b(?:departing|leaving|flying)\s+(?:from\s+)?([A-Za-z][\w'&.\- ]*?)(?=\s+(?:for|to|on|with|budget)\b|[,.;]|$)/i,
  );
  const chineseOrigin = message.match(
    /从\s*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&·\- ]*?)(?=\s*(?:出发|飞|到|去|前往|，|,|。|$))/u,
  );
  const origin = cleanDestination(fromTo?.[1] ?? departing?.[1] ?? chineseOrigin?.[1] ?? "");
  if (origin) patch.origin = origin;

  const englishDestination = message.match(
    /(?:(?:trip|travel|holiday|go|going)\s+(?:to|in)|visit(?:ing)?)\s+(.+?)(?=\s+(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const explicitDestination = message.match(
    /(?:destination|place)(?:\s+(?:is|to|as))?\s*[:=]?\s+(.+?)(?=\s+(?:and\s+)?(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const leadingDestination = message.match(
    /^\s*([A-Za-z][A-Za-z &.-]+?)\s*[,，]\s*\d{4}-\d{2}-\d{2}/,
  );
  const leadingPlace = message.match(
    /^\s*(?:plan\s+)?([A-Za-z][A-Za-z &.'-]*?)[,\s]+\d+\s+days?\b/i,
  );
  const durationDestination =
    message.match(/\d+[\s-]*days?\s+(?:in|at)\s+(.+?)(?=\s+(?:for|budget|from)\b|[,.;]|$)/i) ??
    (leadingPlace?.[1] && !ENDS_WITH_FUNCTION_WORD.test(leadingPlace[1]) ? leadingPlace : null);
  const chineseDestination = message.match(
    /(?:去|前往|目的地(?:是|为|改成|调整为)?)[：:\s]*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&、·\- ]*?)(?=\s*(?:的?(?:旅行|旅游|之旅)|玩|，|,|。|预算|\d{4}-|$))/u,
  );
  const chineseTripDestination = message.match(
    /的\s*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&、·\- ]*?)\s*之旅/u,
  );
  const destination = cleanDestination(
    englishDestination?.[1] ??
      fromTo?.[2] ??
      explicitDestination?.[1] ??
      leadingDestination?.[1] ??
      durationDestination?.[1] ??
      chineseDestination?.[1] ??
      chineseTripDestination?.[1] ??
      "",
  );
  if (destination)
    patch.destination = destination
      .replace(/\s*[&、]\s*/gu, " & ")
      .replace(/(?<=\p{Script=Han}{2})和(?=\p{Script=Han}{2})/gu, " & ");

  const passport =
    message.match(/([A-Za-z][A-Za-z ]+?)\s+passport/i) ??
    message.match(/([\p{Script=Han}]{2,12})护照/u);
  if (passport?.[1]) patch.nationality = passport[1].trim();

  return BriefPatchSchema.parse(patch);
}
