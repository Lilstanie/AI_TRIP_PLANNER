import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { FlightResults } from "@/components/chat/FlightResults";
import type { FlightAnswer } from "@trip/shared";

const answer: FlightAnswer = {
  type: "flight_answer",
  reply: "Cheapest Sydney → Seoul …",
  from: "Sydney",
  to: "Seoul",
  depart: "2026-11-25",
  return: "2026-12-02",
  passengers: 2,
  options: [
    { carrier: "Jetstar", price: 367, stops: 1, durationMin: 745 },
    { carrier: "Qantas", price: 980, stops: 0 },
  ],
};

describe("FlightResults", () => {
  it("shows the route, the party and each fare", () => {
    render(<FlightResults answer={answer} />);
    const card = screen.getByRole("region", { name: "Fares from Sydney to Seoul" });
    expect(within(card).getByText("Sydney → Seoul")).toBeTruthy();
    expect(within(card).getByText(/2026-11-25 – 2026-12-02 · 2 travellers/)).toBeTruthy();
    expect(within(card).getByText("Jetstar")).toBeTruthy();
    expect(within(card).getByText("1 stop · 12h 25m")).toBeTruthy();
    expect(within(card).getByText("Nonstop")).toBeTruthy();
  });

  it("says the totals are for the whole party and books nothing", () => {
    render(<FlightResults answer={answer} />);
    expect(screen.getByText(/Whole-party totals/)).toBeTruthy();
    expect(screen.getByText(/makes a booking/)).toBeTruthy();
  });

  it("states plainly when nothing came back", () => {
    render(<FlightResults answer={{ ...answer, options: [] }} />);
    expect(screen.getByText(/No fares were returned/)).toBeTruthy();
  });

  it("reads a single traveller as one, not '1 travellers'", () => {
    render(<FlightResults answer={{ ...answer, passengers: 1, return: undefined }} />);
    expect(screen.getByText(/2026-11-25 · 1 traveller$/)).toBeTruthy();
  });
});
