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

  it("keeps other geography conflicts on their day", () => {
    const other = "geography conflict on day 2: route provider failed; connection unverified";
    expect(placeConflicts(planWith(other)).days.get(2)).toBeDefined();
  });
});
