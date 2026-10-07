import type {
  AgentProgressEvent,
  AskUserQuestionItem,
  ChatRequest,
  FlightAnswer,
  PartialTripBrief,
  TripPlan,
} from "@trip/shared";
import { errorNotice, type Notice } from "@/lib/i18n/notice";
import type { RouteResult } from "@/lib/integrations/google";
import type { PendingAsk } from "./ask-user";
import {
  AskUserError,
  FlightAnswerError,
  NeedsInfoError,
  draftFor,
  draftWithKnown,
  identifyActivities,
  readPlanStream,
  type Draft,
  type Message,
} from "./workspace";

/** Every turn is a chat turn: there is no "apply a decision" request. */
export type Task = { kind: "chat"; request: ChatRequest };

/**
 * The conversation and trip a planning turn reads and changes. Pure data: `session()` moves it
 * from one turn event to the next, and the workspace controller only stores it.
 */
export type SessionState = {
  plan: TripPlan | undefined;
  draft: Draft;
  messages: Message[];
  /** The composer's unsent text. */
  input: string;
  /** The plan's total before the last change, for the "changed by" figure. */
  previousTotal: number | undefined;
  busy: boolean;
  /** Progress of the turn in flight. */
  activity: AgentProgressEvent[];
  /** The failure shown above the composer, if any. */
  error: Notice | undefined;
  /** One notice per brief field the last submission got wrong. */
  errors: Record<string, Notice>;
  /** The turn a Retry button sends again. */
  retry: Task | undefined;
  /** The structured question waiting for an answer. */
  ask: PendingAsk | undefined;
  /** The stop selected on the map or timeline. */
  selectedActivity: string | undefined;
  /** Routes drawn on the map for the selected day. */
  mapRoutes: RouteResult[];
};

/**
 * How a planning turn ended. `transcript` is the turn's progress, kept on the reply so its
 * Think fold renders above the answer; `at` is when the reply arrived.
 */
export type TurnOutcome =
  /** The planner returned a plan, which replaces the open one. */
  | { kind: "planned"; plan: TripPlan; reply: string; transcript: AgentProgressEvent[]; at: number }
  /** Not enough to plan yet: the planner asks in prose and returns what it understood. */
  | {
      kind: "needsInfo";
      question: string;
      known: PartialTripBrief;
      transcript: AgentProgressEvent[];
      at: number;
    }
  /** The planner asked a structured question; `plan` is the open plan it asked about. */
  | {
      kind: "asked";
      key: string;
      questions: AskUserQuestionItem[];
      known: PartialTripBrief;
      plan?: TripPlan;
      reply?: string;
      transcript: AgentProgressEvent[];
      at: number;
    }
  /** A fare question answered with fares; the open trip is not part of it. */
  | { kind: "answered"; flights: FlightAnswer; transcript: AgentProgressEvent[]; at: number }
  /** The request or the planner failed; `task` is what Retry sends again. */
  | { kind: "failed"; message: Notice; task: Task }
  /** The traveller cancelled the turn. */
  | { kind: "cancelled" };

/** Everything that moves a session: a turn's start, its progress and its outcome. */
export type SessionEvent =
  | TurnOutcome
  | { kind: "started" }
  /** The traveller's message went out; a brief submission also clears the field errors. */
  | { kind: "sent"; message: Message; brief?: boolean }
  | { kind: "progress"; event: AgentProgressEvent }
  /** The brief was not sent: `fields` holds one message per invalid field. */
  | { kind: "rejected"; fields: Record<string, Notice> }
  /**
   * The traveller opened another chat or trip (or a blank one): in-flight and selection state from
   * the one they left goes, and only what was saved with the new one shows.
   */
  | { kind: "opened"; saved: SavedSession }
  /** The traveller applied an edit to the open trip by hand. */
  | { kind: "edited"; plan: TripPlan }
  /** The composer's unsent text changed. */
  | { kind: "typed"; input: string }
  /** The trip details form changed without planning. */
  | { kind: "drafted"; draft: Draft }
  /** A stop was selected on the map, the trip list or the timeline; none clears the selection. */
  | { kind: "selected"; activity: string | undefined }
  /** The timeline drew the selected day's routes. */
  | { kind: "routed"; routes: RouteResult[] }
  /** The traveller closed the question card without answering. */
  | { kind: "dismissed" };

/** The first progress line of every turn, shown before the server says anything. */
export const PREPARING: AgentProgressEvent = {
  type: "coordinator",
  phase: "dispatch",
  round: 1,
  summary: "Preparing your request.",
};

export const REJECTED_BRIEF: Notice = { key: "Check the highlighted trip details." };
const FAILED: Notice = { key: "Unable to update the trip. Please retry." };

/** What a saved or blank conversation brings into the session when it is opened. */
export type SavedSession = Pick<SessionState, "draft" | "messages" | "input"> &
  Partial<Pick<SessionState, "plan" | "previousTotal">>;

/** A session with no turn in flight, opened on a saved or blank conversation. */
export function idleSession(saved: SavedSession): SessionState {
  return {
    plan: saved.plan,
    draft: saved.draft,
    messages: saved.messages,
    input: saved.input,
    previousTotal: saved.previousTotal,
    busy: false,
    activity: [],
    error: undefined,
    errors: {},
    retry: undefined,
    ask: undefined,
    selectedActivity: undefined,
    mapRoutes: [],
  };
}

