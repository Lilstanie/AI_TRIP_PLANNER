import { z } from "zod";
import { AGENT_NAMES, FlightLeg, isTripDate, TripBrief } from "./contracts";
import { Currency } from "./money";
import { TripPlan } from "./plan";

// The contract between the web client and POST /api/chat.
// Progress is streamed as NDJSON; the final frame contains one ChatResponse.
// Optional request modes preserve existing chat clients.

// What a blank conversation has stated so far, before it is complete enough to plan.
// The fields are restated rather than picked from TripBrief: TripBrief's whole-brief check (an end
// date after the start, a night per destination) cannot run on a brief that is still being built.
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
  budgetTotal: z.number().min(0.01).optional(), // always BASE_CURRENCY; see ./money
  // Travels with `budgetTotal` so a half-built brief can still explain the
  // conversion it came from. See TripBrief.budgetSource.
  budgetSource: z.object({ amount: z.number().positive(), currency: Currency }).optional(),
  nationality: z.string().optional(),
});
export type PartialTripBrief = z.infer<typeof PartialTripBrief>;

/**
 * What the traveller may attach to one chat message.
 *
 * The limits are deliberately small and are enforced here, at the schema boundary, so a malformed
 * or oversized attachment is a 400 from the API rather than a provider error deeper in the turn.
 */
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
/** Length of an image's base64 payload, i.e. roughly 1.1 MB of original file. */
export const MAX_IMAGE_BASE64_LENGTH = 1_500_000;
/** UTF-8 bytes of a text attachment's contents. */
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

/**
 * One file the traveller attached. `data` carries the file's contents, and what is in it follows
 * from `kind` and from nothing else:
 *
 * - `kind: "image"` — standard base64 of the raw bytes, with no `data:` prefix and no whitespace.
 *   The orchestrator builds the data URL from `mediaType` and `data`, so a client that sent one
 *   would have it doubled.
 * - `kind: "text"` — the decoded UTF-8 text itself, not base64. The coordinator reads it inline, and
 *   base64 here would reach the model as an unreadable blob.
 *
 * `mediaType` must belong to the allow-list for that kind: only formats the coordinator model can
 * actually read reach a provider.
 */
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

// Client -> server
export const ChatRequest = z
  .object({
    tripId: z.string(),
    // Empty only when the turn carries attachments: a picture of a hotel
    // confirmation is a message, and asking the traveller to caption it before
    // it can be sent is a rule the app has no reason to have.
    message: z.string(),
    // What earlier turns of a blank conversation already stated. The server merges
    // this turn's message onto it, so the traveller answers a follow-up question
    // instead of repeating everything.
    known: PartialTripBrief.optional(),
    // Optional for backward compatibility. The browser sends the latest brief so
    // serverless requests can apply incremental edits without sticky process state.
    brief: TripBrief.optional(),
    // The plan those edits apply to. The server is stateless, so a message that
    // only asks a question has no plan to return unless the client supplies the
    // current one — and every completed response must carry a plan.
    plan: TripPlan.optional(),
    // "start" begins a blank conversation: the brief is extracted only from the
    // message, and missing required fields are reported instead of defaulted.
    mode: z.enum(["chat", "plan", "start"]).optional(),
    // Files the traveller attached to this message. Images reach the coordinator
    // as image content blocks and text files are inlined into its message; only
    // the coordinator sees them, and specialists keep their current inputs.
    attachments: z.array(Attachment).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
  })
  .refine((request) => request.message.trim() !== "" || (request.attachments?.length ?? 0) > 0, {
    message: "Send a message or at least one attachment",
    path: ["message"],
  });
export type ChatRequest = z.infer<typeof ChatRequest>;

// Server -> client
export const ChatResponse = z.object({
  reply: z.string(), // assistant text for the chat stream
  plan: TripPlan, // the fresh aggregated plan for the right-hand panel
});
export type ChatResponse = z.infer<typeof ChatResponse>;

// Sent instead of a plan when a blank conversation is still missing required
// fields: the assistant's own question, plus everything understood so far.
//
// The question here is prose; the traveller answers by typing. A structured
// question with choices, when the coordinator asked one, arrives as
// ChatAskUser instead.
export const ChatNeedsInfo = z.object({
  type: z.literal("needs_info"),
  question: z.string(),
  known: PartialTripBrief,
});
export type ChatNeedsInfo = z.infer<typeof ChatNeedsInfo>;

/** At most this many questions in one ask, and this many options per question. */
export const ASK_USER_MAX_QUESTIONS = 4;
export const ASK_USER_MAX_OPTIONS = 4;

// One selectable answer to a structured question. A recommended option comes
// first, with " (Recommended)" appended to its label.
export const AskUserQuestionOption = z.object({
  label: z.string().trim().min(1),
  description: z.string().optional(),
});
export type AskUserQuestionOption = z.infer<typeof AskUserQuestionOption>;

