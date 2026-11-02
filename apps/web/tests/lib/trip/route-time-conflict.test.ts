import { describe, expect, it } from "vitest";
import type { TripPlan } from "@trip/shared";
import { placeConflicts } from "@/lib/trip/conflicts";
import { noticeText } from "@/lib/i18n/notice";

const planWith = (reason: string) =>
  ({ sections: [], conflicts: [{ reason }] }) as unknown as TripPlan;

describe("route time conflicts", () => {
  const sentence =
    "geography conflict on day 1: Mock attraction near 巴厘岛 to Mock Corner Bistro, 巴厘岛 needs 35 minutes including a 15-minute buffer but only 15 are available";

  it("stays on its day as a translated notice", () => {
    const notice = placeConflicts(planWith(sentence)).days.get(1)?.[0];
    expect(notice).toEqual({
      key: "routeNeedsMoreTime",
      params: {
        from: "Mock attraction near 巴厘岛",
        to: "Mock Corner Bistro, 巴厘岛",
        required: 35,
        available: 15,
      },
    });
    expect(noticeText("zh", notice!)).toBe(
      "从Mock attraction near 巴厘岛到Mock Corner Bistro, 巴厘岛约需 35 分钟（含 15 分钟缓冲），但中间只空出 15 分钟。",
    );
    expect(noticeText("en", notice!)).not.toContain("geography conflict");
  });

  it("keeps an unknown geography conflict on its day", () => {
    const other = "geography conflict on day 2: something new";
    expect(placeConflicts(planWith(other)).days.get(2)).toEqual([{ raw: other }]);
  });
});

describe("unchecked routes", () => {
  it("turns a route provider failure into a translated day notice", () => {
    const placement = placeConflicts(
      planWith("geography conflict on day 3: route provider failed; connection unverified"),
    );
    const notice = placement.days.get(3)?.[0];
    expect(notice).toEqual({ key: "routeCouldNotBeVerified" });
    expect(placement.budget).toEqual([]);
    expect(noticeText("zh", notice!)).toBe("路线没法核实。");
  });

  it.each([
    [
      "geography conflict on day 2: route provider unavailable for Sydney to the Sea → Wollongong",
      "Sydney to the Sea",
      "Wollongong",
    ],
    [
      "geography conflict on day 2: Bondi Beach to Manly Wharf: no route returned",
      "Bondi Beach",
      "Manly Wharf",
    ],
    [
      "geography conflict on day 2: Sydney → Wollongong: driving estimate cannot verify public transport timing",
      "Sydney",
      "Wollongong",
    ],
    [
      "geography conflict on day 2: Sydney → Wollongong: invalid route duration, fare or mode",
      "Sydney",
      "Wollongong",
    ],
  ])("names both stops for %s", (reason, from, to) => {
    const notice = placeConflicts(planWith(reason)).days.get(2)?.[0];
    expect(notice).toEqual({ key: "routeBetweenNotChecked", params: { from, to } });
    expect(noticeText("en", notice!)).toBe(`Couldn't check the route from ${from} to ${to}.`);
  });
});
