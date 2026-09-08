"use client";

// Owner: E — holds the live TripPlan on the client so a chat message can
// swap in a fresh plan without a full page reload.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { TripPanel } from "@/components/TripPanel";

const TripMap = dynamic(() => import("@/components/TripMap").then((module) => module.TripMap), {
  ssr: false,
  loading: () => <div className="trip-map trip-map--loading">Loading trip map…</div>,
});

export function Workspace({ initialPlan }: { initialPlan: TripPlan }) {
  const [plan, setPlan] = useState(initialPlan);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [openSectionId, setOpenSectionId] = useState<string>();

  useEffect(() => {
    setSelectedItemId(undefined);
    setOpenSectionId(undefined);
  }, [plan.tripId, plan.round]);

  const selectItem = useCallback((itemId: string, sectionId: string) => {
    setSelectedItemId(itemId);
    setOpenSectionId(sectionId);
  }, []);

  return (
    <main className="layout">
      <FiltersPanel brief={plan.brief} />
      <div className="workspace-center">
        <ChatPanel brief={plan.brief} onPlan={setPlan} />
        <TripMap mapData={plan.map} selectedItemId={selectedItemId} onSelect={selectItem} />
      </div>
      <TripPanel
        plan={plan}
        selectedItemId={selectedItemId}
        openSectionId={openSectionId}
        onSelectItem={selectItem}
        onToggleSection={(sectionId) =>
          setOpenSectionId((current) => (current === sectionId ? undefined : sectionId))
        }
      />
    </main>
  );
}
