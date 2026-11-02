import { describe, expect, it } from "vitest";
import { reusedPlacesNote } from "../src/chat/reused-places";

const place = (location: string, ...days: number[]) => ({ location, days });

describe("reused-place note", () => {
  it("keeps the single-stop sentence and folds several stops into one capped sentence", () => {
    expect(reusedPlacesNote([], "en")).toBe("");
    expect(reusedPlacesNote([place("Mock Bar", 1, 6)], "en")).toBe(
      "The plan reuses the same stop, Mock Bar, on Day 1, Day 6; this is one place repeated, not distinct activities.",
    );
    expect(reusedPlacesNote([place("酒吧", 1, 6)], "zh")).toBe(
      "行程在第 1 天、第 6 天重复使用了同一站点 酒吧，这是同一个地方，不是不同的活动。",
    );
    const many = [place("A", 1, 6), place("B", 2, 7), place("C", 3, 8), place("D", 4, 9)];
    expect(reusedPlacesNote(many, "en")).toBe(
      "4 stops repeat on more than one day: A (Day 1, Day 6); B (Day 2, Day 7); C (Day 3, Day 8); and 1 more. Each is one place repeated, not distinct activities.",
    );
    expect(reusedPlacesNote(many, "zh")).toBe(
      "有 4 个站点在不同天重复出现：A（第 1 天、第 6 天）、B（第 2 天、第 7 天）、C（第 3 天、第 8 天）等。这些是同一个地方，不是不同的活动。",
    );
  });
});
