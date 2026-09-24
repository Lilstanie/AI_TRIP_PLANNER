import {
  AgentProgressEvent,
  BASE_CURRENCY,
  ChatAskUser,
  ChatNeedsInfo,
  ChatResponse,
  FlightAnswer,
  moneyIn,
  PartialTripBrief,
  partyPeople,
  TripBrief,
  TripPlan,
  TripPreferences,
  type TravellerParty,
} from "@trip/shared";

/**
 * What a sent message keeps about one attachment. Deliberately not the sent
 * payload: the workspace is persisted in browser storage, and a 1.5 MB base64
 * image per message would exhaust that budget within a few turns. Only a small
 * thumbnail (see THUMBNAIL_MAX_EDGE) and the file's identity are kept, which is
 * all the transcript needs to show.
 */
export type MessageAttachment = {
  name: string;
  mediaType: string;
  kind: "image" | "text";
  /** A `data:` URL at most a couple of hundred pixels across; images only. */
  thumbnail?: string;
  /** Size of what was sent, for the chip's second line. */
  bytes?: number;
};

export type Message = {
  role: "user" | "agent";
  text: string;
  /** Files sent with this message, shown with the bubble. Optional like `at`. */
  attachments?: MessageAttachment[];
  /** Fares, when this turn answered a flight question instead of planning. */
  flights?: FlightAnswer;
  /** The thinking transcript that produced this reply, rendered as the fold above it. */
  activity?: AgentProgressEvent[];
  /** Epoch ms this message was appended; optional so a stored trip without it still loads. */
  at?: number;
};
/** The Who chip's steppers; sent to the planner as `TripBrief.party` beside `groupSize`. */
export const PARTY_KEYS = ["adults", "children", "infants", "seniors", "pets"] as const;
export type Party = TravellerParty;

export type Draft = {
  destination: string;
  origin: string;
  start: string;
  end: string;
  groupSize: string;
  budgetTotal: string;
  /**
   * The traveller's own trip preferences, in their words. Optional so a draft stored before the
   * list existed still loads; read it through `draftPreferences`.
   */
  preferences?: string[];
  /**
   * The Who chip's stepper breakdown. Optional so a draft stored before the steppers existed, or a
   * draft built from a brief (`draftFor`, which has no breakdown to restore), still loads; read it
   * through `partyFor`. `groupSize` is kept in sync from it whenever a stepper changes, and both
   * reach the planner: `groupSize` for the arithmetic, `party` (as `TripBrief.party`) for who is
   * travelling. A breakdown that no longer adds up to `groupSize` is not sent.
   */
  party?: Party;
  // No longer edited anywhere (the preferences editor replaced them with the list above). A stored
  // brief's values are carried through unchanged so replanning an older trip keeps them.
  nationality: string;
  roomAllocation: "shared" | "individual";
  minRating: string;
  freeCancellation: boolean;
};
/** The draft's preference list; absent in drafts stored before the list existed. */
export const draftPreferences = (draft: Pick<Draft, "preferences">): string[] =>
  draft.preferences ?? [];
const isParty = (value: unknown): value is Party =>
  object(value) &&
  PARTY_KEYS.every(
    (key) => typeof value[key] === "number" && Number.isInteger(value[key]) && value[key] >= 0,
  );
/**
 * The Who chip's stepper state: the draft's own breakdown, or — for a draft with none, such as one
 * built from a brief or from before the steppers existed — every stated traveller counted as an
 * adult, so opening the editor never contradicts the chip's own count.
 */
export function partyFor(draft: Pick<Draft, "party" | "groupSize">): Party {
  if (draft.party) return draft.party;
  const adults = Number(draft.groupSize);
  return {
    adults: Number.isInteger(adults) && adults > 0 ? adults : 0,
    children: 0,
    infants: 0,
    seniors: 0,
    pets: 0,
  };
}
/** `groupSize` the planner receives: people only — pets never count as travellers. */
export const groupSizeFromParty = (party: Party) => partyPeople(party);
export const money = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: BASE_CURRENCY,
    currencyDisplay: "code",
  }).format(value);
/**
 * "(≈ ¥3,000)" beside a converted budget, so a traveller who said 3000 人民币 can see where
 * A$630 came from. Empty when they stated it in the base currency: there is nothing to explain.
 */
export const budgetHint = (brief: Pick<TripBrief, "budgetSource">) =>
  brief.budgetSource && brief.budgetSource.currency !== BASE_CURRENCY
    ? ` (≈ ${moneyIn(brief.budgetSource.amount, brief.budgetSource.currency)})`
    : "";
