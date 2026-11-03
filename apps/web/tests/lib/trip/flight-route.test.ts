import { describe, expect, it } from "vitest";
import { flightRoute } from "@/lib/trip/timeline";

describe("flightRoute", () => {
  const flight = { from: "Perth", to: "Bali" };

  it("labels the outbound flight from origin to destination", () => {
    expect(flightRoute(flight, "in")).toBe("Perth → Bali");
  });

  it("labels the return flight from destination back to origin", () => {
    expect(flightRoute(flight, "out")).toBe("Bali → Perth");
  });
});