// One structured question the coordinator asked. With no options the traveller
// answers in free text; with options, "Other" free text is still allowed.
export const AskUserQuestionItem = z.object({
  id: z.string().min(1),
  question: z.string().trim().min(1),
  header: z.string().optional(),
  detail: z.string().optional(),
  options: z.array(AskUserQuestionOption).max(ASK_USER_MAX_OPTIONS).optional(),
  multiSelect: z.boolean().optional(),
});
export type AskUserQuestionItem = z.infer<typeof AskUserQuestionItem>;

// Sent instead of a completed plan when the coordinator asked the traveller a
// structured question. The answer is the traveller's next message, sent with
// `known` like any follow-up. `plan` is the client's plan returned unchanged
// when there was one, so a question about an open trip loses nothing; `reply`
// is whatever prose the coordinator wrote alongside the question.
export const ChatAskUser = z.object({
  type: z.literal("ask_user"),
  questions: z.array(AskUserQuestionItem).min(1).max(ASK_USER_MAX_QUESTIONS),
  known: PartialTripBrief,
  plan: TripPlan.optional(),
  reply: z.string().optional(),
});
export type ChatAskUser = z.infer<typeof ChatAskUser>;

// What a result row is, so a client can give it a category glyph without
// parsing the label. "place" is the fallback for a place no keyword placed.
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

// One line of a tool call's structured result, e.g. a stay candidate or a place.
// The label is the whole row, so a client never has to know the tool's domain;
// `kind` only chooses its icon and is optional for older emitters.
export const ToolResultRow = z.object({
  label: z.string().min(1),
  detail: z.string().optional(),
  kind: ToolResultKind.optional(),
  // The web page this row is about, when the provider reported one — a hotel's
  // own site, a place's website. It is never invented: a row whose provider
  // returned no page has no `url`, and a client that shows a site icon for it
  // falls back to the category glyph. Only the host is ever used for that icon,
  // so a link with a query string cannot leak through it.
  url: z.string().url().optional(),
});
export type ToolResultRow = z.infer<typeof ToolResultRow>;

// The model's own choice inside a tool result, e.g. the stay it picked out of
// the candidates. `rationale` is the model's stated reason, not a restatement.
export const ToolChoice = z.object({
  title: z.string().min(1),
  selected: ToolResultRow,
  rationale: z.string().optional(),
  alternatives: z.array(ToolResultRow).default([]),
});
export type ToolChoice = z.infer<typeof ToolChoice>;

// Sent instead of a plan when the traveller asked what a flight costs rather
// than for a trip to be planned: the fares themselves, with no itinerary,
// budget or decisions attached because none were asked for.
export const FlightAnswerOption = z.object({
  carrier: z.string(),
  /** Whole-party total in the base currency; see ./money. */
  price: z.number().nonnegative(),
  note: z.string().optional(),
  stops: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  /** The flights themselves, when the provider described them. */
  outbound: FlightLeg.optional(),
  /** The way home. Only fetched for the itineraries shown in full. */
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
  /** Cheapest first; empty when the provider had nothing or was unavailable. */
  options: z.array(FlightAnswerOption),
  /** Where the fares came from, so the UI can label them like any other result. */
  source: z.object({ kind: z.string(), label: z.string(), freshness: z.string() }).optional(),
});
export type FlightAnswer = z.infer<typeof FlightAnswer>;

// Progress frames emitted while the orchestrator delegates work. The final
// ChatResponse remains unchanged; clients can render these frames as optional
// activity without coupling to LangGraph internals.
export const AgentProgressEvent = z.discriminatedUnion("type", [
  z.object({
    // A streamed slice of the supervisor's or coordinator's own thinking. Text
    // is a delta, not the whole block; clients append deltas by
    // (agent, round, episode, index). One model call chain is one block: the
    // orchestrator paces flushes but gives every flush the same index, so the
    // block grows in place instead of arriving as separate fragments.
    type: z.literal("agent_reasoning"),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
    // Which model call chain produced this block. One round can hold several —
    // the dispatch supervisor, then one revision supervisor per conflict pass —
    // and each numbers its own blocks from zero, so `round` alone does not
    // identify a block. Defaults to 0 for an emitter that never sets it.
    episode: z.number().int().nonnegative().default(0),
    index: z.number().int().nonnegative(),
    text: z.string().min(1),
  }),
  z.object({
    // The coordinator's account of a round boundary: what started it and what
    // it is waiting on. Renders as the round's heading in the transcript, and
    // is the only explanation a round number ever gets.
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
    // The bounded objective the supervisor handed this specialist, so a reader
    // can see what it was asked to do rather than only that it ran.
    objective: z.string().optional(),
    agent: z.enum(AGENT_NAMES),
    round: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("agent_completed"),
    summary: z.string().optional(),
    // What this round of work changed, in the specialist's own words. Present
    // on revisions, where the reason a round exists is the conflict it fixed.
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
    // The arguments the call was made with. Optional: older emitters omit it.
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
    // The result's own rows, bounded by the emitter (see BOUNDED_RESULT_ROWS).
    resultRows: z.array(ToolResultRow).optional(),
    // Set when the emitter had more rows than it published.
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

/** Emitters never publish more than this many rows for one tool result. */
export const BOUNDED_RESULT_ROWS = 20;
export type AgentProgressEvent = z.infer<typeof AgentProgressEvent>;
