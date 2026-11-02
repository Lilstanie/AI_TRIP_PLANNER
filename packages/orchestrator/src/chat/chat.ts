import { createRoutedChatModel, replyLanguageRule } from "@trip/agents";
import { COORDINATOR_PROMPT } from "./coordinator-prompt";
import { reusedPlacesNote } from "./reused-places";
import { memory } from "@trip/services";
import {
  effectiveCurrency,
  estimateNote,
  formatMoney,
  ASK_USER_MAX_QUESTIONS,
  ChatTurn,
  Currency,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
  LASTING_PREFERENCE_KEYS,
  STAY_TYPES,
  TRIP_INTERESTS,
  type LastingPreference,
  TravelModes,
  PartialTripBrief as PartialTripBriefSchema,
  TripBrief as TripBriefSchema,
  toAud,
  partyPeople,
  type ChatRequest,
  type AgentName,
  type AssistantSettings,
  type InterfaceLanguage,
  type ChatResponse,
  type FlightAnswer,
  type AgentProgressEvent,
  type Attachment,
  type AskUserQuestionItem,
  type MemoryStore,
  type TravellerParty,
  type TripBrief,
  type TripPlan,
} from "@trip/shared";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { createAgent, tool } from "langchain";
import { z } from "zod/v4";
import { localCalendarDate } from "@trip/tools";
import { BriefPatchSchema, ISO_DATE, type BriefPatch } from "../brief/brief";
import { count, intentFrom, lastingPreferencesFrom, text } from "../brief/brief-update-fields";
import { COORDINATOR_REASONING_EPISODE, createReasoningSink } from "../planning/reasoning-sink";
import { extractBriefPatchLocally } from "./chat-offline";
import {
  BriefIntake,
  AskUserError,
  IncompleteBriefError,
  locationForBrief,
  missingFields,
} from "../brief/brief-intake";
export { AskUserError, IncompleteBriefError } from "../brief/brief-intake";
export { AskUserQuestionInput, toQuestions } from "./chat-ask-user";
export { FlightAnswerReady } from "./chat-flight-search";
import { ASK_USER_DESCRIPTION, AskUserQuestionInput, toQuestions } from "./chat-ask-user";
import { createFlightSearchTool, FlightAnswerReady, type FlightSearch } from "./chat-flight-search";
import { judgeHandoff } from "./mention-handoff";
import { stopChanges } from "./stop-changes";
import { ROLE_NAMES } from "../planning/progress-copy";
import { truthfulReply, unchangedPlanReply, ungroundedClaim } from "./chat-grounding";
import { isInfeasible } from "../planning/conflicts";
import { budgetText, costLine } from "./cost-line";
import type { WorkflowDecision } from "../planning/decisions";
import { runOrchestrator, type OrchestratorOptions } from "../planning/workflow";
import { replyLanguage } from "../reply-language";

export interface BriefExtractor {
  extract(message: string, current: TripBrief | undefined): Promise<BriefPatch>;
}

export interface TripChatOptions extends OrchestratorOptions {
  model?: BaseChatModel;

  flightSearch?: FlightSearch;

  extractor?: BriefExtractor;

  accountMemory?: boolean;

  clock?: () => Date;
}

