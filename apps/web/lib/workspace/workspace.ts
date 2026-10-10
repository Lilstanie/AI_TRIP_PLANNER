import {
  AgentProgressEvent,
  BookedStay,
  ChatAskUser,
  ChatNeedsInfo,
  ChatResponse,
  Currency,
  FlightAnswer,
  LegModeChoice,
  toAud,
  PartialTripBrief,
  partyPeople,
  TripBrief,
  TripPlan,
  TripPreferences,
  type TravellerParty,
} from "@trip/shared";
import { failureNotice, NoticeError, type Notice } from "../i18n/notice";

export type MessageAttachment = {
  name: string;
  mediaType: string;
  kind: "image" | "text";

  thumbnail?: string;

  bytes?: number;
};

export type Message = {
  role: "user" | "agent";
  text: string;

  attachments?: MessageAttachment[];

  flights?: FlightAnswer;

  activity?: AgentProgressEvent[];

  at?: number;
};

export const PARTY_KEYS = ["adults", "children", "infants", "seniors", "pets"] as const;
export type Party = TravellerParty;

export type Draft = {
  destination: string;
  origin: string;
  start: string;
  end: string;
  groupSize: string;
  budgetTotal: string;

  budgetSource?: TripBrief["budgetSource"];

  displayCurrency?: Currency;

  preferences?: string[];

  learnedPreferences?: string[];

  excludeFlights?: boolean;

  legModes?: LegModeChoice[];

  bookedStay?: BookedStay;

  party?: Party;

  nationality: string;
  roomAllocation: "shared" | "individual";
  minRating: string;
  freeCancellation: boolean;
};

export const draftPreferences = (draft: Pick<Draft, "preferences">): string[] =>
  draft.preferences ?? [];
const isParty = (value: unknown): value is Party =>
  object(value) &&
  PARTY_KEYS.every(
    (key) => typeof value[key] === "number" && Number.isInteger(value[key]) && value[key] >= 0,
  );

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

export const groupSizeFromParty = (party: Party) => partyPeople(party);
export function draftFor(brief: TripBrief): Draft {
  return {
    destination: brief.destination,
    origin: brief.origin ?? "",
    start: brief.dates[0],
    end: brief.dates[1],
    groupSize: String(brief.groupSize),
    ...(brief.party && partyPeople(brief.party) === brief.groupSize ? { party: brief.party } : {}),
    budgetTotal: String(brief.budgetTotal),
    ...(brief.budgetSource ? { budgetSource: brief.budgetSource } : {}),
    ...(brief.displayCurrency ? { displayCurrency: brief.displayCurrency } : {}),
    preferences: brief.preferences ?? [],
    ...(brief.learnedPreferences?.length ? { learnedPreferences: brief.learnedPreferences } : {}),
    ...(brief.excludeFlights ? { excludeFlights: true } : {}),
    ...(brief.legModes?.length ? { legModes: brief.legModes } : {}),
    ...(brief.bookedStay ? { bookedStay: brief.bookedStay } : {}),
    nationality: brief.nationality ?? "",
    roomAllocation: brief.accommodation?.roomAllocation ?? "shared",
    minRating: String(brief.accommodation?.minRating ?? 0),
    freeCancellation: brief.accommodation?.freeCancellation ?? false,
  };
}

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
    (value.party === undefined || isParty(value.party)) &&
    (value.learnedPreferences === undefined ||
      (Array.isArray(value.learnedPreferences) &&
        value.learnedPreferences.every((item) => typeof item === "string"))) &&
    (value.excludeFlights === undefined || typeof value.excludeFlights === "boolean") &&
    (value.legModes === undefined || LegModeChoice.array().safeParse(value.legModes).success) &&
    (value.budgetSource === undefined ||
      TripBrief.shape.budgetSource.unwrap().safeParse(value.budgetSource).success) &&
    (value.displayCurrency === undefined || Currency.safeParse(value.displayCurrency).success) &&
    (value.bookedStay === undefined || BookedStay.safeParse(value.bookedStay).success)
  );
}

