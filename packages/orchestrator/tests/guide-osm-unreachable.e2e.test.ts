import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { destinationGuideAgent, itineraryAgent, runWithModelsDisabled } from "@trip/agents";
import type { AgentProgressEvent, MemoryStore, TripBrief } from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runOrchestrator } from "../src/planning/workflow";

const output = resolve(process.cwd(), "../../output/e2e/guide-osm-unreachable");
const closed = await new Promise<string>((done) => {
  const server = createServer().listen(0, "127.0.0.1", () => {
    const { port } = server.address() as { port: number };
    server.close(() => done(`http://127.0.0.1:${port}`));
  });
});

const brief: TripBrief = {
  tripId: "guide-osm-unreachable",
  userId: "guide-osm-unreachable",
  destination: "Lisbon",
  origin: "Sydney",
  dates: ["2027-03-10", "2027-03-13"],
  groupSize: 2,
  budgetTotal: 6000,
};

const mem: MemoryStore = {
  getShortTerm: async () => [],
  appendShortTerm: async () => {},
  getLongTerm: async () => [],
  setLongTerm: async () => {},
  promote: async () => {},
};

const realFetch = globalThis.fetch;
let requests: string[] = [];

beforeEach(() => {
  vi.stubEnv("USE_MOCK_TOOLS", "false");
  vi.stubEnv("MAPS_PROVIDER", "osm");
  vi.stubEnv("MAPS_API_KEY", "");
  vi.stubEnv("SERPAPI_KEY", "");
  for (const name of [
    "NOMINATIM_BASE_URL",
    "OVERPASS_BASE_URL",
    "OSRM_BASE_URL",
    "PHOTON_BASE_URL",
  ])
    vi.stubEnv(name, closed);
  requests = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(url);
    if (!url.startsWith(closed)) throw new Error(`request left the machine: ${url}`);
    return realFetch(input, init);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("plans the guide and itinerary without invented places when OpenStreetMap is unreachable", async () => {
  const events: AgentProgressEvent[] = [];
  const result = await runWithModelsDisabled(() =>
    runOrchestrator(brief, {
      specialists: [itineraryAgent, destinationGuideAgent],
      tools: createToolGateway(),
      mem,
      maxRounds: 1,
      onProgress: (event) => events.push(event),
    }),
  ).catch((error: unknown) => error);

  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, "plan.json"),
    `${JSON.stringify(
      {
        brief,
        failure: result instanceof Error ? result.message : null,
        requests,
        events,
        plan: result instanceof Error ? null : result,
      },
      null,
      2,
    )}\n`,
  );

  expect(events.filter((event) => event.type === "agent_failed")).toEqual([]);
  expect(result).not.toBeInstanceOf(Error);
  const plan = result as Awaited<ReturnType<typeof runOrchestrator>>;
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => url.startsWith(closed))).toBe(true);

  const guide = plan.sections.find((section) => section.id === "destination-guide")?.proposal;
  expect(guide?.source).toMatchObject({ kind: "unavailable", label: "Maps provider" });
  expect(guide?.items.filter((item) => item.kind === "attraction")).toEqual([]);
  expect(guide?.items.map((item) => item.kind)).toEqual([
    "customs",
    "safety",
    "entry-health",
    "weather-packing",
  ]);
  expect(guide?.assumptions).toEqual(
    expect.arrayContaining([
      "Place provider unavailable for sight in Lisbon; using only remaining evidence.",
      "Place provider unavailable for museum in Lisbon; using only remaining evidence.",
    ]),
  );

  const itinerary = plan.sections.find((section) => section.id === "itinerary")?.proposal;
  expect(itinerary?.source?.kind).toBe("unavailable");
  expect(itinerary?.items).toEqual([]);
});

it("stops the guide when the plan is cancelled while a place lookup fails", async () => {
  const controller = new AbortController();
  const tools = createToolGateway();
  const places = tools.maps.places.bind(tools.maps);
  tools.maps.places = async (query) => {
    controller.abort();
    return places(query);
  };

  const failure = await runWithModelsDisabled(() =>
    destinationGuideAgent.invoke({
      brief,
      context: { tripId: brief.tripId, round: 1, tools, mem, signal: controller.signal },
    }),
  ).catch((error: unknown) => error);

  expect(failure).toMatchObject({ name: "AbortError" });
});