export const BriefUpdate = z.object({
  destination: z
    .string()
    .nullish()
    .describe(
      'the city they are travelling to. For a trip across several cities, join them with " & " in the order they are visited ("Sydney & Wollongong"), never with a word such as "and".',
    ),
  origin: z.string().nullish().describe("the city they are travelling from, if they said one"),
  startDate: z.string().nullish().describe("YYYY-MM-DD"),
  endDate: z.string().nullish().describe("YYYY-MM-DD"),
  tripDays: z
    .union([z.number(), z.string()])
    .nullish()
    .describe(
      'how many days the traveller said the trip lasts, in any wording ("3 days", "五日游", "a week"), adding up the days of each city; leave it out when they gave a date range or a start offset such as "leaving in 3 days". The end date is counted from it.',
    ),
  groupSize: z.union([z.number(), z.string()]).nullish(),
  party: z
    .object({
      adults: z.union([z.number(), z.string()]).nullish(),
      children: z.union([z.number(), z.string()]).nullish(),
      infants: z.union([z.number(), z.string()]).nullish(),
      seniors: z.union([z.number(), z.string()]).nullish(),
      pets: z.union([z.number(), z.string()]).nullish(),
    })
    .nullish()
    .describe(
      'who is travelling, whenever they say more than a total ("1 adult and 1 child", "两大一小", "my wife, our baby and the dog"). Count every person in exactly one of adults, children, infants and seniors; pets are not people and are not in groupSize. Send the whole breakdown, using 0 for a kind nobody is.',
    ),
  budgetAmount: z.union([z.number(), z.string()]).nullish().describe("the number they said"),
  budgetCurrency: z.string().nullish().describe("AUD, CNY, USD or JPY, as they said it"),
  displayCurrency: z
    .string()
    .nullish()
    .describe(
      'AUD, CNY, USD or JPY, when the traveller names a currency to read the trip in, with or without a budget ("show it in yen", "用人民币给我算"). Never guess it from their language or the destination.',
    ),
  nationality: z.string().nullish(),
  learnedPreferences: z
    .array(z.string())
    .nullish()
    .describe(
      "The whole list of trip preferences learned from this conversation, replacing the previous one: short phrases, written in the same language as the traveller's own message, for lasting wishes they stated (diet, pace, what to avoid). Leave out anything already in knownSoFar.preferences.",
    ),
  pace: z
    .string()
    .nullish()
    .describe(
      'relaxed, balanced or packed: how full the traveller wants each day, judged from what they said in any language or wording ("特种兵", "排满", "see as much as possible" are packed; "慢慢玩", "take it easy" are relaxed) and from knownSoFar.preferences. Leave it out when they gave no sign.',
    ),
  dietary: z
    .array(z.string())
    .nullish()
    .describe(
      'The whole list of food needs for this trip as short English phrases ("vegetarian", "no pork", "peanut allergy", "gluten free"), translated from any language, keeping entries from knownSoFar.intent.dietary unless they changed. Pass [] when they say they have none.',
    ),
  interests: z
    .array(z.string())
    .nullish()
    .describe(
      `The whole list of what the traveller wants to see, from: ${TRIP_INTERESTS.join(", ")}. Map their words in any language to these names and keep entries from knownSoFar.intent.interests unless they changed.`,
    ),
  stayMinRating: z
    .union([z.number(), z.string()])
    .nullish()
    .describe(
      "the lowest guest rating out of 10 the traveller will accept for a stay, when they state one",
    ),
  stayFreeCancellation: z
    .boolean()
    .nullish()
    .describe("true when the traveller requires a stay with free cancellation"),
  stayType: z
    .string()
    .nullish()
    .describe(`the kind of stay the traveller insists on, one of: ${STAY_TYPES.join(", ")}`),
  rememberForAccount: z
    .array(
      z.object({
        key: z.enum(LASTING_PREFERENCE_KEYS),
        value: z.string(),
      }),
    )
    .nullish()
    .describe(
      'Preferences the traveller says hold for every trip, not just this one ("I always travel packed", "我们一直吃素", "we always fly from Sydney"): key pace (value relaxed, balanced or packed), dietary, interests, accessibility or departure_city, value in short English. Never pass a wish for this trip only ("这次想轻松点").',
    ),
  excludeFlights: z
    .boolean()
    .nullish()
    .describe(
      "true when the traveller says they arrange flights themselves or flights are not needed; false if they ask to include flights again",
    ),
  travelModeChoices: z
    .array(
      z.object({
        from: z.string().describe("the place the hop starts at, as the trip names it"),
        to: z.string().describe("the place the hop ends at, as the trip names it"),
        mode: z.enum(TravelModes).describe("how the traveller wants to make that hop"),
      }),
    )
    .nullish()
    .describe(
      "The whole list of per-hop travel choices the traveller has stated, replacing the previous one: only hops between the trip's own cities, or its origin and first city. Keep earlier entries from knownSoFar.legModes unless they changed, and leave an entry out when the traveller takes that choice back.",
    ),
  nightsPerCity: z
    .array(
      z.object({
        city: z.string().describe("one of the trip's own cities, as the trip names it"),
        nights: z.number().int().positive().describe("how many nights the traveller wants there"),
      }),
    )
    .nullish()
    .describe(
      "The whole list of nights the traveller wants in particular cities of a multi-city trip, replacing the previous one. Keep earlier entries from knownSoFar.cityNights unless they changed; cities left out share the remaining nights.",
    ),
  noAccommodation: z
    .boolean()
    .nullish()
    .describe(
      "True only when the traveller needs no accommodation; false when they want accommodation again. Separate from an already booked stay.",
    ),
  bookedStayName: z
    .string()
    .nullish()
    .describe("the hotel or stay the traveller says they have already booked"),
  bookedStayNote: z.string().nullish().describe("anything they said about that booking, briefly"),
});

