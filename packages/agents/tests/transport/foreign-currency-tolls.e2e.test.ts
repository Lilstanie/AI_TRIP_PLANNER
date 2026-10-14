import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AgentContext, type TripBrief } from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { transportAgent } from "../../src/transport";

const providerResponse = {
  routes: [
    {
      duration: "7200s",
      distanceMeters: 100_000,
      travelAdvisory: {
        tollInfo: { estimatedPrice: [{ currencyCode: "USD", units: "6" }] },
      },
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("foreign currency toll planning acceptance", () => {
  it("retains the partial toll cost and provider evidence in the chosen route plan", async () => {
    vi.stubEnv("USE_MOCK_TOOLS", "false");
    vi.stubEnv("MAPS_PROVIDER", "google");
    vi.stubEnv("MAPS_API_KEY", "fixture-key");
    vi.stubEnv("MAPS_API_BASE_URL", "https://routes.fixture.test");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("timezone"))
          return Response.json({ status: "OK", timeZoneId: "Asia/Tokyo" });
        if (url.includes("places.googleapis.com"))
          return Response.json({
            places: [{ location: { latitude: 35.6812, longitude: 139.7671 } }],
          });
        const body = JSON.parse(String(init?.body)) as {
          travelMode?: string;
          extraComputations?: string[];
        };
        if (body.travelMode === "DRIVE" && body.extraComputations?.includes("TOLLS"))
          return Response.json(providerResponse);
        if (body.travelMode === "DRIVE")
          return Response.json({ routes: [{ duration: "7200s", distanceMeters: 100_000 }] });
        return Response.json({ routes: [{ duration: "3600s", distanceMeters: 90_000 }] });
      }),
    );

    const gateway = createToolGateway();
    const brief: TripBrief = {
      tripId: "foreign-toll-acceptance",
      userId: "traveller",
      origin: "Tokyo",
      destination: "Kyoto",
      dates: ["2026-11-10", "2026-11-13"],
      groupSize: 2,
      budgetTotal: 4000,
      legModes: [{ from: "Tokyo", to: "Kyoto", mode: "drive" }],
    };
    const context: AgentContext = {
      tripId: brief.tripId,
      round: 1,
      tools: {
        maps: gateway.maps,
        booking: {
          searchFlights: vi.fn(async () => []),
          searchStays: vi.fn(async () => []),
        },
      },
      mem: {
        getLongTerm: vi.fn(async () => []),
        getShortTerm: vi.fn(async () => []),
        appendShortTerm: vi.fn(async () => {}),
        setLongTerm: vi.fn(async () => {}),
        promote: vi.fn(async () => {}),
      },
    };

    const options = await gateway.maps.routeOptions!({
      from: "Tokyo",
      to: "Kyoto",
      date: brief.dates[0],
      localTime: "09:00",
      intercity: true,
    });
    const drive = options.find((option) => option.mode === "drive");
    const proposal = await transportAgent.invoke({ brief, context });
    const route = proposal.items.find((item) => item.kind === "transport");

    expect(drive).toMatchObject({ price: 0, priceBasis: "partial" });
    expect(route?.detail).toContain("USD 6.00");
    expect(route?.detail).toContain("excluded from the AUD total");
    expect(route?.detail).toContain("partial");
    expect(route?.detail).not.toMatch(/no tolls/i);

    const output = resolve(process.cwd(), "../../output/e2e/foreign-currency-tolls");
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/provider-response.json`, JSON.stringify(providerResponse, null, 2));
    writeFileSync(`${output}/route-options.json`, JSON.stringify(options, null, 2));
    writeFileSync(`${output}/plan-proposal.json`, JSON.stringify(proposal, null, 2));
  });
});
