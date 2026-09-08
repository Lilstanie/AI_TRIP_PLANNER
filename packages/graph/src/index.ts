// @trip/graph — the negotiation loop as a LangGraph StateGraph (Owner: A).
//
// Why a graph instead of the hand-rolled loop in @trip/orchestrator:
//   - the K-round revision loop is a conditional edge, so the framework owns
//     termination (converge OR round === MAX_ROUNDS);
//   - `interrupt()` gives a real HITL pause — the graph stops, the UI resumes it
//     with the user's decisions — instead of the placeholder buildHitl() list;
//   - a checkpointer persists per-trip state, so a later chat message (or a
//     server restart) resumes the same run.
//
// It reuses @trip/orchestrator/steps + detectConflicts verbatim, so behaviour
// matches runOrchestrator. Switch via USE_GRAPH=true (see apps/web/app/api/chat).

import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from "@langchain/langgraph";
import type {
  AgentProposal,
  HitlCheckpoint,
  RevisionRequest,
  TripBrief,
  TripPlan,
} from "@trip/shared";
import {
  MAX_ROUNDS,
  applyRevisions,
  assemblePlan,
  createRunContext,
  detectConflicts,
  dispatch,
} from "@trip/orchestrator";

type HitlDecision = "approved" | "rejected";
export type HitlDecisions = Record<string, HitlDecision>;

const GraphState = Annotation.Root({
  brief: Annotation<TripBrief>(),
  round: Annotation<number>({ reducer: (_prev, next) => next, default: () => 1 }),
  proposals: Annotation<AgentProposal[]>({ reducer: (_prev, next) => next, default: () => [] }),
  conflicts: Annotation<RevisionRequest[]>({ reducer: (_prev, next) => next, default: () => [] }),
  plan: Annotation<TripPlan | null>({ reducer: (_prev, next) => next, default: () => null }),
});
type GraphStateT = typeof GraphState.State;

function nextStep(state: GraphStateT): "revise" | "assemble" {
  return state.conflicts.length > 0 && state.round < MAX_ROUNDS ? "revise" : "assemble";
}

const workflow = new StateGraph(GraphState)
  .addNode("dispatch", async (state) => {
    const ctx = createRunContext(state.brief);
    const proposals = await dispatch(state.brief, ctx(1));
    return { proposals, round: 1, conflicts: detectConflicts(proposals, state.brief) };
  })
  .addNode("revise", async (state) => {
    const ctx = createRunContext(state.brief);
    const round = state.round + 1;
    const proposals = await applyRevisions(state.brief, ctx(round), state.proposals, state.conflicts);
    return { proposals, round, conflicts: detectConflicts(proposals, state.brief) };
  })
  .addNode("assemble", (state) => ({
    plan: assemblePlan(state.brief, state.proposals, state.conflicts, state.round),
  }))
  .addNode("hitl", (state) => {
    const plan = state.plan;
    if (!plan) return {};
    const pending = plan.hitl.filter((checkpoint) => checkpoint.status === "pending");
    if (pending.length === 0) return {};
    // Pause here. resumeGraph() supplies { checkpointId: "approved" | "rejected" }.
    const decisions = interrupt(pending) as HitlDecisions;
    const hitl: HitlCheckpoint[] = plan.hitl.map((checkpoint) =>
      decisions[checkpoint.id]
        ? { ...checkpoint, status: decisions[checkpoint.id]! }
        : checkpoint,
    );
    return { plan: { ...plan, hitl } };
  })
  .addEdge(START, "dispatch")
  .addConditionalEdges("dispatch", nextStep, { revise: "revise", assemble: "assemble" })
  .addConditionalEdges("revise", nextStep, { revise: "revise", assemble: "assemble" })
  .addEdge("assemble", "hitl")
  .addEdge("hitl", END);

const graph = workflow.compile({ checkpointer: new MemorySaver() });

export interface GraphRunResult {
  plan: TripPlan;
  /** true while the graph is paused at a HITL interrupt awaiting resumeGraph(). */
  awaitingUser: boolean;
}

function threadConfig(threadId: string) {
  return { configurable: { thread_id: threadId } };
}

async function settle(threadId: string): Promise<GraphRunResult> {
  const config = threadConfig(threadId);
  const snapshot = await graph.getState(config);
  const values = snapshot.values as GraphStateT;
  const awaitingUser = (snapshot.tasks ?? []).some(
    (task) => (task.interrupts ?? []).length > 0,
  );
  if (!values.plan) throw new Error("Graph settled without producing a plan.");
  return { plan: values.plan, awaitingUser };
}

/** Run the loop for `brief`. If it pauses at HITL, `awaitingUser` is true. */
export async function runGraph(brief: TripBrief, threadId = brief.tripId): Promise<GraphRunResult> {
  await graph.invoke({ brief }, threadConfig(threadId));
  return settle(threadId);
}

/** Resume a paused run with the user's HITL decisions. */
export async function resumeGraph(
  threadId: string,
  decisions: HitlDecisions,
): Promise<GraphRunResult> {
  await graph.invoke(new Command({ resume: decisions }), threadConfig(threadId));
  return settle(threadId);
}
