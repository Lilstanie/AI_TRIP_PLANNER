import type { TripBrief } from "@trip/shared";

export type IntakeDraft = {
  destination?: string;
  dates?: [string, string];
  groupSize?: number;
  budgetTotal?: number;
};

export type IntakeField = "destination" | "dates" | "groupSize" | "budgetTotal";

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

function amount(value: string): number | undefined {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Extract only explicit onboarding fields; missing details stay missing. */
export function extractIntakePatch(message: string, expectedField?: IntakeField): IntakeDraft {
  const patch: IntakeDraft = {};
  const value = message.trim().replace(/[.!?。！？]+$/, "").trim();
  const dates = value.match(ISO_DATE);
  if (dates?.length && dates.length >= 2) patch.dates = [dates[0], dates[1]];

  if (expectedField === "groupSize" && /^\d+$/.test(value)) {
    patch.groupSize = amount(value);
  }
  if (expectedField === "budgetTotal" && /^\$?[\d,]+(?:\.\d+)?$/.test(value)) {
    patch.budgetTotal = amount(value.replace(/^\$/, ""));
  }

  const group = value.match(/(\d+)\s*(?:people|persons?|travell?ers?|人)/i);
  if (group?.[1]) patch.groupSize = amount(group[1]);
  if (!patch.groupSize) {
    const chineseGroup = value.match(/([一二两三四五六七八九十])\s*(?:个)?人/);
    const groups: Record<string, number> = {
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
    if (chineseGroup?.[1]) patch.groupSize = groups[chineseGroup[1]];
  }

  const budget =
    value.match(/(?:budget|预算(?:改成|调整为|是|为)?)[^\d]{0,12}(?:USD\s*)?\$?\s*([\d,]+(?:\.\d+)?)/i) ??
    value.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (budget?.[1]) patch.budgetTotal = amount(budget[1]);

  const englishDestination = value.match(
    /(?:trip|travel|holiday|go|going|visit)\s+(?:to|in)\s+([^,.;]+?)(?=\s+(?:for|from|between|on|with|budget)\b|$)/i,
  );
  const chineseDestination = value.match(
    /(?:去|前往|想去|目的地(?:是|为|改成|调整为)?)[：:\s]*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z&·\- ]*?)(?=\s*(?:旅行|旅游|玩|，|,|。|预算|\d{4}-|$))/u,
  );
  const explicitDestination = value.match(
    /(?:destination|place)(?:\s+(?:is|to|as))?\s*[:=]?\s+(.+?)(?=\s+(?:and\s+)?(?:for|from|between|on|with|budget)\b|[,.;]|$)/i,
  );
  const destination = englishDestination?.[1] ?? chineseDestination?.[1] ?? explicitDestination?.[1];
  if (destination && !/\d/.test(destination)) patch.destination = destination.trim();

  // A short, standalone city name is the most common first message.
  if (!patch.destination && !/\d/.test(value) && value.split(/\s+/).length <= 4) {
    if (!/\b(?:plan|trip|travel|holiday|budget|people|person|date|when|help|please)\b/i.test(value)) {
      if (/^[\p{L}\p{M}][\p{L}\p{M} &'·.\-]*$/u.test(value)) patch.destination = value;
    }
  }

  return patch;
}

export function missingIntakeField(draft: IntakeDraft): IntakeField | undefined {
  if (!draft.destination) return "destination";
  if (!draft.dates) return "dates";
  if (!draft.groupSize) return "groupSize";
  if (!draft.budgetTotal) return "budgetTotal";
  return undefined;
}

export function intakeQuestion(field: IntakeField): string {
  switch (field) {
    case "destination":
      return "Which destination would you like to visit?";
    case "dates":
      return "What dates would you like to travel? Please use YYYY-MM-DD to YYYY-MM-DD.";
    case "groupSize":
      return "How many travellers are going?";
    case "budgetTotal":
      return "What is your total budget in USD?";
  }
}

export function buildIntakeBrief(draft: IntakeDraft, tripId: string): TripBrief | undefined {
  if (missingIntakeField(draft)) return undefined;
  return {
    tripId,
    userId: "demo-user",
    destination: draft.destination!,
    dates: draft.dates!,
    groupSize: draft.groupSize!,
    budgetTotal: draft.budgetTotal!,
  };
}