const PARTY_KEYS = ["adults", "children", "infants", "seniors", "pets"] as const;

function partyFrom(value: unknown): TravellerParty | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const counts = PARTY_KEYS.map((key) => {
    const raw = source[key];
    const parsed = typeof raw === "number" ? raw : Number(text(raw));
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 99 ? parsed : undefined;
  });
  if (counts.every((entry) => entry === undefined)) return undefined;
  const party = Object.fromEntries(
    PARTY_KEYS.map((key, index) => [key, counts[index] ?? 0]),
  ) as TravellerParty;
  return partyPeople(party) > 0 ? party : undefined;
}

const isoDate = (value: unknown) => {
  const found = text(value);
  return found && ISO_DATE.test(found) ? found : undefined;
};

function toPatch(update: z.infer<typeof BriefUpdate>): BriefPatch {
  const startDate = isoDate(update.startDate);
  const endDate = isoDate(update.endDate);
  const groupSize = count(update.groupSize);
  const party = partyFrom(update.party);

  const learned = Array.isArray(update.learnedPreferences)
    ? [
        ...new Set(
          update.learnedPreferences
            .map((item) => text(item)?.slice(0, MAX_TRIP_PREFERENCE_LENGTH))
            .filter((item): item is string => Boolean(item)),
        ),
      ].slice(0, MAX_TRIP_PREFERENCES)
    : undefined;
  const patch: BriefPatch = BriefPatchSchema.parse({
    ...(text(update.destination) ? { destination: text(update.destination) } : {}),
    ...(text(update.origin) ? { origin: text(update.origin) } : {}),
    ...(text(update.nationality) ? { nationality: text(update.nationality) } : {}),
    ...(groupSize !== undefined ? { groupSize: Math.round(groupSize) } : {}),
    ...(party ? { party } : {}),

    ...(startDate ? { dateStart: startDate } : {}),
    ...(endDate ? { dateEnd: endDate } : {}),
    ...(learned ? { learnedPreferences: learned } : {}),
    ...(intentFrom(update) ? { intent: intentFrom(update) } : {}),
    ...(typeof update.excludeFlights === "boolean"
      ? { excludeFlights: update.excludeFlights }
      : {}),

    ...(update.travelModeChoices
      ? {
          legModes: update.travelModeChoices
            .flatMap((choice) => {
              const from = text(choice.from);
              const to = text(choice.to);
              return from && to ? [{ from, to, mode: choice.mode }] : [];
            })
            .slice(0, 12),
        }
      : {}),
    ...(update.nightsPerCity
      ? {
          cityNights: update.nightsPerCity
            .flatMap((entry) => {
              const city = text(entry.city);
              return city && Number.isInteger(entry.nights) && entry.nights > 0
                ? [{ city, nights: entry.nights }]
                : [];
            })
            .slice(0, 12),
        }
      : {}),
    ...(typeof update.noAccommodation === "boolean"
      ? { noAccommodation: update.noAccommodation }
      : {}),
    ...(text(update.bookedStayName)
      ? {
          bookedStay: {
            name: text(update.bookedStayName)!.slice(0, 160),
            ...(text(update.bookedStayNote)
              ? { note: text(update.bookedStayNote)!.slice(0, 300) }
              : {}),
          },
        }
      : {}),
  });
  const budgetAmount = count(update.budgetAmount);
  if (budgetAmount !== undefined) {
    const named = Currency.safeParse(text(update.budgetCurrency)?.toUpperCase());
    const currency = named.success ? named.data : "AUD";
    patch.budgetTotal = toAud(budgetAmount, currency);
    if (currency !== "AUD") patch.budgetSource = { amount: budgetAmount, currency };
  }

  const display = Currency.safeParse(text(update.displayCurrency)?.toUpperCase());
  const budgetNamed = Currency.safeParse(text(update.budgetCurrency)?.toUpperCase());
  const named = display.success ? display.data : budgetNamed.success ? budgetNamed.data : undefined;
  if (named) patch.displayCurrency = named;
  return patch;
}

function replyCurrency(request: ChatRequest, brief: TripBrief): Currency {
  return effectiveCurrency(brief, request.displayCurrency ?? "AUD");
}

