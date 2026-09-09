"use client";

// Owner: E — holds the live TripPlan on the client so a chat message can
// swap in a fresh plan without a full page reload.
import { useState } from "react";
import type { TripPlan } from "@trip/shared";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { TripPanel } from "@/components/TripPanel";

export function Workspace({ initialPlan }: { initialPlan: TripPlan }) {
  const [plan, setPlan] = useState(initialPlan);

  return (
    <main className="layout">
      <FiltersPanel brief={plan.brief} onPlan={setPlan} />
      <ChatPanel plan={plan} onPlan={setPlan} />
      <TripPanel plan={plan} />
      <div className="version-badge" aria-label="Current application and plan version">
        Stage 5.3 · Plan {plan.planVersion.slice(0, 8)}
      </div>
    </main>
  );
}
