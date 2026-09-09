import { describe, expect, it } from "vitest";
import {
  buildIntakeBrief,
  extractIntakePatch,
  intakeQuestion,
  missingIntakeField,
} from "./tripIntake";

describe("trip onboarding intake", () => {
  it("extracts a destination from a concise Chinese first message", () => {
    expect(extractIntakePatch("去悉尼")).toEqual({ destination: "悉尼" });
  });

  it("collects explicit dates, travellers, and budget without inventing values", () => {
    expect(
      extractIntakePatch("2026-10-01 to 2026-10-05, 2 people, budget $3000"),
    ).toEqual({ dates: ["2026-10-01", "2026-10-05"], groupSize: 2, budgetTotal: 3000 });
  });

  it("accepts short numeric answers when the question gives them context", () => {
    expect(extractIntakePatch("2", "groupSize")).toEqual({ groupSize: 2 });
    expect(extractIntakePatch("3000", "budgetTotal")).toEqual({ budgetTotal: 3000 });
  });

  it("asks for the next missing field and builds a complete brief", () => {
    const draft = { destination: "Sydney" };
    expect(missingIntakeField(draft)).toBe("dates");
    expect(intakeQuestion("dates")).toContain("YYYY-MM-DD");
    expect(
      buildIntakeBrief(
        {
          destination: "Sydney",
          dates: ["2026-10-01", "2026-10-05"],
          groupSize: 2,
          budgetTotal: 3000,
        },
        "trip-1",
      ),
    ).toMatchObject({ destination: "Sydney", groupSize: 2, budgetTotal: 3000 });
  });
});
