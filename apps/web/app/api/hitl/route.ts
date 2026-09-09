import { NextResponse } from "next/server";
import { HitlDecision } from "@trip/shared";
import { recordHitlDecision } from "@trip/orchestrator";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (
    typeof body?.tripId !== "string" ||
    body.tripId.trim().length === 0 ||
    typeof body?.checkpointId !== "string" ||
    body.checkpointId.trim().length === 0 ||
    typeof body?.planVersion !== "string" ||
    body.planVersion.trim().length === 0
  ) {
    return NextResponse.json({ error: "invalid HITL decision" }, { status: 400 });
  }
  if (!new Set(["confirm-brief", "escalation"]).has(body.checkpointId.trim())) {
    return NextResponse.json({ error: "unknown HITL checkpoint" }, { status: 404 });
  }
  const parsed = HitlDecision.safeParse({
    checkpointId: body.checkpointId.trim(),
    planVersion: body.planVersion.trim(),
    status: body.status,
  });
  if (!parsed.success)
    return NextResponse.json({ error: "invalid HITL decision" }, { status: 400 });
  const decision = parsed.data;
  try {
    await recordHitlDecision(body.tripId.trim(), decision);
    return NextResponse.json({ decision });
  } catch (error) {
    console.error("[hitl] failed to persist decision", error);
    return NextResponse.json({ error: "Unable to save this decision." }, { status: 500 });
  }
}