export function draftFor(brief: TripBrief): Draft {
  return {
    destination: brief.destination,
    origin: brief.origin ?? "",
    start: brief.dates[0],
    end: brief.dates[1],
    groupSize: String(brief.groupSize),
    ...(brief.party && partyPeople(brief.party) === brief.groupSize ? { party: brief.party } : {}),
    budgetTotal: String(brief.budgetTotal),
    preferences: brief.preferences ?? [],
    nationality: brief.nationality ?? "",
    roomAllocation: brief.accommodation?.roomAllocation ?? "shared",
    minRating: String(brief.accommodation?.minRating ?? 0),
    freeCancellation: brief.accommodation?.freeCancellation ?? false,
  };
}
/** Empty preferences for a new conversation; never derived from the demo or a previous trip. */
export const blankDraft = (): Draft => ({
  destination: "",
  origin: "",
  start: "",
  end: "",
  groupSize: "",
  budgetTotal: "",
  preferences: [],
  nationality: "",
  roomAllocation: "shared",
  // 0 is the schema default and means "no minimum"; it is a filter, not invented trip data.
  minRating: "0",
  freeCancellation: false,
});
export function isDraft(value: unknown): value is Draft {
  return (
    object(value) &&
    ["destination", "start", "end", "groupSize", "budgetTotal", "nationality", "minRating"].every(
      (key) => typeof value[key] === "string",
    ) &&
    ["shared", "individual"].includes(String(value.roomAllocation)) &&
    typeof value.freeCancellation === "boolean" &&
    (value.preferences === undefined ||
      (Array.isArray(value.preferences) &&
        value.preferences.every((item) => typeof item === "string"))) &&
    (value.party === undefined || isParty(value.party))
  );
}
/** `current` is the existing brief, or only the identifiers for a blank conversation. */
export function parseDraft(draft: Draft, current: Pick<TripBrief, "tripId"> & Partial<TripBrief>) {
  const preferences = draftPreferences(draft);
  // Nothing edits the rating any more, so a stored value the schema would reject cannot be fixed
  // by the traveller; it falls back to the schema default, 0, which means "no minimum".
  const rating = draft.minRating.trim() ? Number(draft.minRating) : NaN;
  return TripBrief.safeParse({
    ...current,
    destination: draft.destination,
    origin: draft.origin.trim() || undefined,
    dates: [draft.start, draft.end],
    groupSize: Number(draft.groupSize),
    // Spreading `current` would otherwise keep a breakdown the traveller has since changed.
    party: statedParty(draft),
    budgetTotal: Number(draft.budgetTotal),
    // The form is base-currency only, so a budget typed here has no source to explain.
    // Spreading `current` would otherwise carry a stale one past an edit.
    budgetSource: undefined,
    // An emptied list clears the brief's, rather than letting `current` carry the old one.
    preferences: preferences.length ? preferences : undefined,
    nationality: draft.nationality.trim() || undefined,
    accommodation: {
      roomAllocation: draft.roomAllocation,
      minRating: Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating : 0,
      freeCancellation: draft.freeCancellation,
    },
  });
}
/**
 * What the traveller has stated so far, read from the preferences form. A blank conversation sends
 * this with every message, so answering a follow-up question does not mean repeating the rest. Only
 * fields that are filled in and valid are sent; a half-typed number is not a stated fact.
 */
export function knownFromDraft(draft: Draft): PartialTripBrief {
  const number = (value: string) => (value.trim() ? Number(value) : undefined);
  const parsed = PartialTripBrief.safeParse({
    destination: draft.destination.trim() || undefined,
    origin: draft.origin.trim() || undefined,
    dates: draft.start.trim() && draft.end.trim() ? [draft.start, draft.end] : undefined,
    groupSize: number(draft.groupSize),
    party: statedParty(draft),
    budgetTotal: number(draft.budgetTotal),
    nationality: draft.nationality.trim() || undefined,
    preferences: statedPreferences(draftPreferences(draft)),
  });
  return parsed.success ? parsed.data : {};
}

/**
 * The draft's breakdown, only while it still matches the stated number of people: a count typed or
 * learned in chat after the steppers were used makes the breakdown stale, and it is then left out.
 */
function statedParty(draft: Pick<Draft, "party" | "groupSize">): Party | undefined {
  const party = draft.party;
  return party && partyPeople(party) > 0 && partyPeople(party) === Number(draft.groupSize)
    ? party
    : undefined;
}

