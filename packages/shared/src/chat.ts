import { z } from "zod";
import {
  AGENT_NAMES,
  BookedStay,
  FlightLeg,
  isTripDate,
  LegModeChoice,
  TravellerParty,
  TripBrief,
  TripPreferences,
} from "./contracts";
import { Currency } from "./money";
import { TripPlan } from "./plan";

export const PartialTripBrief = z.object({
  destination: z.string().trim().min(1).optional(),
  origin: z.string().trim().min(1).optional(),
  dates: z
    .tuple([
      z.string().refine(isTripDate, "Enter a real date"),
      z.string().refine(isTripDate, "Enter a real date"),
    ])
    .optional(),
  groupSize: z.number().int().positive().optional(),

  party: TravellerParty.optional(),
  budgetTotal: z.number().min(0.01).optional(),

  budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),

  displayCurrency: Currency.optional(),
  nationality: z.string().optional(),

  preferences: TripPreferences.optional(),

  learnedPreferences: TripPreferences.optional(),
  excludeFlights: z.boolean().optional(),

  legModes: z.array(LegModeChoice).max(12).optional(),
  bookedStay: BookedStay.optional(),
});
export type PartialTripBrief = z.infer<typeof PartialTripBrief>;

export const MAX_ATTACHMENTS_PER_MESSAGE = 4;

export const MAX_IMAGE_BASE64_LENGTH = 1_500_000;

export const MAX_TEXT_ATTACHMENT_BYTES = 32_768;
export const IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const TEXT_MEDIA_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
] as const;

export const ImageMediaType = z.enum(IMAGE_MEDIA_TYPES);
export type ImageMediaType = z.infer<typeof ImageMediaType>;
export const TextMediaType = z.enum(TEXT_MEDIA_TYPES);
export type TextMediaType = z.infer<typeof TextMediaType>;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const utf8Bytes = (value: string) => new TextEncoder().encode(value).length;

export const Attachment = z
  .object({
    name: z.string().trim().min(1).max(200),
    mediaType: z.string().trim().min(1),
    kind: z.enum(["image", "text"]),
    data: z.string().min(1),
  })
  .check((ctx) => {
    const { kind, mediaType, data } = ctx.value;
    const allowed = kind === "image" ? ImageMediaType : TextMediaType;
    if (!allowed.safeParse(mediaType).success) {
      ctx.issues.push({
        code: "custom",
        message: `${mediaType} is not an accepted ${kind} type`,
        input: ctx.value,
        path: ["mediaType"],
      });
    }
    if (kind === "image") {
      if (data.length > MAX_IMAGE_BASE64_LENGTH) {
        ctx.issues.push({
          code: "custom",
          message: `An image may carry at most ${MAX_IMAGE_BASE64_LENGTH} base64 characters`,
          input: ctx.value,
          path: ["data"],
        });
      } else if (!BASE64.test(data) || data.length % 4 !== 0) {
        ctx.issues.push({
          code: "custom",
          message: "An image's data must be base64 with no data: prefix",
          input: ctx.value,
          path: ["data"],
        });
      }
    } else if (utf8Bytes(data) > MAX_TEXT_ATTACHMENT_BYTES) {
      ctx.issues.push({
        code: "custom",
        message: `A text file may carry at most ${MAX_TEXT_ATTACHMENT_BYTES} bytes`,
        input: ctx.value,
        path: ["data"],
      });
    }
  });
export type Attachment = z.infer<typeof Attachment>;

export const COMMUNICATION_STYLES = ["neutral", "friendly", "concise", "detailed"] as const;
export const AssistantSettings = z.object({
  style: z.enum(COMMUNICATION_STYLES).default("neutral"),
  memory: z.boolean().default(true),
});
export type AssistantSettings = z.infer<typeof AssistantSettings>;

export const INTERFACE_LANGUAGES = ["en", "zh"] as const;
export const InterfaceLanguage = z.enum(INTERFACE_LANGUAGES);
export type InterfaceLanguage = z.infer<typeof InterfaceLanguage>;

export const ChatRequest = z
  .object({
    tripId: z.string(),

    message: z.string(),

    known: PartialTripBrief.optional(),

    brief: TripBrief.optional(),

    plan: TripPlan.optional(),

    mode: z.enum(["chat", "plan", "start"]).optional(),

    attachments: z.array(Attachment).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
    assistant: AssistantSettings.optional(),
    interfaceLanguage: InterfaceLanguage.optional(),

    displayCurrency: Currency.optional(),
  })
  .refine((request) => request.message.trim() !== "" || (request.attachments?.length ?? 0) > 0, {
    message: "Send a message or at least one attachment",
    path: ["message"],
  });
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatResponse = z.object({
  reply: z.string(),
  plan: TripPlan,
});
export type ChatResponse = z.infer<typeof ChatResponse>;

