import { describe, expect, it } from "vitest";
import { translate } from "@/lib/i18n/locale";

describe("Latin values inside Chinese copy", () => {
  it("separates a Latin destination from the Chinese text around it", () => {
    expect(translate("zh", "tripToDestination", { destination: "Lisbon" })).toBe("Lisbon 之旅");
    expect(translate("zh", "destinationCouldNotBeShown", { destination: "Lisbon" })).toBe(
      "Lisbon 暂时还没法显示在地图上",
    );
  });

  it("keeps a Chinese destination joined and leaves English untouched", () => {
    expect(translate("zh", "tripToDestination", { destination: "巴厘岛" })).toBe("巴厘岛之旅");
    expect(translate("en", "tripToDestination", { destination: "Lisbon" })).toBe("Trip to Lisbon");
  });
});
