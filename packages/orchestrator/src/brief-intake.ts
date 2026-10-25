import {
  TripBrief as TripBriefSchema,
  MAX_TRIP_PREFERENCE_LENGTH,
  MAX_TRIP_PREFERENCES,
  type ChatRequest,
  type ChatTurn,
  type TripBrief,
  type PartialTripBrief,
  type AssistantId,
  type ChatNeedsInfo,
  type ChatAskUser,
  type InterfaceLanguage,
} from "@trip/shared";
import { localCalendarDate } from "@trip/tools";
import { mergeBriefPatch, type BriefPatch } from "./brief";
import { extractBriefPatchLocally, statedTripDays } from "./chat-offline";
import { addDays } from "./dates";

export class IncompleteBriefError extends Error {
  constructor(
    readonly missing: string[],
    readonly known: PartialTripBrief = {},
    question?: string,
    readonly assistant?: AssistantId,
  ) {
    super(
      question ??
        `To start planning, include the ${missing.join(", ")}. You can also fill in Trip preferences.`,
    );
    this.name = "IncompleteBriefError";
  }

  get needsInfo(): ChatNeedsInfo {
    return {
      type: "needs_info",
      question: this.message,
      known: this.known,
      ...(this.assistant ? { assistant: this.assistant } : {}),
    };
  }
}

export class AskUserError extends Error {
  constructor(
    readonly askUser: ChatAskUser,
    readonly pendingBriefConfirmation?: ChatTurn["pendingBriefConfirmation"],
  ) {
    super(askUser.questions[0]?.question ?? "The assistant asked a question.");
    this.name = "AskUserError";
  }
}

const FIELD_LABELS: Record<string, string> = {
  destination: "destination",
  dates: "start and end dates",
  groupSize: "number of travellers",
  budgetTotal: "total budget",
};

export function missingFields(known: BriefPatch, tripId: string): string[] {
  const result = TripBriefSchema.safeParse({ ...known, tripId });
  if (result.success) return [];
  const names = new Set(
    result.error.issues.map((issue) => String(issue.path[0] ?? "")).filter(Boolean),
  );
  return [...names].flatMap((name) => (FIELD_LABELS[name] ? [FIELD_LABELS[name]] : []));
}

function pastDateAsk(brief: TripBrief, language: InterfaceLanguage | undefined): ChatAskUser {
  const chinese = language === "zh";
  const dates = `${brief.dates[0]} to ${brief.dates[1]}`;
  return {
    type: "ask_user",
    reply: chinese
      ? `已输入的日期 ${brief.dates[0]} 至 ${brief.dates[1]} 已经过去。回复“确认历史行程”以保留这些日期：${brief.dates[0]} 至 ${brief.dates[1]}。或发送新的日期。`
      : `The dates you entered, ${dates}, are in the past. Reply “Confirm historical trip” to keep these dates: ${dates}. Or send corrected dates.`,
    questions: [
      {
        id: "past-trip-dates",
        header: chinese ? "日期" : "Dates",
        question: chinese
          ? "这次旅行有日期已经过去。请确认是否要规划历史行程，或提供新的日期。"
          : "A date in this trip has already passed. Please confirm that you want a historical plan or provide new dates.",
        options: [
          { label: chinese ? "确认历史行程" : "Confirm historical trip" },
          { label: chinese ? "提供新的日期" : "Choose new dates" },
        ],
      },
    ],
    known: brief,
  };
}

function hasPastTripDate(
  brief: TripBrief,
  clock: () => Date,
  location?: ChatRequest["destinationLocation"],
): boolean {
  const today = localCalendarDate(clock(), location);
  return brief.dates.some((date) => date < today);
}

export function locationForBrief(
  request: ChatRequest,
  brief: { destination?: string },
): ChatRequest["destinationLocation"] {
  const location = request.destinationLocation;
  if (!location || !brief.destination) return undefined;
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase()
      .replace(/[.,，。;；]+$/u, "")
      .replace(/\s+/gu, " ");
  return normalize(location.destination) === normalize(brief.destination) ? location : undefined;
}

function explicitlyConfirmsHistoricalTrip(message: string): boolean {
  const confirmation =
    /^(?:(?:dates|date|日期)\s*:\s*)?(?:confirm historical trip|i confirm (?:that )?(?:this is|it is) (?:a )?historical trip|确认历史行程|确认这是历史行程)[.!。！]?$/i;
  return message.split(/\r?\n/u).some((line) => confirmation.test(line.trim()));
}

export type BriefReadiness =
  | { status: "ready"; brief: TripBrief }
  | { status: "incomplete"; missing: string[]; known: PartialTripBrief }
  | { status: "ambiguous_destination"; askUser: ChatAskUser }
  | {
      status: "historical_dates";
      askUser: ChatAskUser;
      pending: NonNullable<ChatTurn["pendingBriefConfirmation"]>;
    };

export class BriefIntake {
  private current: BriefPatch & Partial<Pick<TripBrief, "userId" | "accommodation">>;
  private readonly previousTurn: ChatTurn | undefined;