function reusedActivityPlaces(
  activities: Array<{ day?: number; location?: string }>,
): Array<{ location: string; days: number[] }> {
  const daysByPlace = new Map<string, { location: string; days: Set<number> }>();
  for (const activity of activities) {
    if (!activity.location || activity.day === undefined) continue;
    const key = activity.location.toLocaleLowerCase();
    const entry = daysByPlace.get(key) ?? { location: activity.location, days: new Set<number>() };
    entry.days.add(activity.day);
    daysByPlace.set(key, entry);
  }
  return Array.from(daysByPlace.values())
    .filter(({ days }) => days.size > 1)
    .map(({ location, days }) => ({ location, days: Array.from(days) }));
}

function unknownActivityCount(activities: Array<{ estCost?: number }>): number {
  return activities.filter((activity) => activity.estCost === undefined).length;
}

function planDigest(plan: TripPlan, currency: Currency, amounts = true) {
  const money = (amount: number) => formatMoney(amount, currency);
  const items = plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  const activities = items.map((item) => ({
    ...(item.day === undefined ? {} : { day: item.day }),
    ...(item.location ? { location: item.location } : {}),
    price: item.estCost === undefined ? "unknown" : amounts ? money(item.estCost) : "priced",
  }));
  return {
    round: plan.round,
    ...(amounts
      ? {
          currency,
          estimatedTotal: money(plan.estTotal),
          budgetTotal: budgetText(plan, currency),
          budgetHeadroom: money(plan.budgetTotal - plan.estTotal),
          overrunPct: plan.overrunPct,
          ...(estimateNote(currency) ? { amountsNote: estimateNote(currency) } : {}),
        }
      : {}),
    unknownActivityCount: unknownActivityCount(items),
    activities,
    reusedActivityPlaces: reusedActivityPlaces(activities),
    sections: plan.sections.map((section) => ({
      label: section.label,
      status: section.status,
      summary: section.summary,
      ...(amounts ? { estimatedCost: money(section.estCost) } : {}),
    })),

    unresolved: (plan.conflicts ?? []).map((conflict) => ({
      section: conflict.targetAgent,
      problem: conflict.reason,
      whatWouldFixIt: conflict.constraints,
    })),
  };
}

function fallbackReplyFor(plan: TripPlan, currency: Currency, language: InterfaceLanguage): string {
  const itineraryItems =
    plan.sections.find((section) => section.id === "itinerary")?.proposal?.items ?? [];
  const reusedNote = reusedPlacesNote(reusedActivityPlaces(itineraryItems), language);
  const summaries = plan.conflicts?.some(isInfeasible)
    ? []
    : plan.sections
        .map((section) => section.summary.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((summary) => asSentence(summary, language));
  return [...summaries, costLine(plan, currency, language), reusedNote]
    .filter(Boolean)
    .join(language === "zh" ? "" : " ");
}

function asSentence(text: string, language: InterfaceLanguage): string {
  if (/[.!?。！？]$/.test(text)) return text;
  return `${text}${language === "zh" ? "。" : "."}`;
}

function plannedReply(request: ChatRequest, plan: TripPlan, reply: string): string {
  const language = turnLanguage(request);
  const currency = replyCurrency(request, plan.brief);
  if (!reply) return fallbackReplyFor(plan, currency, language);
  return [reply, costLine(plan, currency, language)].join(language === "zh" ? "" : " ");
}

function lastMessageText(result: unknown): string {
  const messages = (result as { messages?: { content?: unknown }[] })?.messages ?? [];
  const content = messages.at(-1)?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content))
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String((part as { text: unknown }).text)
            : "",
      )
      .join("")
      .trim();
  return "";
}

function inlineTextAttachments(attachments: Attachment[] | undefined): string {
  const files = (attachments ?? []).filter((attachment) => attachment.kind === "text");
  return files
    .map(
      (file) =>
        `\n\n--- attached file: ${file.name} (${file.mediaType}) ---\n${file.data}\n--- end of ${file.name} ---`,
    )
    .join("");
}

function imageContentBlocks(attachments: Attachment[] | undefined) {
  return (attachments ?? [])
    .filter((attachment) => attachment.kind === "image")
    .map((attachment) => ({
      type: "image_url" as const,
      image_url: { url: `data:${attachment.mediaType};base64,${attachment.data}` },
    }));
}