function reply(
  text: string,
  transcript: AgentProgressEvent[],
  at: number,
  extra: Partial<Message> = {},
): Message {
  // A turn with nothing past the opening line has no Think fold.
  return {
    role: "agent",
    text,
    ...extra,
    at,
    ...(transcript.length > 1 ? { activity: [...transcript] } : {}),
  };
}

/** A reply ended the turn: the chat gets it and the composer is emptied. */
function replied(state: SessionState, message: Message): SessionState {
  return {
    ...state,
    messages: [...state.messages, message],
    input: "",
    activity: [],
    busy: false,
  };
}

/**
 * Applies one turn event to the session. Pure: every rule about what a turn resets lives here.
 * @param state - the session before the event.
 * @param event - a turn's start, progress or outcome, or the traveller leaving the chat.
 * @returns the session after the event.
 */
export function session(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case "started":
      // Any new request supersedes an unanswered question and the last failure.
      return {
        ...state,
        busy: true,
        error: undefined,
        retry: undefined,
        ask: undefined,
        activity: [PREPARING],
      };
    case "sent":
      return {
        ...state,
        messages: [...state.messages, event.message],
        ...(event.brief ? { errors: {} } : {}),
      };
    case "progress":
      return { ...state, activity: [...state.activity, event.event] };
    case "rejected":
      return { ...state, errors: event.fields, error: REJECTED_BRIEF };
    case "opened":
      return idleSession(event.saved);
    case "typed":
      return { ...state, input: event.input };
    case "drafted":
      return { ...state, draft: event.draft };
    case "selected":
      return { ...state, selectedActivity: event.activity };
    case "routed":
      return { ...state, mapRoutes: event.routes };
    case "dismissed":
      return { ...state, ask: undefined };
    case "edited":
      return { ...state, previousTotal: state.plan?.estTotal, plan: event.plan };
    case "planned":
      return {
        ...replied(state, reply(event.reply, event.transcript, event.at)),
        previousTotal: state.plan?.estTotal,
        plan: identifyActivities(event.plan),
        draft: draftFor(event.plan.brief),
        selectedActivity: undefined,
        mapRoutes: [],
        errors: {},
      };
    case "needsInfo":
      // What the assistant understood goes into the form and travels with the next message.
      return {
        ...replied(state, reply(event.question, event.transcript, event.at)),
        draft: draftWithKnown(state.draft, event.known),
      };
    case "asked": {
      const text = event.reply?.trim() || event.questions.map((item) => item.question).join("\n\n");
      return {
        ...replied(state, reply(text, event.transcript, event.at)),
        // A question about an open trip leaves its form alone.
        ...(event.plan ? {} : { draft: draftWithKnown(state.draft, event.known) }),
        ask: {
          key: event.key,
          questions: event.questions,
          known: event.known,
          ...(event.plan ? { plan: event.plan } : {}),
        },
      };
    }
    case "answered":
      return replied(
        state,
        reply(event.flights.reply, event.transcript, event.at, { flights: event.flights }),
      );
    case "failed":
      return { ...state, busy: false, error: event.message, retry: event.task };
    case "cancelled":
      return { ...state, busy: false };
  }
}

/**
 * Sends one planning turn and reads its stream. Never throws and never touches workspace state:
 * the outcome goes to `session()`.
 * @param task - the turn to send; a failure carries it back for Retry.
 * @param send - opens the request; the caller adds headers and settings to the body.
 * @param options.signal - aborting it ends the turn as `cancelled`.
 * @param options.onProgress - each progress frame as it arrives.
 * @returns how the turn ended.
 */
export async function requestTurn(
  task: Task,
  send: (signal: AbortSignal) => Promise<Response>,
  {
    signal,
    onProgress,
    now = Date.now,
    newKey = () => crypto.randomUUID(),
  }: {
    signal: AbortSignal;
    onProgress?: (event: AgentProgressEvent) => void;
    now?: () => number;
    newKey?: () => string;
  },
): Promise<TurnOutcome> {
  const transcript: AgentProgressEvent[] = [PREPARING];
  try {
    const response = await send(signal);
    const result = await readPlanStream(response, (event) => {
      transcript.push(event);
      onProgress?.(event);
    });
    return { kind: "planned", plan: result.plan, reply: result.reply, transcript, at: now() };
  } catch (failure) {
    if (signal.aborted) return { kind: "cancelled" };
    if (failure instanceof FlightAnswerError)
      return { kind: "answered", flights: failure.answer, transcript, at: now() };
    if (failure instanceof NeedsInfoError) {
      const { question, known } = failure.needsInfo;
      return { kind: "needsInfo", question, known, transcript, at: now() };
    }
    if (failure instanceof AskUserError) {
      const { questions, known, plan, reply: text } = failure.askUser;
      return {
        kind: "asked",
        key: newKey(),
        questions,
        known,
        ...(plan ? { plan } : {}),
        ...(text !== undefined ? { reply: text } : {}),
        transcript,
        at: now(),
      };
    }
    return {
      kind: "failed",
      // An error the app did not author, such as a dropped connection, is shown as raised.
      message: errorNotice(failure, FAILED),
      task,
    };
  }
}
