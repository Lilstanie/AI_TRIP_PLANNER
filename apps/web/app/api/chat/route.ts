// Owner: A — the chat entry point.
// Contract: POST ChatRequest -> ChatResponse (both in @trip/shared).
// TODO(A):
//   1. read short-term memory for this trip (ctx.mem)
//   2. use @trip/llm to turn `message` into / update a TripBrief
//   3. persist and return the fresh plan
import { NextResponse } from "next/server";
import { runOrchestrator, DEMO_BRIEF } from "@trip/orchestrator";
import { runGraph } from "@trip/graph";
import { ChatRequest, type ChatResponse } from "@trip/shared";

const USE_GRAPH = process.env.USE_GRAPH === "true";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid ChatRequest" }, { status: 400 });
  }

  // TODO(A): parse parsed.data.message into a TripBrief via @trip/llm + short-term
  // memory. For now every message just re-runs the demo brief.
  const brief = { ...DEMO_BRIEF, tripId: parsed.data.tripId };
  const plan = USE_GRAPH ? (await runGraph(brief)).plan : await runOrchestrator(brief);

  const engine = USE_GRAPH ? "LangGraph" : "orchestrator";
  const res: ChatResponse = {
    reply: `Ran the ${engine} (${plan.round} round${plan.round > 1 ? "s" : ""}). Wire real chat parsing in apps/web/app/api/chat/route.ts (A).`,
    plan,
  };
  return NextResponse.json(res);
}
