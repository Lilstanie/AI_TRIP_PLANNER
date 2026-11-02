import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatRequest, TripPlan } from "@trip/shared";
import { replyLanguageRule } from "@trip/agents";
import { replyLanguage } from "../reply-language";

function materialPlan(plan: TripPlan): unknown {
  const identityFields = new Set(["tripId", "userId", "editVersion", "round"]);
  const timestampFields = new Set(["createdAt", "updatedAt", "timestamp", "observedAt"]);
  const normalize = (value: unknown, path: string[] = []): unknown => {
    if (Array.isArray(value))
      return value.map((item, index) => normalize(item, [...path, String(index)]));
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    const selected =
      typeof record.selectedId === "string" && Array.isArray(record.candidates)
        ? record.candidates.find(
            (candidate) =>
              !!candidate &&
              typeof candidate === "object" &&
              (candidate as Record<string, unknown>).id === record.selectedId,
          )
        : undefined;
    const isSectionSummary = (key: string) =>
      key === "summary" && path.length === 2 && path[0] === "sections";
    const isProposalSummary = (key: string) => key === "summary" && path.at(-1) === "proposal";
    return Object.fromEntries(
      Object.entries(record)
        .filter(
          ([key]) =>
            !identityFields.has(key) &&
            key !== "id" &&
            !key.endsWith("Id") &&
            !key.endsWith("Ids") &&
            !timestampFields.has(key) &&
            !isSectionSummary(key) &&
            !isProposalSummary(key),
        )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item, [...path, key])])
        .concat(
          selected === undefined
            ? []
            : [["selectedCandidate", normalize(selected, [...path, "selectedCandidate"])]],
        ),
    );
  };
  return normalize(plan);
}

function samePlan(left: TripPlan, right: TripPlan): boolean {
  return JSON.stringify(materialPlan(left)) === JSON.stringify(materialPlan(right));
}

export function unchangedPlanReply(request: ChatRequest, planned: TripPlan): string | undefined {
  if (!request.plan || !samePlan(request.plan, planned)) return undefined;
  return replyLanguage(request.message, request.interfaceLanguage) === "zh"
    ? "我重新检查了行程，但没有应用任何变化。请告诉我想修改的内容。"
    : "I rechecked the itinerary, but no changes were applied. Tell me what you would like changed.";
}

