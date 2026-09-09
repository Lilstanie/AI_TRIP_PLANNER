import { NextResponse } from "next/server";
import { HitlDecision } from "@trip/shared";
import { recordHitlDecision } from "@trip/orchestrator";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body?.tripId !== "string" || typeof body?.checkpointId !== "string") {
    return NextResponse.json({ error: "invalid HITL decision" }, { status: 400 });
  }
  const parsed = HitlDecision.safeParse({ checkpointId: body.checkpointId, status: body.status });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid HITL decision" }, { status: 400 });
  const decision = parsed.data;
  await recordHitlDecision(body.tripId, decision);
  return NextResponse.json({ decision });
}
