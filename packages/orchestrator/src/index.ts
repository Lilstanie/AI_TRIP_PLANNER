// @trip/orchestrator — public API for the LangGraph-backed trip workflow.

export { DEMO_BRIEF } from "./demo";
export {
  IncompleteBriefError,
  runTripChat,
  type BriefExtractor,
  type TripChatOptions,
} from "./chat";
export { applyBriefPatch, type BriefPatch } from "./brief";
export { extractBriefPatchLocally } from "./chat-offline";
export { parseFlightQuery, type FlightQuery } from "./flight-query";
export { answerFlightQuery } from "./flight-answer";
export { parseTripDate, isAmbiguous } from "./dates";
export {
  createOrchestratorGraph,
  detectConflicts,
  runOrchestrator,
  type OrchestratorOptions,
} from "./workflow";
export { rollUpCost } from "./budget";
export {
  createSupervisorTools,
  createRevisionTools,
  dispatchWithSupervisor,
  reviseWithSupervisor,
  type SupervisorDispatchOptions,
  type SupervisorRevisionOptions,
} from "./supervisor";

export { applyHitl, checkpointsFor } from "./hitl";