const PLAN_SUCCESS_CLAIM =
  /\b(?:done\b|(?:i(?:(?:'|’)?ve| have)?\s+)?(?:moved|added|removed|dropped|deleted|rescheduled|shortened|extended|changed|updated)\b|(?:has|have|had|was|were|is|are)\s+(?:been\s+)?(?:moved|added|removed|dropped|deleted|rescheduled|shortened|extended|changed|updated)\b)|(?:已完成|已改(?:好|成|到)?|改好了|已移除|已删(?:除|掉)|已添加|已新增|已调整|已更新)/i;

const INFORMATION_QUESTION =
  /^(?:(?!what if\b)(?:what|which|when|where|who|whom|whose|why|how (?:much|many|long|far|often))\b[^\n]*\?|[^\n]*(?:什么|哪|多少|几)[^\n]*[？?])$/i;

const BOOKING_CLAIM =
  /\b(?:booked|reserved|purchased|ticketed|confirmation number|reservation code)\b|(?:已|已经)(?:预订|预定|订好|购买|出票)|酒店.{0,6}(?:已订|订好)|机票.{0,6}已出票/i;

const FLIGHT_BOOKING_CLAIM =
  /\b(?:flights?|airfare|plane tickets?)\b.{0,24}\b(?:booked|reserved|purchased|ticketed|confirmed)\b|\b(?:booked|reserved|purchased|ticketed|confirmed)\b.{0,24}\b(?:flights?|airfare|plane tickets?)\b|(?:机票|航班票).{0,8}(?:(?:已|已经)?(?:预订|预定|订好|购买|买了|出票))|(?:(?:已|已经)?(?:预订|预定|订好|购买|买了|出票)).{0,8}(?:机票|航班票)/i;

const USER_BOOKING_EVIDENCE =
  /\b(?:i|we)(?:(?:'|’)ve|\s+have|\s+already|\s+had)?\s+(?:booked|reserved|purchased|ticketed)\b|\b(?:booked|reserved|purchased|ticketed)\s+(?:a|an|the|our|my)\b|(?:我|我们)(?:已经|已)?(?:预订|预定|订好|买了|购买|出票)了?/i;

const USER_FLIGHT_BOOKING_EVIDENCE =
  /\b(?:i|we)(?:(?:'|’)ve|\s+have|\s+already|\s+had)?\s+(?:booked|reserved|purchased|ticketed)\s+(?:(?:the|our|my)\s+)?(?:flights?|airfare|plane tickets?)\b|\b(?:flights?|airfare|plane tickets?)\b.{0,24}\b(?:are|were|have been)?\s*(?:booked|reserved|purchased|ticketed|confirmed)\b|(?:我|我们)(?:已经|已)?(?:预订|预定|订好|买了|购买|出票)了?(?:.{0,8})(?:机票|航班票)|(?:机票|航班票).{0,8}(?:我|我们)(?:已经|已)?(?:预订|预定|订好|买了|购买|出票)/i;

function itineraryItems(plan: TripPlan) {
  return plan.sections.flatMap((section) => section.proposal?.items ?? []);
}

function itemText(item: ReturnType<typeof itineraryItems>[number]): string {
  return [item.kind, item.detail, item.location, item.savedPlace?.name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();
}

function subjectTokens(subject: string): string[] {
  const ignored = new Set([
    "a",
    "an",
    "and",
    "at",
    "for",
    "from",
    "in",
    "it",
    "of",
    "on",
    "the",
    "to",
    "with",
  ]);
  return subject
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !ignored.has(token));
}

function containsSubject(text: string, subject: string): boolean {
  const tokens = subjectTokens(subject);
  return tokens.length > 0 && tokens.every((token) => text.includes(token));
}

function briefFactApplied(
  request: ChatRequest,
  planned: TripPlan,
  message: string,
): boolean | undefined {
  const before = request.plan?.brief;
  if (!before) return undefined;
  if (
    /(?:\b(?:no accommodation|without accommodation|don't need (?:a )?(?:hotel|stay))\b|不需要住宿)/i.test(
      message,
    )
  )
    return planned.brief.noAccommodation === true;
  if (
    /\b(?:exclude|skip|don't (?:need|include)|arrange (?:our |my )?flights myself)/i.test(message)
  )
    return planned.brief.excludeFlights === true;
  if (
    /\b(?:destination|travel to|go to)\b/i.test(message) &&
    before.destination !== planned.brief.destination
  )
    return true;
  if (
    /\b(?:dates?|from|until|through|between)\b/i.test(message) &&
    before.dates.join() !== planned.brief.dates.join()
  )
    return true;
  if (
    /\b(?:budget|spend|cost)\b/i.test(message) &&
    before.budgetTotal !== planned.brief.budgetTotal
  )
    return true;
  if (/\bbook(?:ed|ing)?\b/i.test(message) && planned.brief.bookedStay) return true;
  return undefined;
}

function requestedPlanChangeApplied(request: ChatRequest, planned: TripPlan): boolean {
  const previous = request.plan;
  const message = request.message;
  if (!previous) {
    const beforeItems = itineraryItems(planned);
    return beforeItems.length > 0 || planned.sections.some((section) => Boolean(section.proposal));
  }
  if (samePlan(previous, planned)) return false;

  const fact = briefFactApplied(request, planned, message);
  const beforeItems = itineraryItems(previous);
  const afterItems = itineraryItems(planned);

  const moved = message.match(/\b(?:move|reschedule|shift)\s+(.+?)\s+(?:to|onto)\s+day\s*(\d+)\b/i);
  const movedApplied =
    !moved ||
    afterItems.some(
      (item) => item.day === Number(moved[2]) && containsSubject(itemText(item), moved[1] ?? ""),
    );

  const added = message.match(/\b(?:add|include)\s+(.+?)(?:\s+(?:on|to)\s+day\s*(\d+)\b|$)/i);
  const addedApplied =
    !added ||
    afterItems.some(
      (item) =>
        (added[2] === undefined || item.day === Number(added[2])) &&
        containsSubject(itemText(item), added[1] ?? ""),
    );

  const removed = message.match(
    /\b(?:remove|drop|delete|take out)\s+(.+?)(?:\s+(?:from|on)\s+day\s*(\d+)\b|$)/i,
  );
  const removedSubject = removed?.[1] ?? "";
  const removedDay = removed?.[1]?.match(/\bday\s*(\d+)\b/i)?.[1];
  const removedApplied =
    !removed ||
    (removedDay
      ? beforeItems.some((item) => item.day === Number(removedDay)) &&
        !afterItems.some((item) => item.day === Number(removedDay))
      : containsSubject(
          beforeItems.map(itemText).join(" "),
          removedSubject.replace(/\bday\s*\d+\b/i, ""),
        ) &&
        !containsSubject(
          afterItems.map(itemText).join(" "),
          removedSubject.replace(/\bday\s*\d+\b/i, ""),
        ));

  if (moved || added || removed) return movedApplied && addedApplied && removedApplied;
  return fact ?? true;
}

function hasBookingEvidence(request: ChatRequest, planned: TripPlan | undefined): boolean {
  return Boolean(
    request.plan?.brief.bookedStay ||
    planned?.brief.bookedStay ||
    USER_BOOKING_EVIDENCE.test(request.message),
  );
}

function hasFlightBookingEvidence(request: ChatRequest): boolean {
  return USER_FLIGHT_BOOKING_EVIDENCE.test(request.message);
}

/**
 * Names what a reply claims that the resulting plan or the traveller's own words do not show.
 * Returns undefined when the reply is grounded.
 */
export function ungroundedClaim(
  request: ChatRequest,
  planned: TripPlan | undefined,
  reply: string,
): string | undefined {
  if (FLIGHT_BOOKING_CLAIM.test(reply) && !hasFlightBookingEvidence(request))
    return "Nothing was booked or paid: the planner cannot book flights, it only shows fares.";
  if (BOOKING_CLAIM.test(reply) && !hasBookingEvidence(request, planned))
    return "Nothing was booked or reserved: the planner cannot make bookings.";
  if (INFORMATION_QUESTION.test(request.message.trim()) || !PLAN_SUCCESS_CLAIM.test(reply))
    return undefined;
  const resultingPlan = planned ?? request.plan;
  if (!resultingPlan) return undefined;
  if (request.plan && samePlan(request.plan, resultingPlan))
    return "The itinerary did not change in this turn: no stop, day, date or budget changed.";
  if (!requestedPlanChangeApplied(request, resultingPlan))
    return "The resulting itinerary does not show the change the traveller asked for.";
  return undefined;
}

function ungroundedFallback(request: ChatRequest): string {
  return request.interfaceLanguage === "zh"
    ? "我无法从更新后的行程确认这项修改已生效。"
    : "I can’t verify that requested change from the resulting itinerary.";
}

export function groundedReply(
  request: ChatRequest,
  planned: TripPlan | undefined,
  reply: string,
): string {
  return ungroundedClaim(request, planned, reply) ? ungroundedFallback(request) : reply;
}

/**
 * Asks the model to rewrite a reply whose claim the plan does not support, given the fact that
 * contradicts it. Falls back to the fixed sentence when the model fails or its rewrite still claims
 * something the plan does not show.
 */
export async function truthfulReply(
  model: BaseChatModel,
  request: ChatRequest,
  planned: TripPlan | undefined,
  reply: string,
  fact: string,
  fallback = ungroundedFallback(request),
): Promise<string> {
  try {
    const result = await model.invoke([
      [
        "system",
        "You are the trip planner replying to a traveller. Your draft reply claims something the trip does not show. " +
          "Rewrite it so every statement is true given the fact below: say plainly what did not happen, keep anything in the draft that is still true, " +
          "and offer the next step in one short sentence. Reply with the rewritten message only." +
          replyLanguageRule(replyLanguage(request.message, request.interfaceLanguage)),
      ],
      ["human", JSON.stringify({ travellerMessage: request.message, draftReply: reply, fact })],
    ]);
    const text = typeof result.content === "string" ? result.content.trim() : "";
    if (text && !ungroundedClaim(request, planned, text)) return text;
  } catch {
    return fallback;
  }
  return fallback;
}
