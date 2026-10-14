import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { accommodationAgent, runWithModelsDisabled } from "@trip/agents";
import type { AgentProgressEvent, MemoryStore, TripBrief } from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { afterEach, expect, it, vi } from "vitest";
import { withProgressTools } from "../src/progress-tools";
import { runOrchestrator } from "../src/workflow";

const output = resolve(
  process.cwd(),
  "../../output/e2e/booking-provider-planning/serpapi-osm-fallback",
);

const brief: TripBrief = {
  tripId: "booking-provider-planning",
  userId: "booking-provider-planning",
  destination: "Tokyo",
  dates: ["2026-02-01", "2026-02-04"],
  groupSize: 2,
  budgetTotal: 3000,
};

const mem: MemoryStore = {
  getShortTerm: async () => [],
  appendShortTerm: async () => {},
  getLongTerm: async () => [],
  setLongTerm: async () => {},
  promote: async () => {},
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("preserves the hotel provider failure through accommodation planning", async () => {
  vi.stubEnv("USE_MOCK_TOOLS", "false");
  vi.stubEnv("MAPS_PROVIDER", "osm");
  vi.stubEnv("MAPS_API_KEY", "");
  vi.stubEnv("SERPAPI_KEY", "serp-key");
  const requests: string[] = [];
  const networkFailure = vi.fn(async (input: string | URL | Request) => {
    requests.push(String(input));
    throw new Error("synthetic SerpApi network failure");
  });
  vi.stubGlobal("fetch", networkFailure);
  const events: AgentProgressEvent[] = [];
  const failure = await runWithModelsDisabled(() =>
    runOrchestrator(brief, {
      specialists: [accommodationAgent],
      tools: withProgressTools(createToolGateway(), "accommodation", 1, (event) =>
        events.push(event),
      ),
      mem,
      maxRounds: 1,
      onProgress: (event) => events.push(event),
    }),
  ).catch((error: unknown) => error);

  expect(failure).toMatchObject({ name: "SerpApiError", reason: "request_failed" });
  expect((failure as Error).message).toContain("synthetic SerpApi network failure");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("serpapi.com");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool_failed",
      agent: "accommodation",
      tool: "booking.searchStays",
      error: "Stay search could not complete. Retry the plan or adjust the stay details.",
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "agent_failed",
      agent: "accommodation",
      error: "This specialist could not finish. Retry the request.",
    }),
  );
  expect(events).not.toContainEqual(
    expect.objectContaining({ type: "agent_completed", agent: "accommodation" }),
  );

  mkdirSync(output, { recursive: true });
  const artifact = {
    brief,
    failure: {
      name: (failure as Error).name,
      reason: (failure as { reason: string }).reason,
      message: (failure as Error).message,
    },
    requests,
    events,
  };
  writeFileSync(resolve(output, "osm-no-google.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  expect(JSON.parse(JSON.stringify(artifact))).toMatchObject({
    failure: { name: "SerpApiError", reason: "request_failed" },
    requests: [expect.stringContaining("serpapi.com")],
  });
});

it("uses only configured Google Places estimates after SerpApi hotel failure", async () => {
  vi.stubEnv("USE_MOCK_TOOLS", "false");
  vi.stubEnv("MAPS_PROVIDER", "google");
  vi.stubEnv("MAPS_API_KEY", "maps-key");
  vi.stubEnv("SERPAPI_KEY", "serp-key");
  const requests: string[] = [];
  const network = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("serpapi.com")) throw new Error("synthetic SerpApi network failure");
    if (url.includes("places.googleapis.com"))
      return Response.json({
        places: [
          {
            displayName: { text: "Grounded Tokyo Hotel" },
            rating: 4.5,
            priceLevel: "PRICE_LEVEL_MODERATE",
            formattedAddress: "Tokyo, Japan",
          },
        ],
      });
    throw new Error(`unexpected provider request: ${url}`);
  });
  vi.stubGlobal("fetch", network);
  const events: AgentProgressEvent[] = [];
  const plan = await runWithModelsDisabled(() =>
    runOrchestrator(brief, {
      specialists: [accommodationAgent],
      tools: createToolGateway(),
      mem,
      maxRounds: 1,
      onProgress: (event) => events.push(event),
    }),
  );
  const accommodation = plan.sections.find((section) => section.id === "accommodation");

  expect(accommodation?.proposal?.stays?.[0]?.candidates?.[0]).toMatchObject({
    name: "Grounded Tokyo Hotel",
    pricePerNight: 225,
    grounded: true,
  });
  expect(accommodation?.proposal?.source).toMatchObject({
    kind: "estimated",
    label: "Google Places estimate",
  });
  expect(accommodation?.proposal?.source?.freshness).toContain(
    "SerpApi Google Hotels was unavailable (request_failed); Google Places estimate was used.",
  );
  expect(requests.some((url) => url.includes("serpapi.com"))).toBe(true);
  expect(requests.some((url) => url.includes("places.googleapis.com"))).toBe(true);
  expect(events).toContainEqual(
    expect.objectContaining({ type: "agent_completed", agent: "accommodation" }),
  );
  expect(events).not.toContainEqual(
    expect.objectContaining({ type: "agent_failed", agent: "accommodation" }),
  );

  const artifact = { brief, plan, requests, events };
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, "google-configured.json"),
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
  expect(JSON.parse(JSON.stringify(artifact))).toMatchObject({
    plan: {
      sections: [
        expect.objectContaining({
          id: "accommodation",
          proposal: expect.objectContaining({
            source: expect.objectContaining({ kind: "estimated" }),
          }),
        }),
      ],
    },
  });
});
