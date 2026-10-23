import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { runWithModelsDisabled } from "@trip/agents";
import { runTripChat } from "../src/chat";
import { memoryStore, ReplyOverrideModel, tools, itinerary } from "./chat-test-fixtures";

it("TP-39: the coordinator receives truthful weather capability and horizon limits", async () => {
  const model = new ReplyOverrideModel("Weather advice uses dated provider evidence.");
  const calls = vi.spyOn(model, "_generate");
  await runWithModelsDisabled(() =>
    runTripChat(
      { tripId: "TP-39", message: "Can you help with weather?" },
      {
        model,
        mem: memoryStore().mem,
        tools,
        specialists: [itinerary],
      },
    ),
  ).catch(() => undefined);
  const prompt = JSON.stringify(calls.mock.calls);
  const checks = {
    coordinatorInvoked: calls.mock.calls.length > 0,
    noStaleDenial: !prompt.includes("未接入实时天气"),
    forecastBoundary: prompt.includes("14 天内"),
    climateIsNotForecast: prompt.includes("历史气候参考（不是预报）"),
    unavailableIsExplicit: prompt.includes("数据不可用时明确说明"),
  };
  const output = resolve(process.cwd(), "../../output/e2e/TP-39");
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, "capability-prompt.json"),
    JSON.stringify({ checks, prompt }, null, 2),
  );
  expect(Object.values(checks).every(Boolean)).toBe(true);
});