export function parseDraft(draft: Draft, current: Pick<TripBrief, "tripId"> & Partial<TripBrief>) {
  const preferences = draftPreferences(draft);

  const rating = draft.minRating.trim() ? Number(draft.minRating) : NaN;
  return TripBrief.safeParse({
    ...current,
    destination: draft.destination,
    origin: draft.origin.trim() || undefined,
    dates: [draft.start, draft.end],
    groupSize: Number(draft.groupSize),

    party: statedParty(draft),
    budgetTotal: Number(draft.budgetTotal),
    budgetSource: statedBudgetSource(draft),
    displayCurrency: draft.displayCurrency,

    preferences: preferences.length ? preferences : undefined,

    learnedPreferences: statedPreferences(draft.learnedPreferences ?? []),
    excludeFlights: draft.excludeFlights || undefined,

    legModes: draft.legModes?.length ? draft.legModes : undefined,
    bookedStay: draft.bookedStay,
    nationality: draft.nationality.trim() || undefined,
    accommodation: {
      roomAllocation: draft.roomAllocation,
      minRating: Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating : 0,
      freeCancellation: draft.freeCancellation,
    },
  });
}

export function knownFromDraft(draft: Draft): PartialTripBrief {
  const number = (value: string) => (value.trim() ? Number(value) : undefined);
  const parsed = PartialTripBrief.safeParse({
    destination: draft.destination.trim() || undefined,
    origin: draft.origin.trim() || undefined,
    dates: draft.start.trim() && draft.end.trim() ? [draft.start, draft.end] : undefined,
    groupSize: number(draft.groupSize),
    party: statedParty(draft),
    budgetTotal: number(draft.budgetTotal),
    budgetSource: statedBudgetSource(draft),
    displayCurrency: draft.displayCurrency,
    nationality: draft.nationality.trim() || undefined,
    preferences: statedPreferences(draftPreferences(draft)),
    learnedPreferences: statedPreferences(draft.learnedPreferences ?? []),
    excludeFlights: draft.excludeFlights || undefined,
    legModes: draft.legModes?.length ? draft.legModes : undefined,
    bookedStay: draft.bookedStay,
  });
  return parsed.success ? parsed.data : {};
}

function statedParty(draft: Pick<Draft, "party" | "groupSize">): Party | undefined {
  const party = draft.party;
  return party && partyPeople(party) > 0 && partyPeople(party) === Number(draft.groupSize)
    ? party
    : undefined;
}

export function statedBudgetSource(draft: Pick<Draft, "budgetSource" | "budgetTotal">) {
  const source = TripBrief.shape.budgetSource.unwrap().safeParse(draft.budgetSource);
  if (!source.success) return undefined;
  try {
    return toAud(source.data.amount, source.data.currency) === Number(draft.budgetTotal)
      ? source.data
      : undefined;
  } catch {
    return undefined;
  }
}

function statedPreferences(list: string[]) {
  const parsed = TripPreferences.safeParse(list);
  return parsed.success && parsed.data.length ? parsed.data : undefined;
}

export function draftWithKnown(draft: Draft, known: PartialTripBrief): Draft {
  return {
    ...draft,
    destination: known.destination ?? draft.destination,
    origin: known.origin ?? draft.origin,
    start: known.dates?.[0] ?? draft.start,
    end: known.dates?.[1] ?? draft.end,
    groupSize: known.groupSize === undefined ? draft.groupSize : String(known.groupSize),

    party: statedParty({
      party: known.party ?? draft.party,
      groupSize: String(known.groupSize ?? draft.groupSize),
    }),
    budgetTotal: known.budgetTotal === undefined ? draft.budgetTotal : String(known.budgetTotal),
    budgetSource: known.budgetTotal === undefined ? draft.budgetSource : known.budgetSource,
    displayCurrency: known.displayCurrency ?? draft.displayCurrency,
    nationality: known.nationality ?? draft.nationality,
    preferences: known.preferences ?? draft.preferences,
    learnedPreferences: known.learnedPreferences ?? draft.learnedPreferences,
    excludeFlights: known.excludeFlights ?? draft.excludeFlights,
    legModes: known.legModes ?? draft.legModes,
    bookedStay: known.bookedStay ?? draft.bookedStay,
  };
}