export async function runTripChat(
  request: ChatRequest,
  options: TripChatOptions = {},
): Promise<ChatResponse> {
  const {
    model,
    extractor,
    clock = () => new Date(),
    accountMemory = true,
    flightSearch,
    ...orchestrationOptions
  } = options;
  if (request.mode === "plan" && !request.brief) throw new Error("A brief is required to plan.");
  const mem: MemoryStore = orchestrationOptions.mem ?? memory;
  const orchestrate = (brief: TripBrief, mention?: OrchestratorOptions["mention"]) =>
    runOrchestrator(brief, {
      ...(mention ? { mention } : {}),
      ...(request.displayCurrency ? { displayCurrency: request.displayCurrency } : {}),
      ...(request.interfaceLanguage ? { interfaceLanguage: request.interfaceLanguage } : {}),
      replyLanguage: replyLanguage(request.message, request.interfaceLanguage),
      ...(orchestrationOptions.onProgress
        ? {
            onDecision: (decision: WorkflowDecision) =>
              orchestrationOptions.onProgress?.({
                type: "decision",
                round: decision.round,
                decision,
              }),
          }
        : {}),
      ...orchestrationOptions,
      mem,
    });
  if (request.history?.length && (await mem.getShortTerm(request.tripId)).length === 0)
    for (const turn of request.history)
      await mem.appendShortTerm(request.tripId, ChatTurn.parse(turn));
  await mem.appendShortTerm(
    request.tripId,
    ChatTurn.parse({ role: "user", content: request.message }),
  );
  const remember = async (
    reply: string,
    pendingBriefConfirmation?: ChatTurn["pendingBriefConfirmation"],
  ) =>
    mem.appendShortTerm(
      request.tripId,
      ChatTurn.parse({
        role: "assistant",
        content: reply,
        pendingBriefConfirmation,
        confirmedBriefDestination: intake.confirmedDestination,
      }),
    );

  const history = (await mem.getShortTerm(request.tripId)).slice(0, -1);
  const intake = new BriefIntake(request, history, clock);

  let mentions = [...new Set(request.mentions ?? [])];
  if (mentions.length === 1 && request.mode !== "plan") {
    const from = mentions[0]!;
    const handoff = await judgeHandoff(request.message, from, model);
    if (handoff) {
      orchestrationOptions.onProgress?.({
        type: "decision",
        round: 1,
        decision: {
          type: "mention_handoff",
          round: 1,
          from,
          to: handoff.to,
          decidedBy: handoff.decidedBy,
        },
      });
      mentions = [handoff.to];
    }
  }
  if (mentions.length > 0 && request.mode !== "plan") {
    if (request.plan) {
      const brief = TripBriefSchema.parse({
        ...(request.brief ?? request.plan.brief),
        tripId: request.tripId,
      });
      const plan = await orchestrate(brief, {
        agents: mentions,
        message: request.message,
        plan: request.plan,
      });
      const reply = mentionReply(request, plan, mentions);
      await remember(reply);
      return { reply, plan, assistant: mentions[0]! };
    }
    const known = BriefPatchSchema.parse(intake.known);
    const answer = await mentionAnswer(request, mentions[0]!, model);
    const reply = `${answer}\n\n${briefAsk(request, missingFields(known, request.tripId))}`;
    await remember(reply);
    throw new IncompleteBriefError([], known, reply, mentions[0]);
  }

  try {
    let result: ChatResponse;
    if (request.mode === "plan") {
      const plan = await orchestrate(intake.requireReady());
      result = {
        reply:
          unchangedPlanReply(request, plan) ??
          fallbackReplyFor(plan, replyCurrency(request, plan.brief), turnLanguage(request)),
        plan,
      };
    } else {
      const chatModel = model ?? createRoutedChatModel("itinerary", { thinking: true });
      result = chatModel
        ? await runConversationAgent(
            request,
            chatModel,
            intake,
            mem,
            orchestrate,
            orchestrationOptions.onProgress,
            clock,
            accountMemory,
            flightSearch,
          )
        : await runOffline(request, intake, extractor, orchestrate);
    }
    await remember(result.reply);
    return result;
  } catch (error) {
    const asked = turnEndingReply(error);
    if (asked)
      await remember(
        asked,
        error instanceof AskUserError ? error.pendingBriefConfirmation : undefined,
      );
    throw error;
  }
}

const ZH_FIELD_LABELS: Record<string, string> = {
  destination: "目的地",
  "start and end dates": "起止日期",
  "number of travellers": "出行人数",
  "total budget": "总预算",
};

function turnLanguage(request: ChatRequest): InterfaceLanguage {
  return replyLanguage(request.message, request.interfaceLanguage);
}

