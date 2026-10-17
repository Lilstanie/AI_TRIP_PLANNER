import { agentLabBenchmark } from "@trip/orchestrator";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(agentLabBenchmark, {
    headers: { "Cache-Control": "no-store" },
  });
}
