import { describe, expect, it } from "vitest";
import { progressCopy } from "../src/planning/progress-copy";

describe("progressCopy zh revision reasons", () => {
  it("writes every conflict reason template in Chinese", () => {
    const reason = [
      "infeasible budget: the cheapest flights and stays found already cost AUD 3,100.00, above the AUD 2,000.00 budget",
      "plan is 12.50% (AUD 250.00) over budget",
      "activity on day 1 starts before the flight arrives on day 1 at 14:30",
      "time overlap on day 2: 10:00-12:00 conflicts with 11:00-13:00",
      "geography conflict on day 3: 外滩 to 豫园 needs 35 minutes including a 15-minute buffer but only 15 are available",
      "geography conflict on day 4: route provider failed; connection unverified",
      "geography conflict on day 5: route provider unavailable for 上海 → 杭州",
      "geography conflict: day 6 transport does not end in the selected overnight city; activities were omitted",
      "geography conflict: no grounded places available; itinerary requires new evidence",
    ].join("; ");
    const copy = progressCopy("zh");
    const text = copy.fix(reason);
    expect(text.replaceAll("AUD", "")).not.toMatch(/[A-Za-z]/);
  });
});
