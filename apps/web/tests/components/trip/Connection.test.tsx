import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalDetails } from "@/components/trip/ProposalDetails";
import type { ArriveBy, TripSection as TripSectionModel } from "@trip/shared";

const section = (arriveBy?: ArriveBy): TripSectionModel => ({
  id: "itinerary",
  label: "Day plan",
  summary: "Two activities",
  status: "draft",
  estCost: 0,
  proposal: {
    agent: "itinerary",
    summary: "Two activities",
    assumptions: [],
    conflictsWith: [],
    items: [
      {
        kind: "activity",
        detail: "Sydney Opera House tour",
        day: 1,
        startTime: "09:00",
        endTime: "11:00",
        location: "Sydney Opera House",
      },
      {
        kind: "activity",
        detail: "Bondi Beach walk",
        day: 1,
        startTime: "12:00",
        endTime: "15:00",
        location: "Bondi Beach",
        ...(arriveBy ? { arriveBy } : {}),
      },
    ],
  },
});

const show = (arriveBy?: ArriveBy) =>
  render(<ProposalDetails section={section(arriveBy)} onReview={() => {}} />);

describe("connection between activities", () => {
  it("says how the traveller gets from one activity to the next", () => {
    show({ mode: "bus", durationMin: 45, line: "333", from: "Sydney Opera House" });
    expect(screen.getByText(/Bus 333 · 45 min from Sydney Opera House/)).toBeTruthy();
  });

  it("reads an hour as hours, not as 75 minutes", () => {
    show({ mode: "train", durationMin: 75 });
    expect(screen.getByText(/Train · 1h 15m/)).toBeTruthy();
  });

  it("shows nothing between activities the planner could not connect", () => {
    const { container } = show();
    expect(container.querySelector(".proposal-connection")).toBeNull();
    // The activities themselves are unaffected.
    expect(screen.getByText("Bondi Beach walk")).toBeTruthy();
  });
});
