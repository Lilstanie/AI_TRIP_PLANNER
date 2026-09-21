// @trip/agents — the specialist agent registry the Orchestrator dispatches to.
// Each agent lives in its own folder; owners: B / C / D (see folder headers).
// This file is a stable registry — avoid churn here so nobody blocks each other.

import type { Specialist } from "@trip/shared";
import { itineraryAgent } from "./itinerary";
import { transportAgent } from "./transport";
import { accommodationAgent } from "./accommodation";
import { destinationGuideAgent } from "./destination-guide";
import { diningAgent } from "./dining";

// The orchestrator consumes one stable list while callers can import an
// individual specialist (and its factory/types) from the exports below.
export const allSpecialists: Specialist[] = [
  itineraryAgent,
  transportAgent,
  accommodationAgent,
  destinationGuideAgent,
  diningAgent,
];

export {
  itineraryAgent,
  createItineraryAgent,
  type ItineraryAgentOptions,
  type ItineraryDraft,
  type ItineraryGenerator,
} from "./itinerary";
export {
  destinationGuideAgent,
  createDestinationGuideAgent,
  type DestinationGuideAgentOptions,
  type DestinationGuideDraft,
  type DestinationGuideGenerator,
} from "./destination-guide";
export {
  diningAgent,
  createDiningAgent,
  type DiningAgentOptions,
  type DiningDraft,
  type DiningGenerator,
} from "./dining";
export { CAPABILITIES } from "./prompts/capabilities";
export {
  MODEL_ROUTING,
  createRoutedChatModel,
  createRoutedStructuredInvoker,
  type RoutedModelOptions,
  type RoutedModelTask,
} from "./models";
export {
  assembleChunks,
  messageText,
  withReasoningStream,
  type ReasoningListener,
} from "./reasoning";
export { transportAgent, accommodationAgent };