function mentionReply(request: ChatRequest, plan: TripPlan, mentions: AgentName[]): string {
  const language = turnLanguage(request);
  const currency = replyCurrency(request, plan.brief);
  const summaries = plan.sections
    .filter((section) => mentions.includes(section.id as AgentName))
    .map((section) => section.summary.trim())
    .filter(Boolean)
    .join(" ");
  return [summaries, costLine(plan, currency, language)]
    .filter(Boolean)
    .join(language === "zh" ? "" : " ");
}

function briefAsk(request: ChatRequest, missing: string[]): string {
  const fields = missing.length
    ? missing
    : ["destination", "start and end dates", "number of travellers", "total budget"];
  return turnLanguage(request) === "zh"
    ? `协调员会先收集行程信息：请告诉我${fields.map((field) => ZH_FIELD_LABELS[field] ?? field).join("、")}。`
    : `The Coordinator will collect the trip details first: please tell me the ${fields.join(", ")}.`;
}

async function mentionAnswer(
  request: ChatRequest,
  agent: AgentName,
  model: BaseChatModel | undefined,
): Promise<string> {
  const language = turnLanguage(request);
  const role = ROLE_NAMES[language][agent];
  const fallback =
    language === "zh"
      ? `我是${role}专家。有了行程方案后我才能处理这个请求，在此之前不会改动任何内容。`
      : `I'm the ${ROLE_NAMES.en[agent]} specialist. I can act on this once there is a plan, and I will not change anything before then.`;
  if (!model) return fallback;
  try {
    const result = await model.invoke([
      [
        "system",
        `You are the ${ROLE_NAMES.en[agent]} specialist of a trip planner. Answer the traveller's question briefly from general travel knowledge in at most three sentences. Do not plan the trip, never claim live prices or availability, and write in ${language === "zh" ? "Chinese" : "English"}.`,
      ],
      ["human", request.message],
    ]);
    const text = typeof result.content === "string" ? result.content.trim() : "";
    return text || fallback;
  } catch {
    return fallback;
  }
}

const STYLE_TEXT: Record<AssistantSettings["style"], string> = {
  neutral: "",
  friendly: "Write warmly and conversationally, like a friend who knows the place.",
  concise: "Keep replies short: the answer first, at most three sentences or a short list.",
  detailed:
    "Give fuller replies: explain the reasoning, timings and trade-offs behind each suggestion.",
};

const NO_ACCOUNT_MEMORY_RULE =
  "\n\nThe traveller's account memory is not available in this session: never pass rememberForAccount, and never say a preference was saved or will be remembered for future trips. When they ask you to remember one, say it applies to this trip and that it can be saved once they sign in.";

function styleRule(assistant: AssistantSettings | undefined): string {
  const text = assistant ? STYLE_TEXT[assistant.style] : "";
  const memory =
    assistant?.memory === false
      ? " The traveller turned memory off: never pass learnedPreferences."
      : "";
  return text || memory ? `\n\nCommunication style: ${text}${memory}` : "";
}

function turnEndingReply(error: unknown): string | undefined {
  if (error instanceof AskUserError) {
    const { reply, questions } = error.askUser;
    const asked = questions
      .map((item) => {
        const options = item.options?.map((option) => option.label).join(" / ");
        return options ? `${item.question} (${options})` : item.question;
      })
      .join("\n");
    return [reply?.trim(), asked].filter(Boolean).join("\n");
  }
  if (error instanceof IncompleteBriefError) return error.message;
  if (error instanceof FlightAnswerReady) return error.answer.reply;
  return undefined;
}

