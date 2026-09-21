import { detectCurrency, toAud } from "@trip/shared";
import { BriefPatchSchema, type BriefPatch } from "./brief";

/**
 * The no-API-key path. Patterns can only ever cover the phrasings someone
 * thought to list, which is why this is a fallback and not the main path — the
 * conversation agent reads the message itself when a model is configured.
 *
 * Known limits, kept deliberately rather than papered over: dates must be ISO,
 * and anything phrased outside these patterns is simply not seen. That is a
 * survivable degradation offline; guessing would not be.
 */

function amount(value: string): number | undefined {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function cleanDestination(value: string): string {
  return value
    .trim()
    .replace(/\s+(?:trip|travel|holiday)$/i, "")
    .replace(/[，,。.]+$/, "")
    .trim();
}

export function extractBriefPatchLocally(message: string): BriefPatch {
  const patch: BriefPatch = {};

  const dates = message.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:to|through|until|–|—|至|到)\s*(\d{4}-\d{2}-\d{2})/i,
  );
  if (dates?.[1] && dates[2]) patch.dates = [dates[1], dates[2]];

  const budget =
    message.match(
      /(?:budget|预算(?:改成|调整为|是|为)?)[^\d]{0,12}(?:(?:AUD|USD|CNY|RMB|JPY)\s*)?[$￥¥]?\s*([\d,]+(?:\.\d+)?)/i,
    ) ?? message.match(/[$￥¥]\s*([\d,]+(?:\.\d+)?)/);
  const stated = budget?.[1] ? amount(budget[1]) : undefined;
  if (stated !== undefined) {
    const currency = detectCurrency(message);
    // Convert here rather than storing what they typed: every amount downstream
    // is in the base currency. An unmarked amount already is one.
    patch.budgetTotal = currency ? toAud(stated, currency) : stated;
    if (currency && currency !== "AUD") patch.budgetSource = { amount: stated, currency };
  }

  // `人` must not match the 人 inside 人民币 — that read "3000 人民币" as a party
  // of 3000. The same trap as 元 inside 美元; see detectCurrency.
  const group = message.match(/(\d+)\s*(?:people|persons?|travell?ers?|人(?!民))/i);
  if (group?.[1]) patch.groupSize = amount(group[1]);
  if (!patch.groupSize) {
    const chineseGroup = message.match(/([一二两三四五六七八九十])\s*(?:个)?人(?!民)/);
    const values: Record<string, number> = {
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
    if (chineseGroup?.[1]) patch.groupSize = values[chineseGroup[1]];
  }

  // "a trip from A to B" states both ends at once. Without this the destination
  // pattern below never fires on that phrasing — it keys on "trip to" — so the
  // destination was silently dropped, and the trip planned for nowhere.
  const fromTo = message.match(
    /\b(?:trip|travel|flight|fly(?:ing)?|go(?:ing)?)\s+from\s+([A-Za-z][\w'&.\- ]*?)\s+to\s+([A-Za-z][\w'&.\- ]*?)(?=\s+(?:for|between|on|with|budget|departing|from)\b|[,.;]|$)/i,
  );
  // "departing Melbourne", "leaving from Melbourne". Requires a letter first so
  // "departing 2026-10-12" cannot be read as a city.
  const departing = message.match(
    /\b(?:departing|leaving|flying)\s+(?:from\s+)?([A-Za-z][\w'&.\- ]*?)(?=\s+(?:for|to|on|with|budget)\b|[,.;]|$)/i,
  );
  const chineseOrigin = message.match(
    /从\s*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&·\- ]*?)(?=\s*(?:出发|飞|到|去|，|,|。|$))/u,
  );
  const origin = cleanDestination(
    fromTo?.[1] ?? departing?.[1] ?? chineseOrigin?.[1] ?? "",
  );
  if (origin) patch.origin = origin;

  const englishDestination = message.match(
    /(?:(?:trip|travel|holiday|go|going)\s+(?:to|in)|visit(?:ing)?)\s+(.+?)(?=\s+(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const explicitDestination = message.match(
    /(?:destination|place)(?:\s+(?:is|to|as))?\s*[:=]?\s+(.+?)(?=\s+(?:and\s+)?(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const leadingDestination = message.match(
    /^\s*([A-Za-z][A-Za-z &.\-]+?)\s*[,，]\s*\d{4}-\d{2}-\d{2}/,
  );
  const chineseDestination = message.match(
    /(?:去|前往|目的地(?:是|为|改成|调整为)?)[：:\s]*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&·\- ]*?)(?=\s*(?:旅行|旅游|玩|，|,|。|预算|\d{4}-|$))/u,
  );
  const destination = cleanDestination(
    englishDestination?.[1] ??
      fromTo?.[2] ??
      explicitDestination?.[1] ??
      leadingDestination?.[1] ??
      chineseDestination?.[1] ??
      "",
  );
  if (destination) patch.destination = destination;

  const passport =
    message.match(/([A-Za-z][A-Za-z ]+?)\s+passport/i) ??
    message.match(/([\p{Script=Han}]{2,12})护照/u);
  if (passport?.[1]) patch.nationality = passport[1].trim();

  return BriefPatchSchema.parse(patch);
}
