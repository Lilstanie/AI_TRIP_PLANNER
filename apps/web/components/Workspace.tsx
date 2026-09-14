"use client";

import { useEffect, useRef, useState } from "react";
import type { TripPlan } from "@trip/shared";
import { ChatPanel } from "@/components/ChatPanel";
import { FiltersPanel } from "@/components/FiltersPanel";
import { TripPanel } from "@/components/TripPanel";
import { useLanguage } from "@/components/LanguageContext";

export function Workspace({ initialPlan }: { initialPlan: TripPlan }) {
  const { t } = useLanguage();
  const [plan, setPlan] = useState(initialPlan);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"chat" | "trip">("chat");
  const composerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setFilterOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [filterOpen]);

  return (
    <main className="workspace-shell">
      <div className="mobile-toolbar" aria-label="Workspace views">
        <button type="button" onClick={() => setFilterOpen(true)}>
          {t("Filters")}
        </button>
        <div className="mobile-tabs">
          <button
            type="button"
            aria-pressed={mobileView === "chat"}
            onClick={() => setMobileView("chat")}
          >
            {t("Chat")}
          </button>
          <button
            type="button"
            aria-pressed={mobileView === "trip"}
            onClick={() => setMobileView("trip")}
          >
            {t("Trip")}
          </button>
        </div>
      </div>

      <div className={`filters-slot ${filterOpen ? "filters-slot--open" : ""}`}>
        <FiltersPanel
          brief={plan.brief}
          onPlan={(nextPlan) => {
            setPlan(nextPlan);
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      </div>
      {filterOpen && (
        <button
          type="button"
          className="drawer-scrim"
          aria-label="Close filters"
          onClick={() => setFilterOpen(false)}
        />
      )}

      <div className={`chat-slot ${mobileView === "chat" ? "mobile-active" : ""}`}>
        <ChatPanel
          plan={plan}
          onPlan={setPlan}
          inputRef={composerRef}
          onOpenFilters={() => setFilterOpen(true)}
        />
      </div>

      <div className={`trip-slot ${mobileView === "trip" ? "mobile-active" : ""}`}>
        <TripPanel
          plan={plan}
          onReview={() => {
            setMobileView("chat");
            requestAnimationFrame(() => composerRef.current?.focus());
          }}
        />
      </div>
    </main>
  );
}