  constructor(
    private readonly request: ChatRequest,
    history: ChatTurn[],
    private readonly clock: () => Date,
  ) {
    this.previousTurn = [...history].reverse().find((turn) => turn.role === "assistant");
    this.current = mergeBriefPatch({}, { ...request.known, ...request.brief });
    if (request.brief) this.current = { ...request.brief, ...this.current };
    if (request.assistant?.memory === false) delete this.current.learnedPreferences;
  }

  get known(): PartialTripBrief {
    return this.current;
  }

  get confirmedDestination(): string | undefined {
    const destination = this.current.destination;
    const selectsDestination = this.request.message.split(/\r?\n/u).some((line) => {
      const answer = line.trim().replace(/^(?:destination|目的地)\s*[:：]\s*/iu, "");
      return answer.toLocaleLowerCase() === destination?.toLocaleLowerCase();
    });
    return destination === this.previousTurn?.confirmedBriefDestination ||
      destination === this.request.plan?.brief.destination ||
      (destination === this.request.known?.destination && selectsDestination)
      ? destination
      : undefined;
  }

  update(patch: BriefPatch, message: string): void {
    patch = { ...patch };
    const stated = extractBriefPatchLocally(message, this.current.groupSize);
    if (stated.groupSize !== undefined) {
      patch.groupSize = stated.groupSize;
      if (stated.party) patch.party = stated.party;
    } else if (patch.party && this.current.groupSize !== undefined) {
      patch.groupSize = this.current.groupSize;
    }
    const days = statedTripDays(message);
    const start = patch.dateStart ?? patch.dates?.[0] ?? this.current.dates?.[0];
    if (stated.dates) {
      patch.dates = stated.dates;
      [patch.dateStart, patch.dateEnd] = stated.dates;
    } else if (days && start) patch.dateEnd = addDays(start, days - 1);
    if (patch.destination?.toLowerCase() === "no preference") delete patch.destination;
    const dietary = message
      .split(/[.;!?。！？\n]/u)
      .map((part) => part.trim())
      .filter((part) =>
        /vegetarian|vegan|allerg|peanut|\bnuts?\b|halal|kosher|gluten|lactose|shellfish|素食|吃素|全素|过敏|過敏|花生|坚果|堅果|清真|麸质|麩質|乳糖/i.test(
          part,
        ),
      );
    if (dietary.length)
      patch.learnedPreferences = [
        ...new Set([
          ...dietary.map((part) => part.slice(0, MAX_TRIP_PREFERENCE_LENGTH)),
          ...(patch.learnedPreferences ?? this.current.learnedPreferences ?? []),
        ]),
      ].slice(0, MAX_TRIP_PREFERENCES);
    if (this.request.assistant?.memory === false) delete patch.learnedPreferences;
    this.current = mergeBriefPatch(this.current, patch);
  }

  readiness(): BriefReadiness {
    const { request } = this;
    const destination = this.current.destination;
    const pending = this.previousTurn?.pendingBriefConfirmation;
    if (destination && /\s+and\s+/iu.test(destination) && !this.confirmedDestination) {
      const chinese = request.interfaceLanguage === "zh";
      return {
        status: "ambiguous_destination",
        askUser: {
          type: "ask_user",
          known: this.current,
          ...(request.plan ? { plan: request.plan } : {}),
          questions: [
            {
              id: "destination-conjunction",
              header: chinese ? "目的地" : "Destination",
              question: chinese
                ? `“${destination}”是一个完整地名，还是多个目的地？保留完整地名，或用 & 分隔各站。`
                : `Is “${destination}” one place name or several destinations? Keep the name, or separate the stops with &.`,
              options: [
                { label: destination },
                { label: destination.replace(/\s+and\s+/giu, " & ") },
              ],
            },
          ],
        },
      };
    }
    const parsed = TripBriefSchema.safeParse({ ...this.current, tripId: request.tripId });
    if (!parsed.success)
      return {
        status: "incomplete",
        known: this.current,
        missing: missingFields(this.current, request.tripId),
      };
    const brief = parsed.data;
    const confirmed =
      explicitlyConfirmsHistoricalTrip(request.message) &&
      pending?.kind === "historical_dates" &&
      pending.dates.every((date, index) => date === brief.dates[index]);
    if (
      !request.plan &&
      hasPastTripDate(brief, this.clock, locationForBrief(request, brief)) &&
      !confirmed
    )
      return {
        status: "historical_dates",
        askUser: pastDateAsk(brief, request.interfaceLanguage),
        pending: { kind: "historical_dates", dates: brief.dates },
      };
    return { status: "ready", brief };
  }

  requireReady(question?: string): TripBrief {
    const result = this.readiness();
    if (result.status === "ready") return result.brief;
    if (result.status === "incomplete")
      throw new IncompleteBriefError(result.missing, result.known, question);
    throw new AskUserError(
      result.askUser,
      result.status === "historical_dates" ? result.pending : undefined,
    );
  }
}
