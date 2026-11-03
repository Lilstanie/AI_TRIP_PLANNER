import { describe, expect, it } from "vitest";

import { translate } from "@/lib/i18n/locale";

describe("trip suggestion count", () => {
  it("keeps the count with its measure word so the banner cannot wrap between them", () => {
    expect(
      translate("zh", "countUnscheduledIdeasInDestination", { count: 5, destination: "巴厘岛" }),
    ).toBe("巴厘岛还有 5 个备选地点没排进日程");
    expect(translate("zh", "n1UnscheduledIdeaInDestination", { destination: "巴厘岛" })).toBe(
      "巴厘岛还有 1 个备选地点没排进日程",
    );
  });
});
