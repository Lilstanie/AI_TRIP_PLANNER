import type { Specialist } from "@trip/shared";
import { itineraryAgent } from "./itinerary";
import { transportAgent } from "./transport";
import { accommodationAgent } from "./accommodation";
import { destinationGuideAgent } from "./destination-guide";
import { diningAgent } from "./dining";

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
  createUsageCollector,
  runWithModelsDisabled,
  runWithUsageCollector,
  type RoutedModelOptions,
  type RoutedModelTask,
  type UsageCollector,
  type UsageSnapshot,
} from "./models";
export { withReasoningStream, type ReasoningListener } from "./reasoning";
export { transportAgent, accommodationAgent };
