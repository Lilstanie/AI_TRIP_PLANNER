import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { dayConnections, ProposalDetails } from "@/components/trip/ProposalDetails";
import type { ArriveBy, TripSection as TripSectionModel } from "@trip/shared";

const dayPlan = (arriveBy?: ArriveBy): TripSectionModel => ({
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

const gettingAround: TripSectionModel = {
  id: "transport",
  label: "Getting around",
  summary: "One hop",
  status: "draft",
  estCost: 0,
  proposal: {
    agent: "transport",
    summary: "One hop",
    assumptions: [],
    conflictsWith: [],
    items: [
      {
        kind: "transport",
        detail: "Melbourne to Sydney",
        day: 1,
        location: "Melbourne → Sydney",
        startTime: "06:00",
        endTime: "07:35",
      },
    ],
  },
};

/** Getting around is given the legs the day plan worked out, as TripPanel gives them. */
const show = (arriveBy?: ArriveBy) =>
  render(
    <ProposalDetails section={gettingAround} connections={dayConnections([dayPlan(arriveBy)])} />,
  );

describe("intra-city legs in Getting around", () => {
  it("says how the traveller gets from one stop to the next, and where it ends", () => {
    show({ mode: "bus", durationMin: 45, line: "333", from: "Sydney Opera House" });
    expect(
      screen.getByText(/Bus 333 · 45 min from Sydney Opera House to Bondi Beach/),
    ).toBeTruthy();
  });

  it("reads an hour as hours, not as 75 minutes", () => {
    show({ mode: "train", durationMin: 75 });
    expect(screen.getByText(/Train · 1h 15m/)).toBeTruthy();
  });

  it("shows nothing for stops the planner could not connect", () => {
    const { container } = show();
    expect(container.querySelector(".proposal-connection")).toBeNull();
    // The hop itself is unaffected.
    expect(screen.getByText("Melbourne → Sydney")).toBeTruthy();
  });

  it("orders a leg against the hops by when the traveller arrives", () => {
    const { container } = show({ mode: "bus", durationMin: 45, from: "Sydney Opera House" });
    const rows = [...container.querySelectorAll(".proposal-item, .proposal-connection")];
    // The 06:00 flight comes before the stop reached at 12:00.
    expect(rows[0]?.className).toContain("proposal-item");
    expect(rows[1]?.className).toContain("proposal-connection");
  });

  it("leaves the day plan without connectors, so a leg is shown once", () => {
    const { container } = render(
      <ProposalDetails
        section={dayPlan({ mode: "bus", durationMin: 45, from: "Sydney Opera House" })}
      />,
    );
    expect(container.querySelector(".proposal-connection")).toBeNull();
  });
});
