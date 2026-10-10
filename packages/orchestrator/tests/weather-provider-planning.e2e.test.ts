import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { allSpecialists, runWithModelsDisabled } from "@trip/agents";
import type { MemoryStore, ToolGateway } from "@trip/shared";
import { createToolGateway } from "@trip/tools";
import { afterEach, expect, it, vi } from "vitest";
import { findAgentLabScenario } from "../src/agent-lab/scenarios";
import { runOrchestrator } from "../src/workflow";

const output = resolve(
  process.cwd(),
  "../../output/e2e/weather-provider-planning/with-coordinates",
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("keeps fixture weather facts and provenance through a complete Planning loop", async () => {
  vi.setSystemTime(new Date("2026-11-01T00:00:00.000Z"));
  vi.stubEnv("USE_MOCK_TOOLS", "true");
  const scenario = findAgentLabScenario("tokyo-kyoto-multi-city");
  const gateway = createToolGateway();
  const fixturePlaces = gateway.maps.places;
  const tools: ToolGateway = {
    ...gateway,
    maps: {
      ...gateway.maps,
      places: async (query) =>
        (await fixturePlaces(query)).map((place) => ({
          ...place,
          location: { latitude: 35.68, longitude: 139.69 },
        })),
    },
  };
  const mem: MemoryStore = {
    getShortTerm: async () => [],
    appendShortTerm: async () => {},
    getLongTerm: async () => scenario.preferences,
    setLongTerm: async () => {},
    promote: async () => {},
  };

  const plan = await runWithModelsDisabled(() =>
    runOrchestrator(scenario.brief, { specialists: allSpecialists, tools, mem, maxRounds: 1 }),
  );
  const destination = plan.sections.find((section) => section.id === "destination-guide");
  const weather = destination?.proposal?.items.find((item) => item.kind === "weather-packing");
  const checks = {
    weather:
      weather?.detail.startsWith(
        "Mostly clear with a mild daytime temperature; carry a light layer and check conditions again before departure.",
      ) === true &&
      destination?.proposal?.assumptions.includes(
        "Weather source: Mock weather fixture; forecast, valid until 2026-11-11T00:00:00.000Z; observed 2026-11-01T00:00:00.000Z.",
      ) === true,
    provenance:
      destination?.proposal?.source?.kind === "fallback" &&
      destination?.proposal?.source?.label === "Local fallback",
    plan:
      plan.tripId === scenario.brief.tripId &&
      plan.round === 1 &&
      plan.sections.length === 5 &&
      plan.estTotal === 3930,
    conflict: (plan.conflicts ?? []).length === 0,
  };
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  const saved = JSON.parse(readFileSync(resolve(output, "plan.json"), "utf8"));
  const summary = { passed: Object.values(checks).every(Boolean), checks };
  writeFileSync(resolve(output, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  expect(summary).toMatchObject({ passed: true });
  expect(saved).toEqual(plan);
});