async function runConversationAgent(
  request: ChatRequest,
  model: BaseChatModel,
  intake: BriefIntake,
  mem: MemoryStore,
  orchestrate: (brief: TripBrief, mention?: OrchestratorOptions["mention"]) => Promise<TripPlan>,
  onProgress?: (event: AgentProgressEvent) => void,
  clock: () => Date = () => new Date(),
  accountMemory = true,
  flightSearch?: FlightSearch,
): Promise<ChatResponse> {
  let planned: TripPlan | undefined;
  let flightAnswer: FlightAnswer | undefined;
  let lasting: LastingPreference[] | undefined;

  let asked: AskUserQuestionItem[] = [];
  let blockingAsk: AskUserError | undefined;

  const reasoning = createReasoningSink(1, onProgress, COORDINATOR_REASONING_EPISODE);
  const streamingModel = onProgress ? reasoning.wrap(model) : model;

  const updateTripBrief = tool(
    async (update: z.infer<typeof BriefUpdate>) => {
      const tripDays = count(update.tripDays);
      intake.update(toPatch(update), request.message + inlineTextAttachments(request.attachments), {
        fromModel: true,
        ...(tripDays !== undefined && Number.isInteger(tripDays) ? { tripDays } : {}),
      });
      const remembered =
        request.assistant?.memory === false || !accountMemory
          ? undefined
          : lastingPreferencesFrom(update);
      if (remembered?.length) lasting = remembered;
      planned = undefined;
      blockingAsk = undefined;
      return { brief: intake.known };
    },
    {
      name: "update_trip_brief",
      description:
        "Record trip facts the traveller just stated: destination, dates, number of travellers, budget, nationality, lasting preferences learned in chat, that they arrange flights themselves, or a stay they already booked. Only pass fields their messages actually gave.",
      schema: BriefUpdate,
    },
  );

  const replanTrip = tool(
    async () => {
      let brief: TripBrief;
      try {
        brief = intake.requireReady();
      } catch (error) {
        if (error instanceof AskUserError) {
          blockingAsk = error;
          return { ok: false as const, questions: error.askUser.questions };
        }
        if (error instanceof IncompleteBriefError)
          return { ok: false as const, missing: error.missing };
        throw error;
      }
      planned = await orchestrate(brief);
      return {
        ok: true as const,
        plan: planDigest(planned, replyCurrency(request, planned.brief), false),
      };
    },
    {
      name: "replan_trip",
      description:
        "Produce or update the trip plan from what is known. Call this after recording a change that affects the plan, or when the traveller asks for a plan. Returns the fields still missing when there is not enough to plan yet.",
      schema: z.object({}),
    },
  );

  const changeItinerary = tool(
    async ({ change, days, places }: { change: string; days?: number[]; places?: string[] }) => {
      if (!request.plan)
        return { ok: false as const, reason: "There is no plan yet: call replan_trip instead." };
      const brief = TripBriefSchema.parse({ ...intake.known, tripId: request.tripId });
      planned = await orchestrate(brief, {
        agents: ["itinerary"],
        message: change,
        plan: request.plan,
        ...(days?.length ? { days } : {}),
        ...(places?.length ? { places: places.map((place) => place.trim()).filter(Boolean) } : {}),
      });
      const changes = stopChanges(request.plan, planned);
      return {
        ok: true as const,
        ...changes,
        ...(changes.added.length || changes.removed.length
          ? {}
          : { note: "No stop changed. Tell the traveller plainly that the change was not made." }),
        plan: planDigest(planned, replyCurrency(request, planned.brief), false),
      };
    },
    {
      name: "change_itinerary",
      description:
        "Change specific stops of the current plan: replace, remove, add, move or retime a stop, or rework one day. Pass the exact change in English with day, time and place names as the plan shows them. Only the itinerary is redrafted; the other stops, the stay and flights are kept. Returns the stops removed and added.",
      schema: z.object({
        places: z
          .array(z.string())
          .max(8)
          .optional()
          .describe(
            "names of places the change adds that the plan does not have yet, in English, e.g. Tegallalang Rice Terrace; they are searched before the itinerary is redrafted",
          ),
        change: z
          .string()
          .describe(
            'the change, e.g. "On day 3 replace 五十稲荷神社 at 14:30 with 浅草寺 at the same time; keep every other stop unchanged"',
          ),
        days: z
          .array(z.number().int().positive())
          .max(31)
          .optional()
          .describe(
            "the trip days this change touches; every other day keeps its stops. Leave out only when the change is about the whole trip",
          ),
      }),
    },
  );

  const askUserQuestion = tool(
    async (input: z.infer<typeof AskUserQuestionInput>) => {
      const questions = toQuestions(input);
      if (!questions.length)
        return "No question was shown: every question needs text. Ask again or answer without asking.";
      asked = [...asked, ...questions].slice(0, ASK_USER_MAX_QUESTIONS);
      return "The question is now shown to the traveller, who will answer in their next message. End your turn now without calling any more tools, and do not repeat the question.";
    },
    {
      name: "ask_user_question",
      description: ASK_USER_DESCRIPTION,
      schema: AskUserQuestionInput,
    },
  );

  const history = (await mem.getShortTerm(request.tripId)).slice(-9, -1);
  const agent = createAgent({
    name: "trip_conversation",
    model: streamingModel,
    tools: [
      updateTripBrief,
      replanTrip,
      changeItinerary,
      askUserQuestion,
      ...(flightSearch
        ? [
            createFlightSearchTool(flightSearch, {
              groupSize: () => intake.known.groupSize,
              language: turnLanguage(request),
              onAnswer: (answer) => {
                flightAnswer = answer;
              },
            }),
          ]
        : []),
    ],
    systemPrompt:
      COORDINATOR_PROMPT +
      styleRule(request.assistant) +
      (accountMemory ? "" : NO_ACCOUNT_MEMORY_RULE) +
      replyLanguageRule(replyLanguage(request.message, request.interfaceLanguage)),
  });

  const envelope = JSON.stringify({
    message: request.message + inlineTextAttachments(request.attachments),
    today: localCalendarDate(clock(), locationForBrief(request, intake.known)),
    knownSoFar: intake.known,
    currentPlan: request.plan
      ? planDigest(request.plan, replyCurrency(request, request.plan.brief))
      : undefined,
  });
  const images = imageContentBlocks(request.attachments);
  const invoked = await agent.invoke({
    messages: [
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      new HumanMessage({
        content: images.length ? [{ type: "text", text: envelope }, ...images] : envelope,
      }),
    ],
  });
  const reply = lastMessageText(invoked);
  reasoning.flush();
  const done = (response: ChatResponse): ChatResponse =>
    lasting ? { ...response, lastingPreferences: lasting } : response;

  const checked = async (resulting: TripPlan | undefined, fallback?: string): Promise<string> => {
    const fact = reply ? ungroundedClaim(request, resulting, reply) : undefined;
    return fact ? truthfulReply(model, request, resulting, reply, fact, fallback) : reply;
  };

  const noChangeReply = planned ? unchangedPlanReply(request, planned) : undefined;
  if (planned && noChangeReply)
    return done({
      reply: reply ? await checked(planned, noChangeReply) : noChangeReply,
      plan: planned,
    });

  if (planned)
    return done({
      reply: plannedReply(request, planned, await checked(planned)),
      plan: planned,
    });

  if (flightAnswer) throw new FlightAnswerReady(flightAnswer);

  if (blockingAsk) throw blockingAsk;

  if (asked.length) {
    const understood = PartialTripBriefSchema.safeParse(intake.known);
    throw new AskUserError({
      type: "ask_user",
      questions: asked,
      known: understood.success ? understood.data : {},
      ...(request.plan ? { plan: request.plan } : {}),
      ...(reply ? { reply: request.plan ? await checked(undefined) : reply } : {}),
    });
  }

  if (request.plan)
    return done({
      reply: reply ? await checked(request.plan) : "",
      plan: request.plan,
    });

  const plan = await orchestrate(intake.requireReady(reply || undefined));
  return done({ reply: plannedReply(request, plan, await checked(plan)), plan });
}

