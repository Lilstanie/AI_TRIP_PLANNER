import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TripSection } from "@/components/trip/TripSection";
import { TripPanel } from "@/components/trip/TripPanel";
import { plan } from "@/tests/fixtures/workspace";

describe("Trip drawer details", () => {
  it.each([
    [undefined, "Budget not set"],
    [0, "Budget not set"],
    [100, /over the AUD\s*100.00 budget/],
  ])("keeps a %s budget safe", (budgetTotal, expected) => {
    const trip = { ...plan, budgetTotal: budgetTotal as number, estTotal: 200 };
    const { container } = render(
      <TripPanel plan={trip} timeline={null} onEdit={() => {}} onReview={() => {}} />,
    );
    expect(screen.getByLabelText("Trip budget").textContent).toMatch(expected);
    expect(container.querySelector(".bar > span")?.getAttribute("style")).not.toMatch(/NaN|-/);
  });

  it("gives the day plan's legs to Getting around, not to the day plan", () => {
    const trip = structuredClone(plan);
    const itinerary = trip.sections.find((s) => s.id === "itinerary")!;
    itinerary.proposal!.items = [
      {
        kind: "activity",
        day: 1,
        startTime: "09:00",
        endTime: "11:00",
        detail: "A",
        location: "Museum",
      },
      {
        kind: "activity",
        day: 1,
        startTime: "12:00",
        endTime: "15:00",
        detail: "B",
        location: "Harbour",
        arriveBy: { mode: "bus", durationMin: 20, from: "Museum" },
      },
    ];
    // The fixture plan has only a day plan; Getting around has to exist to receive the legs.
    trip.sections = [
      ...trip.sections,
      {
        id: "transport",
        label: "Getting around",
        summary: "No hops",
        status: "draft",
        estCost: 0,
        proposal: {
          agent: "transport",
          summary: "No hops",
          assumptions: [],
          conflictsWith: [],
          items: [],
        },
      },
    ];
    const { container } = render(
      <TripPanel plan={trip} timeline={null} onEdit={() => {}} onReview={() => {}} />,
    );
    // Open every section so both candidates for the connector are rendered.
    for (const toggle of screen.getAllByRole("button", { expanded: false }))
      fireEvent.click(toggle);
    expect(
      container.querySelectorAll(".proposal-items--itinerary .proposal-connection"),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(".proposal-items--transport .proposal-connection").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Bus · 20 min from Museum to Harbour/)).toBeTruthy();
  });

  it("shows chronological day groups, missing prices and honest source fallback", () => {
    const section = structuredClone(plan.sections[0]!);
    section.proposal!.source = {
      kind: "fallback",
      label: "Local fallback",
      freshness: "The model was unavailable; a deterministic plan was used.",
    };
    section.proposal!.items = [
      { kind: "activity", day: 2, detail: "Second day", location: "Park" },
      { kind: "activity", day: 1, detail: "First day", location: "Museum", estCost: 0.01 },
    ];
    render(<TripSection section={section} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Day 1",
      "Day 2",
    ]);
    expect(screen.getByText("Price unknown")).toBeTruthy();
    expect(screen.getByText(/AUD\s*0.01/)).toBeTruthy();
    expect(screen.getByText("Fallback plan")).toBeTruthy();
    expect(screen.getByText("Local fallback")).toBeTruthy();
  });
  it("keeps restaurant suggestions unpriced alongside the meal budget", () => {
    const section = structuredClone(plan.sections[0]!);
    section.id = "dining";
    section.proposal!.items = [
      { kind: "meal-budget", detail: "Whole trip", estCost: 150 },
      { kind: "meal", location: "Example cafe", detail: "Suggested venue" },
    ];
    render(<TripSection section={section} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/not added again to the total/)).toBeTruthy();
    expect(screen.getByText("Price unknown")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Example cafe" })).toBeTruthy();
  });
  it("renders selected lodging facts and opens the hotel review action", () => {
    const section = structuredClone(plan.sections[0]!);
    section.id = "accommodation";
    section.proposal!.source = {
      kind: "live",
      label: "SerpApi Google Hotels",
      freshness: "Queried at 2026-09-21T00:00:00.000Z.",
    };
    section.proposal!.stays = [
      {
        id: "stay-1",
        city: "Sydney",
        day: 1,
        checkIn: "2026-10-01",
        checkOut: "2026-10-04",
        nights: 3,
        rooms: 2,
        selectedId: "hotel-a",
        candidates: [
          {
            id: "hotel-a",
            name: "Mock stay",
            area: "Central",
            rating: 8.5,
            freeCancellation: true,
            pricePerNight: 100,
            detailsUrl: "https://example.test/hotel",
          },
        ],
      },
    ];
    render(<TripSection section={section} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/AUD\s*600.00/)).toBeTruthy();
    expect(screen.getByText("2026-10-04")).toBeTruthy();
    expect(screen.getAllByText("Live data")).toHaveLength(2);
    expect(screen.getByText(/availability can change/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View property details" }).getAttribute("href")).toBe(
      "https://example.test/hotel",
    );
    // The button promised a chooser and opened the plan summary. The stay now
    // shows what it beat instead, which is the information that button implied.
    expect(screen.queryByRole("button", { name: "Review hotel choices" })).toBeNull();
  });
});