/** A list the schema would reject is left out, so it cannot drop the other stated facts. */
function statedPreferences(list: string[]) {
  const parsed = TripPreferences.safeParse(list);
  return parsed.success && parsed.data.length ? parsed.data : undefined;
}

/** Show what the assistant understood in the preferences form, without clearing anything else. */
export function draftWithKnown(draft: Draft, known: PartialTripBrief): Draft {
  return {
    ...draft,
    destination: known.destination ?? draft.destination,
    origin: known.origin ?? draft.origin,
    start: known.dates?.[0] ?? draft.start,
    end: known.dates?.[1] ?? draft.end,
    groupSize: known.groupSize === undefined ? draft.groupSize : String(known.groupSize),
    // A head count learned in chat that the breakdown no longer adds up to replaces it.
    party: statedParty({
      party: known.party ?? draft.party,
      groupSize: String(known.groupSize ?? draft.groupSize),
    }),
    budgetTotal: known.budgetTotal === undefined ? draft.budgetTotal : String(known.budgetTotal),
    nationality: known.nationality ?? draft.nationality,
    preferences: known.preferences ?? draft.preferences,
  };
}

/**
 * `version` 3 is the AUD base-currency snapshot. Versions 1 and 2 are rejected rather
 * than migrated: their stay candidates carry the old `pricePerNightUsd` field, so they
 * cannot be parsed at all, and their amounts meant USD. Rejecting is honest -- there is
 * no defensible rate for a snapshot of unknown date. This is a single-user local
 * workspace, so the cost is that saved trips from before the change do not reopen.
 */
export type Snapshot = {
  version: 3;
  id: string;
  savedAt: string;
  plan: TripPlan;
  draft: Draft;
  messages: Message[];
  input: string;
  previousTotal?: number;
};
export const CURRENT_KEY = "trip-workspace-v1";
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function parseSnapshot(value: unknown): Snapshot {
  if (
    !object(value) ||
    value.version !== 3 ||
    typeof value.id !== "string" ||
    typeof value.savedAt !== "string" ||
    !Number.isFinite(Date.parse(value.savedAt))
  )
    throw new Error("Saved trip version or data is invalid.");
  const plan = identifyActivities(TripPlan.parse(value.plan));
  if (plan.tripId !== plan.brief.tripId) throw new Error("Saved trip identifiers do not match.");
  if (!isDraft(value.draft)) throw new Error("Saved form data is invalid.");
  if (
    !Array.isArray(value.messages) ||
    !value.messages.every(
      (m) =>
        object(m) &&
        ["user", "agent"].includes(String(m.role)) &&
        typeof m.text === "string" &&
        (m.at === undefined || Number.isFinite(m.at)),
    ) ||
    typeof value.input !== "string"
  )
    throw new Error("Saved conversation is invalid.");
  if (
    value.previousTotal !== undefined &&
    (typeof value.previousTotal !== "number" ||
      !Number.isFinite(value.previousTotal) ||
      value.previousTotal < 0)
  )
    throw new Error("Saved budget history is invalid.");
  return {
    ...value,
    version: 3,
    plan,
    messages: withValidAttachments(withValidActivity(value.messages as Message[])),
  } as Snapshot;
}

/**
 * A stored reply keeps its transcript only while every frame still matches the
 * progress contract; a stale or damaged transcript is dropped, never the message.
 */
export function withValidActivity(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.activity === undefined) return message;
    const parsed = AgentProgressEvent.array().safeParse(message.activity);
    if (parsed.success) return { ...message, activity: parsed.data };
    const { activity: _dropped, ...rest } = message;
    return rest;
  });
}
/**
 * A stored message keeps its attachments only while every entry still matches
 * the shape above; a damaged or foreign entry is dropped, never the message.
 * Same posture as `withValidActivity` and `Message.at`.
 */
export function withValidAttachments(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.attachments === undefined) return message;
    const kept = Array.isArray(message.attachments)
      ? message.attachments.filter(isMessageAttachment)
      : [];
    if (!Array.isArray(message.attachments) || kept.length !== message.attachments.length) {
      if (!kept.length) {
        const { attachments: _dropped, ...rest } = message;
        return rest;
      }
      return { ...message, attachments: kept };
    }
    return message;
  });
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  return (
    object(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.mediaType === "string" &&
    (value.kind === "image" || value.kind === "text") &&
    // A thumbnail is inert only while it is an inline image; a remote or
    // script-bearing URL restored from storage would be neither.
    (value.thumbnail === undefined ||
      (typeof value.thumbnail === "string" && value.thumbnail.startsWith("data:image/"))) &&
    (value.bytes === undefined || (typeof value.bytes === "number" && Number.isFinite(value.bytes)))
  );
}