const OFFLINE_NO_CHANGE: Record<InterfaceLanguage, string> = {
  en: "Without the AI planner, chat can only change the destination, dates, travellers or budget. Edit stops directly in the trip.",
  zh: "当前没有 AI 规划，聊天里只能修改目的地、日期、人数或预算。地点请直接在行程里编辑。",
};

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sorted(item)]),
  );
}

function sameBrief(left: TripBrief, right: TripBrief): boolean {
  const material = (brief: TripBrief) => sorted({ ...brief, tripId: undefined, userId: undefined });
  return JSON.stringify(material(left)) === JSON.stringify(material(right));
}

async function runOffline(
  request: ChatRequest,
  intake: BriefIntake,
  extractor: BriefExtractor | undefined,
  orchestrate: (brief: TripBrief) => Promise<TripPlan>,
): Promise<ChatResponse> {
  const message = request.message + inlineTextAttachments(request.attachments);
  const patch = extractor
    ? await extractor.extract(message, request.brief)
    : extractBriefPatchLocally(message, intake.known.groupSize);
  intake.update(patch, message, { fromModel: Boolean(extractor) });
  const brief = intake.requireReady();
  if (request.plan && sameBrief(brief, request.plan.brief))
    return { reply: OFFLINE_NO_CHANGE[turnLanguage(request)], plan: request.plan };
  const plan = await orchestrate(brief);
  return {
    reply:
      unchangedPlanReply(request, plan) ??
      fallbackReplyFor(plan, replyCurrency(request, plan.brief), turnLanguage(request)),
    plan,
  };
}
