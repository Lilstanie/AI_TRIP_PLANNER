import { describe, it, expect } from "vitest";
import { extractBriefPatchLocally } from "../src/chat-offline";

describe("offline extraction of origin and destination", () => {
  const cases: [string, string, string | undefined][] = [
    ["Plan a 4-day trip from Melbourne to Sydney for 2 people", "Sydney", "Melbourne"],
    ["Plan a trip to Sydney for 2 people departing Melbourne", "Sydney", "Melbourne"],
    ["Fly from Perth to Tokyo for 3 people", "Tokyo", "Perth"],

    ["Plan a 5-day trip to Seoul for 2 people", "Seoul", undefined],
    ["从墨尔本出发去悉尼玩", "悉尼", "墨尔本"],
    [
      "Plan Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000",
      "Tokyo",
      "Sydney",
    ],
    ["Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults", "Tokyo", "Sydney"],
    ["Plan Kyoto, 2027-02-01 to 2027-02-04", "Kyoto", undefined],
    ["Sydney, 2026-10-01 to 2026-10-05, 2 people", "Sydney", undefined],
  ];
  for (const [message, destination, origin] of cases) {
    it(`reads ${JSON.stringify(message)}`, () => {
      const patch = extractBriefPatchLocally(message);
      expect(patch.destination).toBe(destination);
      expect(patch.origin).toBe(origin);
    });
  }

  it("never reads a date as a city", () => {
    const patch = extractBriefPatchLocally(
      "Plan a trip to Sydney for 2 people from 2026-10-12 to 2026-10-16, total budget 4000 AUD.",
    );
    expect(patch.destination).toBe("Sydney");
    expect(patch.origin).toBeUndefined();
    expect(patch.dates).toEqual(["2026-10-12", "2026-10-16"]);
  });
});