/**
 * The conversation has not stated enough to plan yet. It carries the assistant's question and
 * everything understood so far, so the caller can ask in the chat rather than show a failure.
 */
export class NeedsInfoError extends Error {
  constructor(readonly needsInfo: ChatNeedsInfo) {
    super(needsInfo.question);
    this.name = "NeedsInfoError";
  }
}

/**
 * The traveller asked what a flight costs, so there is no plan to return —
 * only fares. Signalled the same way as NeedsInfoError: a non-plan outcome the
 * chat renders, not a failure.
 */
export class FlightAnswerError extends Error {
  constructor(readonly answer: FlightAnswer) {
    super(answer.reply);
    this.name = "FlightAnswerError";
  }
}

/**
 * The coordinator asked the traveller a structured question (1–4 items with optional choices)
 * instead of finishing the turn. Signalled like NeedsInfoError. `askUser.known` goes back with
 * the answer; `askUser.plan`, when present, is the client's own plan returned unchanged.
 */
export class AskUserError extends Error {
  constructor(readonly askUser: ChatAskUser) {
    super(askUser.reply || askUser.questions[0]?.question || "The assistant asked a question.");
    this.name = "AskUserError";
  }
}

/** One shared parser for form planning and chat. An incomplete stream is a retryable failure. */
export async function readPlanStream(
  response: Response,
  onProgress: (event: AgentProgressEvent) => void,
): Promise<ChatResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${response.status}).`);
  }
  if (!response.body) throw new Error("No progress stream was received. Please retry.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | undefined;
  let needsInfo: ChatNeedsInfo | undefined;
  let askUser: ChatAskUser | undefined;
  let flights: FlightAnswer | undefined;
  let error: string | undefined;
  const frame = (line: string) => {
    if (!line.trim()) return;
    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch {
      return;
    }
    if (!object(data)) return;
    if (data.type === "complete") {
      const parsed = ChatResponse.safeParse(data.response);
      if (parsed.success) result = parsed.data;
      else error = "The returned plan was invalid. Please retry.";
    } else if (data.type === "needs_info") {
      const parsed = ChatNeedsInfo.safeParse(data);
      if (parsed.success) needsInfo = parsed.data;
      else error = "The assistant's question was invalid. Please retry.";
    } else if (data.type === "ask_user") {
      const parsed = ChatAskUser.safeParse(data);
      if (parsed.success) askUser = parsed.data;
      else error = "The assistant's question was invalid. Please retry.";
    } else if (data.type === "flight_answer") {
      const parsed = FlightAnswer.safeParse(data);
      if (parsed.success) flights = parsed.data;
      else error = "The returned fares were invalid. Please retry.";
    } else if (data.type === "error")
      error = typeof data.error === "string" ? data.error : "Planning failed. Please retry.";
    else {
      const parsed = AgentProgressEvent.safeParse(data);
      if (parsed.success) onProgress(parsed.data);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(frame);
      if (done) break;
    }
    frame(buffer);
  } finally {
    reader.releaseLock();
  }
  if (error) throw new Error(error);
  if (needsInfo) throw new NeedsInfoError(needsInfo);
  if (askUser) throw new AskUserError(askUser);
  if (flights) throw new FlightAnswerError(flights);
  if (!result) throw new Error("Connection ended before the plan was ready. Please retry.");
  return result;
}

/** Itinerary activities in plan order; hotels and transport are never mapped. */
export function itineraryActivities(plan: TripPlan | undefined) {
  return (
    plan?.sections
      .find((section) => section.id === "itinerary")
      ?.proposal?.items.filter((item) => item.kind === "activity") ?? []
  );
}

/** Allocate IDs only for legacy/new items; never derive identity from array position. */
export function identifyActivities(plan: TripPlan): TripPlan {
  return {
    ...plan,
    editVersion: plan.editVersion ?? 0,
    sections: plan.sections.map((section) => ({
      ...section,
      proposal: section.proposal
        ? {
            ...section.proposal,
            items: section.proposal.items.map((item) =>
              item.kind === "activity" && !item.id ? { ...item, id: crypto.randomUUID() } : item,
            ),
          }
        : undefined,
    })),
  };
}