export type Snapshot = {
  version: 3 | 4;
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
    (value.version !== 3 && value.version !== 4) ||
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
    version: 4,
    draft:
      value.version === 3 &&
      !value.draft.budgetSource &&
      Number(value.draft.budgetTotal) === plan.brief.budgetTotal &&
      plan.brief.budgetSource
        ? { ...value.draft, budgetSource: plan.brief.budgetSource }
        : value.draft,
    plan,
    messages: withValidAttachments(withValidActivity(value.messages as Message[])),
  } as Snapshot;
}

export function withValidActivity(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (message.activity === undefined) return message;
    const parsed = AgentProgressEvent.array().safeParse(message.activity);
    if (parsed.success) return { ...message, activity: parsed.data };
    const { activity: _dropped, ...rest } = message;
    return rest;
  });
}

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
    (value.thumbnail === undefined ||
      (typeof value.thumbnail === "string" && value.thumbnail.startsWith("data:image/"))) &&
    (value.bytes === undefined || (typeof value.bytes === "number" && Number.isFinite(value.bytes)))
  );
}

export class NeedsInfoError extends Error {
  constructor(readonly needsInfo: ChatNeedsInfo) {
    super(needsInfo.question);
    this.name = "NeedsInfoError";
  }
}

export class FlightAnswerError extends Error {
  constructor(readonly answer: FlightAnswer) {
    super(answer.reply);
    this.name = "FlightAnswerError";
  }
}

export class AskUserError extends Error {
  constructor(readonly askUser: ChatAskUser) {
    super(askUser.reply || askUser.questions[0]?.question || "The assistant asked a question.");
    this.name = "AskUserError";
  }
}

export async function readPlanStream(
  response: Response,
  onProgress: (event: AgentProgressEvent) => void,
): Promise<ChatResponse> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new NoticeError(
      failureNotice(body, {
        key: "Request failed ({status}).",
        params: { status: response.status },
      }),
    );
  }
  if (!response.body)
    throw new NoticeError({ key: "No progress stream was received. Please retry." });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResponse | undefined;
  let needsInfo: ChatNeedsInfo | undefined;
  let askUser: ChatAskUser | undefined;
  let flights: FlightAnswer | undefined;
  let error: Notice | undefined;
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
      else error = { key: "The returned plan was invalid. Please retry." };
    } else if (data.type === "needs_info") {
      const parsed = ChatNeedsInfo.safeParse(data);
      if (parsed.success) needsInfo = parsed.data;
      else error = { key: "The assistant's question was invalid. Please retry." };
    } else if (data.type === "ask_user") {
      const parsed = ChatAskUser.safeParse(data);
      if (parsed.success) askUser = parsed.data;
      else error = { key: "The assistant's question was invalid. Please retry." };
    } else if (data.type === "flight_answer") {
      const parsed = FlightAnswer.safeParse(data);
      if (parsed.success) flights = parsed.data;
      else error = { key: "The returned fares were invalid. Please retry." };
    } else if (data.type === "error")
      error = failureNotice(data, { key: "Planning failed. Please retry." });
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
  if (error) throw new NoticeError(error);
  if (needsInfo) throw new NeedsInfoError(needsInfo);
  if (askUser) throw new AskUserError(askUser);
  if (flights) throw new FlightAnswerError(flights);
  if (!result)
    throw new NoticeError({ key: "Connection ended before the plan was ready. Please retry." });
  return result;
}

export { itineraryActivities } from "../trip/itinerary";

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
              (item.kind === "activity" || (section.id === "dining" && item.kind === "meal")) &&
              !item.id
                ? { ...item, id: crypto.randomUUID() }
                : item,
            ),
          }
        : undefined,
    })),
  };
}
