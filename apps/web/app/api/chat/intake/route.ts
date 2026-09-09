import { NextResponse } from "next/server";
import { runTripIntake } from "@trip/orchestrator";
import { TripIntakeRequest, TripIntakeResponse } from "@trip/shared";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = TripIntakeRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid TripIntakeRequest" }, { status: 400 });
  }

  try {
    return NextResponse.json(TripIntakeResponse.parse(await runTripIntake(parsed.data)));
  } catch (error) {
    console.error("[chat/intake] intake failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to understand this trip request." },
      { status: 422 },
    );
  }
}
