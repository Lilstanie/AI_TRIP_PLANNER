import type { TripPlan } from "@trip/shared";
import { sameDraft, type Draft, type Message } from "./workspace";

export function isBlankUntouchedChat(args: {
  plan?: TripPlan;
  messages: readonly Message[];
  input: string;
  draft: Draft;
  defaults: Draft;
}): boolean {
  const { plan, messages, input, draft, defaults } = args;
  return !plan && !messages.length && !input.trim() && sameDraft(draft, defaults);
}

export function showBriefChrome(args: {
  messages: readonly Message[];
  input: string;
  draft: Draft;
  defaults: Draft;
}): boolean {
  const { messages, input, draft, defaults } = args;
  return Boolean(messages.length) || Boolean(input.trim()) || !sameDraft(draft, defaults);
}
