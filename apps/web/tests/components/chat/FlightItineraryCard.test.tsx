import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { FlightItineraryCard } from "@/components/chat/FlightItineraryCard";
import type { FlightAnswerOption } from "@trip/shared";

const leg = (
  from: string,
  to: string,
  departsAt: string,
  arrivesAt: string,
  flightNumber: string,
) => ({
  segments: [
    {
      from: { code: from, name: `${from} Airport` },
      to: { code: to, name: `${to} Airport` },
      departsAt,
      arrivesAt,
      durationMin: 600,
      airline: "Air Niugini",
      flightNumber,
      cabin: "Economy",
    },
  ],
  layovers: [{ place: { code: "POM", name: "Port Moresby" }, durationMin: 120 }],
  durationMin: 880,
});

const option: FlightAnswerOption = {
  carrier: "Air Niugini",
  price: 1055,
  roundTrip: true,
  outbound: leg("SYD", "NRT", "2026-11-25 07:20", "2026-11-25 20:00", "PX 2"),
  inbound: leg("NRT", "SYD", "2026-12-02 21:40", "2026-12-03 15:40", "PX 55"),
};

describe("FlightItineraryCard", () => {
  it("shows both directions of a round trip", () => {
    render(<FlightItineraryCard option={option} cheapest />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("Round trip · Economy")).toBeTruthy();
    expect(within(card).getByText("Cheapest")).toBeTruthy();
    expect(within(card).getByText("PX 2")).toBeTruthy();
    expect(within(card).getByText("PX 55")).toBeTruthy();
    // Airport codes and each airport's own local clock, as a boarding pass reads.
    expect(within(card).getAllByText("SYD")).toHaveLength(2);
    expect(within(card).getByText("7:20 am")).toBeTruthy();
    expect(within(card).getAllByText(/1 stop \(POM\)/)).toHaveLength(2);
  });

  it("marks an arrival that lands on a later day", () => {
    render(<FlightItineraryCard option={option} />);
    // The return leaves 2 Dec and lands 3 Dec; without the marker the times
    // read as a flight that arrives before it left.
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.queryByText("Cheapest")).toBeNull();
  });

  it("says a round trip's return was not looked up, rather than implying one way", () => {
    render(<FlightItineraryCard option={{ ...option, inbound: undefined }} />);
    expect(screen.getByText(/Return flights not looked up/)).toBeTruthy();
    expect(screen.getByText("Round trip · Economy")).toBeTruthy();
  });

  it("renders nothing for a fare with no flights behind it", () => {
    const { container } = render(
      <FlightItineraryCard option={{ carrier: "MockAir", price: 620 }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
