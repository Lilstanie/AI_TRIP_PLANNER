"use client";

// Owner: E — owns the new-trip state and saved-trip navigation.
import { useCallback, useEffect, useState } from "react";
import type { ChatTurn, TripListResponse, TripPlan, TripSession, TripSummary } from "@trip/shared";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { Header } from "@/components/Header";
import { TripPanel } from "@/components/TripPanel";

export function Workspace() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [initialTurns, setInitialTurns] = useState<ChatTurn[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>();
  const [chatKey, setChatKey] = useState(0);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string>();

  const refreshTrips = useCallback(async () => {
    try {
      const response = await fetch("/api/trips", { cache: "no-store" });
      const data = (await response.json()) as TripListResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load saved trips.");
      setTrips(data.trips);
      setHistoryError(undefined);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Unable to load saved trips.");
    }
  }, []);

  useEffect(() => {
    void refreshTrips();
  }, [refreshTrips]);

  function acceptPlan(nextPlan: TripPlan) {
    setPlan(nextPlan);
    setActiveTripId(nextPlan.tripId);
    void refreshTrips();
  }

  function newTrip() {
    setPlan(null);
    setInitialTurns([]);
    setActiveTripId(undefined);
    setHistoryOpen(false);
    setChatKey((value) => value + 1);
  }

  async function openTrip(tripId: string) {
    setHistoryBusy(true);
    setHistoryError(undefined);
    try {
      const response = await fetch(`/api/trips?tripId=${encodeURIComponent(tripId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as TripSession & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to open this trip.");
      setPlan(data.trip.plan);
      setInitialTurns(data.turns);
      setActiveTripId(data.trip.tripId);
      setHistoryOpen(false);
      setChatKey((value) => value + 1);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Unable to open this trip.");
    } finally {
      setHistoryBusy(false);
    }
  }

  return (
    <>
      <Header onNewTrip={newTrip} onOpenTrips={() => setHistoryOpen(true)} />
      <main className={plan ? "layout" : "welcome-layout"}>
        {plan && <FiltersPanel key="filters" brief={plan.brief} onPlan={acceptPlan} />}
        <ChatPanel
          key={`chat-${chatKey}`}
          plan={plan}
          initialTripId={activeTripId}
          initialTurns={initialTurns}
          onPlan={acceptPlan}
        />
        {plan && <TripPanel key="trip" plan={plan} />}
        <div className="version-badge" aria-label="Current application and plan version">
          Stage 5.3{plan ? ` · Plan ${plan.planVersion.slice(0, 8)}` : ""}
        </div>
      </main>

      {historyOpen && (
        <div
          className="history-overlay"
          role="presentation"
          onMouseDown={() => setHistoryOpen(false)}
        >
          <aside
            className="history-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-trips-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="history-drawer__head">
              <div>
                <h2 id="saved-trips-title">Saved trips</h2>
                <p>Your conversations and latest plans are saved automatically.</p>
              </div>
              <button
                type="button"
                aria-label="Close saved trips"
                onClick={() => setHistoryOpen(false)}
              >
                ×
              </button>
            </div>
            {historyError && (
              <p className="form-status form-status--error" role="alert">
                {historyError}
              </p>
            )}
            {!historyError && trips.length === 0 && (
              <p className="history-empty">No saved trips yet.</p>
            )}
            <div className="history-list" aria-busy={historyBusy}>
              {trips.map((trip) => (
                <button
                  type="button"
                  className="history-trip"
                  disabled={historyBusy}
                  onClick={() => openTrip(trip.tripId)}
                  key={trip.tripId}
                >
                  <strong>{trip.title}</strong>
                  <span>{trip.destination ?? "Conversation started"}</span>
                  <small>
                    {new Date(trip.updatedAt).toLocaleString()} ·{" "}
                    {trip.planVersion
                      ? `Plan ${trip.planVersion.slice(0, 8)}`
                      : "Planning not completed"}
                  </small>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
