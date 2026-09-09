"use client";

// Owner: E — single-user navigation.
export function Header({
  onNewTrip,
  onOpenTrips,
}: {
  onNewTrip: () => void;
  onOpenTrips: () => void;
}) {
  return (
    <header className="header">
      <span className="brand">AI Trip Planner</span>
      <nav>
        <button type="button" onClick={onNewTrip}>
          New trip
        </button>
        <button type="button" onClick={onOpenTrips}>
          Saved trips
        </button>
      </nav>
    </header>
  );
}
