import { describe, expect, it } from "vitest";
import { blankDraft, draftFor } from "@/lib/workspace";
import {
  FACT_FIELDS,
  FACTS,
  RETIRED_FIELDS,
  datesLabel,
  factErrors,
  factLabels,
  firstFactWithError,
  firstMissingFact,
} from "@/lib/workspace/trip-facts";
import { plan } from "@/tests/fixtures/workspace";

const blank = { tripId: "draft" };

describe("trip facts", () => {
  it("gives every draft field exactly one chip, or marks it retired", () => {
    const fields = [...FACTS.flatMap((fact) => FACT_FIELDS[fact]), ...RETIRED_FIELDS].sort();
    expect(fields).toEqual(Object.keys(blankDraft()).sort());
    expect(FACT_FIELDS.preferences).toEqual(["preferences"]);
  });

  it("checks the preference list with the brief schema", () => {
    expect(factErrors("preferences", blankDraft(), blank, false)).toEqual({});
    expect(
      factErrors("preferences", { ...blankDraft(), preferences: ["x".repeat(201)] }, blank, false),
    ).toEqual({
      preferences: {
        key: "Keep to {count} preferences of up to {length} characters each.",
        params: { count: 12, length: 200 },
      },
    });
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
      budget: expect.stringMatching(/^AUD\s2,000\.00$/),
    });
    expect(factLabels({ ...blankDraft(), groupSize: "1", budgetTotal: "1999.5" })).toMatchObject({
      who: "1 traveller",
      budget: expect.stringMatching(/^AUD\s1,999\.50$/),
    });
  });

  it("uses matching original budgets and converts edited budgets", () => {
    const brief = {
      ...plan.brief,
      budgetTotal: 2100,
      budgetSource: { amount: 10000, currency: "CNY" as const },
    };
    expect(factLabels(draftFor(brief), brief, { currency: "CNY" }).budget).toMatch(
      /^CNY\s10,000\.00$/,
    );
    expect(factLabels({ ...draftFor(brief), budgetTotal: "2500" }, brief).budget).toMatch(
      /^AUD\s2,500\.00$/,
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
      budgetTotal: { key: "Enter a total budget above zero." },
    });
    expect(factErrors("who", { ...blankDraft(), groupSize: "0" }, blank, false)).toEqual({
      groupSize: { key: "Enter a whole number of travellers, 1 or more." },
    });
    // Dates are checked without a destination instead of blaming the missing destination.
    expect(
      factErrors("when", { ...blankDraft(), start: "2026-10-01", end: "2026-10-04" }, blank, false),
    ).toEqual({});
    expect(
      factErrors("when", { ...blankDraft(), start: "2026-10-04", end: "2026-10-01" }, blank, false),
    ).toEqual({
      dates: { key: "End date must follow start date, with at least one night per destination." },
    });
    expect(factErrors("when", { ...blankDraft(), start: "2026-10-01" }, blank, false)).toEqual({
      dates: { key: "Choose both a start and an end date." },
    });
  });

  it("points a rejected brief at the first fact in top-bar order", () => {
    const x = { key: "Check the highlighted trip details." } as const;
    expect(firstFactWithError({ preferences: x, budgetTotal: x })).toBe("budget");
    expect(firstFactWithError({ preferences: x })).toBe("preferences");
    expect(firstFactWithError({ dates: x })).toBe("when");
    expect(firstFactWithError({})).toBeUndefined();
    expect(firstMissingFact(blankDraft())).toBe("where");
    expect(firstMissingFact(draftFor(plan.brief))).toBeUndefined();
  });
});