export const ChatNeedsInfo = z.object({
  type: z.literal("needs_info"),
  question: z.string(),
  known: PartialTripBrief,
});
export type ChatNeedsInfo = z.infer<typeof ChatNeedsInfo>;

export const ASK_USER_MAX_QUESTIONS = 4;
export const ASK_USER_MAX_OPTIONS = 4;

export const AskUserQuestionOption = z.object({
  label: z.string().trim().min(1),
  description: z.string().optional(),
});
export type AskUserQuestionOption = z.infer<typeof AskUserQuestionOption>;

export const AskUserQuestionItem = z.object({
  id: z.string().min(1),
  question: z.string().trim().min(1),
  header: z.string().optional(),
  detail: z.string().optional(),
  options: z.array(AskUserQuestionOption).max(ASK_USER_MAX_OPTIONS).optional(),
  multiSelect: z.boolean().optional(),
});
export type AskUserQuestionItem = z.infer<typeof AskUserQuestionItem>;

export const ChatAskUser = z.object({
  type: z.literal("ask_user"),
  questions: z.array(AskUserQuestionItem).min(1).max(ASK_USER_MAX_QUESTIONS),
  known: PartialTripBrief,
  plan: TripPlan.optional(),
  reply: z.string().optional(),
});
export type ChatAskUser = z.infer<typeof ChatAskUser>;

export const TOOL_RESULT_KINDS = [
  "attraction",
  "restaurant",
  "cafe",
  "nightlife",
  "shopping",
  "nature",
  "museum",
  "stay",
  "flight",
  "route",
  "drive",
  "transit",
  "walk",
  "weather",
  "place",
] as const;
export const ToolResultKind = z.enum(TOOL_RESULT_KINDS);
export type ToolResultKind = z.infer<typeof ToolResultKind>;

export const ToolResultRow = z.object({
  label: z.string().min(1),
  detail: z.string().optional(),
  kind: ToolResultKind.optional(),

  url: z.string().url().optional(),
});
export type ToolResultRow = z.infer<typeof ToolResultRow>;

export const ToolChoice = z.object({
  title: z.string().min(1),
  selected: ToolResultRow,
  rationale: z.string().optional(),
  alternatives: z.array(ToolResultRow).default([]),
});
export type ToolChoice = z.infer<typeof ToolChoice>;

export const FlightAnswerOption = z.object({
  carrier: z.string(),

  price: z.number().nonnegative(),
  note: z.string().optional(),
  stops: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),

  outbound: FlightLeg.optional(),

  inbound: FlightLeg.optional(),
  roundTrip: z.boolean().optional(),
});
export type FlightAnswerOption = z.infer<typeof FlightAnswerOption>;

export const FlightAnswer = z.object({
  type: z.literal("flight_answer"),
  reply: z.string(),
  from: z.string(),
  to: z.string(),
  depart: z.string(),
  return: z.string().optional(),
  passengers: z.number().int().positive(),

  options: z.array(FlightAnswerOption),

  source: z.object({ kind: z.string(), label: z.string(), freshness: z.string() }).optional(),
});
export type FlightAnswer = z.infer<typeof FlightAnswer>;

export const AgentProgressEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent_reasoning"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),

    episode: z.number().int().nonnegative().default(0),
    index: z.number().int().nonnegative(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("coordinator"),
    phase: z.enum(["dispatch", "conflicts", "revision", "assembly"]),
    round: z.number().int().positive(),
    summary: z.string(),
    constraints: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("agent_started"),
    summary: z.string().optional(),
    constraints: z.array(z.string()).optional(),

    objective: z.string().optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_completed"),
    summary: z.string().optional(),

    outcome: z.string().optional(),
    choice: ToolChoice.optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_failed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    error: z.string(),
  }),
  z.object({
    type: z.literal("tool_started"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    summary: z.string().min(1),

    args: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    type: z.literal("tool_completed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    resultSummary: z.string().min(1),
    resultCount: z.number().int().nonnegative().optional(),

    resultRows: z.array(ToolResultRow).optional(),

    resultTruncated: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("tool_failed"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    callId: z.string().min(1),
    tool: z.string().min(1),
    label: z.string().min(1),
    error: z.string().min(1),
  }),
]);

export const BOUNDED_RESULT_ROWS = 20;
export type AgentProgressEvent = z.infer<typeof AgentProgressEvent>;
