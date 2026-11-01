import { describe, expect, it, vi } from "vitest";
import type { FlightAnswer } from "@trip/shared";
import { FlightAnswerReady, runTripChat } from "../src/chat/chat";
import { brief, itinerary, memoryStore, scriptedModel, tools } from "./chat-test-fixtures";

const answer: FlightAnswer = {
  type: "flight_answer",
  reply: "悉尼 → 上海 2026-12-15，1 位旅客最便宜的是 Jetstar",
  from: "Sydney",
  to: "Shanghai",
  depart: "2026-12-15",
  return: "2027-01-05",
  passengers: 1,
  options: [{ carrier: "Jetstar", price: 1832 }],
};
const call = {
  name: "search_flights",
  id: "flights-1",
  args: { from: "Sydney", to: "Shanghai", depart: "2026-12-15", return: "2027-01-05" },
};

describe("the coordinator searches flights", () => {
  it("ends the turn with the fares it found, in the traveller's language", async () => {
    vi.mocked(itinerary.invoke).mockClear();
    const flightSearch = vi.fn(async () => answer);
    const { mem, turns } = memoryStore();

    await expect(
      runTripChat(
        { tripId: "flights", message: "下个月中旬悉尼飞上海，年后回来，有什么票" },
        {
          model: scriptedModel([call]),
          flightSearch,
          specialists: [itinerary],
          tools,
          mem,
        },
      ),
    ).rejects.toMatchObject({ answer });

    expect(flightSearch).toHaveBeenCalledWith({
      from: "Sydney",
      to: "Shanghai",
      depart: "2026-12-15",
      return: "2027-01-05",
      passengers: 1,
      cheapestFirst: false,
      language: "zh",
    });
    expect(itinerary.invoke).not.toHaveBeenCalled();
    expect(turns.at(-1)?.content).toBe(answer.reply);
  });

  it("prices the whole party already known for the trip", async () => {
    const flightSearch = vi.fn(async () => answer);

    await expect(
      runTripChat(
        { tripId: "flights-party", message: "any flights for this trip?", brief },
        {
          model: scriptedModel([call]),
          flightSearch,
          specialists: [itinerary],
          tools,
          mem: memoryStore().mem,
        },
      ),
    ).rejects.toBeInstanceOf(FlightAnswerReady);

    expect(flightSearch).toHaveBeenCalledWith(
      expect.objectContaining({ passengers: brief.groupSize }),
    );
  });

  it("returns a failed search to the model instead of ending the turn in an error", async () => {
    const flightSearch = vi.fn(async () => {
      throw new Error("provider down");
    });

    await expect(
      runTripChat(
        { tripId: "flights-down", message: "flights Sydney to Shanghai please", brief },
        {
          model: scriptedModel([call]),
          flightSearch,
          specialists: [itinerary],
          tools,
          mem: memoryStore().mem,
        },
      ),
    ).resolves.toBeDefined();
  });
});
