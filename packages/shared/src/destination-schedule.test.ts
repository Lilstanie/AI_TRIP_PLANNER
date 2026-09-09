import { describe, expect, it } from "vitest";
import { splitDestinationSchedule } from "./destination-schedule";

describe("destination schedule", () => {
  it("assigns remainder nights to the earlier cities", () => {
    expect(splitDestinationSchedule("Tokyo & Kyoto", 5)).toMatchObject([
      { city: "Tokyo", startDay: 1, nights: 3 },
      { city: "Kyoto", startDay: 4, nights: 2 },
    ]);
    expect(
      splitDestinationSchedule("Tokyo & Kyoto & Osaka", 8).map((stay) => stay.startDay),
    ).toEqual([1, 4, 7]);
  });
  it("requires enough nights for every city", () => {
    expect(() => splitDestinationSchedule("Tokyo & Kyoto", 1)).toThrow("overnight");
    expect(() => splitDestinationSchedule("Tokyo", 0)).toThrow("night");
  });
});
