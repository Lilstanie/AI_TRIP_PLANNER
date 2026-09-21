import { NextResponse } from "next/server";
import { HitlRequest } from "@trip/shared";
import { applyHitl } from "@trip/orchestrator";
import { parseDataMode, runWithDataMode } from "@trip/tools";
import { tripStore } from "@trip/services";

export async function POST(req: Request) {
  const parsed = HitlRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid decision request." }, { status: 400 });
  try {
    const plan = await runWithDataMode(parseDataMode(req.headers.get("x-trip-data-mode")), () =>
      applyHitl(parsed.data),
    );
    await tripStore.set(plan);
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to apply this decision." },
      { status: 422 },
    );
  }
}
