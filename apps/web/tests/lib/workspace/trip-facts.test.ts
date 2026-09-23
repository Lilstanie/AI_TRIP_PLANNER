import { describe, expect, it } from "vitest";
import { blankDraft, draftFor } from "@/lib/workspace";
import {
  FACT_FIELDS,
  FACTS,
  datesLabel,
  factErrors,
  factLabels,
  firstFactWithError,
  firstMissingFact,
} from "@/lib/workspace/trip-facts";
import { plan } from "@/tests/fixtures/workspace";

const blank = { tripId: "draft" };

describe("trip facts", () => {
  it("gives every field the old preferences form edited exactly one chip", () => {
    const fields = FACTS.flatMap((fact) => FACT_FIELDS[fact]).sort();
    expect(fields).toEqual(Object.keys(blankDraft()).sort());
  });

  it("labels only stated values", () => {
    expect(factLabels(blankDraft())).toEqual({
      where: undefined,
      when: undefined,
      who: undefined,
      budget: undefined,
    });
    expect(factLabels({ ...blankDraft(), groupSize: "1.5", budgetTotal: "0" })).toMatchObject({
      who: undefined,
      budget: undefined,
    });
    expect(factLabels(draftFor(plan.brief))).toEqual({
      where: "Sydney",
      when: "1 Oct – 4 Oct · 4 days",
      who: "2 travellers",
      budget: expect.stringMatching(/^AUD\s2,000$/),
    });
    expect(factLabels({ ...blankDraft(), groupSize: "1", budgetTotal: "1999.5" })).toMatchObject({
      who: "1 traveller",
      budget: expect.stringMatching(/^AUD\s1,999\.50$/),
    });
  });

  it("explains a converted budget only while it still matches the plan", () => {
    const brief = { ...plan.brief, budgetSource: { amount: 10000, currency: "CNY" as const } };
    expect(factLabels(draftFor(brief), brief).budget).toMatch(/^AUD\s2,000 \(≈ .+\)$/);
    expect(factLabels({ ...draftFor(brief), budgetTotal: "2500" }, brief).budget).toMatch(
      /^AUD\s2,500$/,
    );
  });

  it("shows years only when a trip crosses into a new one", () => {
    expect(datesLabel("2026-12-30", "2027-01-02")?.range).toMatch(/2026 – .*2027$/);
    expect(datesLabel("2026-10-04", "2026-10-01")).toBeUndefined();
    expect(datesLabel("2026-10-01", "")).toBeUndefined();
  });

  it("checks one fact's own fields, and lets a blank trip leave them empty", () => {
    expect(factErrors("budget", blankDraft(), blank, false)).toEqual({});
    expect(factErrors("budget", blankDraft(), blank, true)).toEqual({
      budgetTotal: "Enter a total budget above zero.",
    });
    expect(factErrors("who", { ...blankDraft(), groupSize: "0" }, blank, false)).toEqual({
      groupSize: "Enter a whole number of travellers, 1 or more.",
    });
    // Dates are checked without a destination instead of blaming the missing destination.
    expect(
      factErrors("when", { ...blankDraft(), start: "2026-10-01", end: "2026-10-04" }, blank, false),
    ).toEqual({});
    expect(
      factErrors("when", { ...blankDraft(), start: "2026-10-04", end: "2026-10-01" }, blank, false),
    ).toHaveProperty("dates");
  });

  it("points a rejected brief at the first fact in top-bar order", () => {
    expect(firstFactWithError({ accommodation: "x", budgetTotal: "y" })).toBe("budget");
    expect(firstFactWithError({ dates: "x" })).toBe("when");
    expect(firstFactWithError({})).toBeUndefined();
    expect(firstMissingFact(blankDraft())).toBe("where");
    expect(firstMissingFact(draftFor(plan.brief))).toBeUndefined();
  });
});
