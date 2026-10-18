import { describe, it, expect } from "vitest";
import { quickPrompts } from "@/lib/planning/quick-prompts";

const ISO = /(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/;

describe("quickPrompts", () => {
  it("states everything a plan needs, so one click needs no follow-up", () => {
    for (const { label, text } of quickPrompts(new Date(2026, 8, 21))) {
      expect(label.length, label).toBeLessThan(40);
      expect(text, label).toMatch(ISO);
      expect(text, label).toMatch(/total budget \d+\./);

      expect(text, label).toMatch(/\d+ people|solo/);
      expect(text, label).toMatch(/total budget \d+\./);
    }
  });

  it("always sits in the future, whenever it is generated", () => {
    for (const today of [new Date(2026, 8, 21), new Date(2031, 0, 1)]) {
      for (const { label, text } of quickPrompts(today)) {
        const [, start, end] = text.match(ISO)!;
        expect(new Date(start!).getTime(), `${label} start`).toBeGreaterThan(today.getTime());
        expect(new Date(end!).getTime(), `${label} end`).toBeGreaterThan(
          new Date(start!).getTime(),
        );
      }
    }
  });

  it("builds dates from local calendar fields, not a UTC shift", () => {
    const lateEvening = new Date(2026, 8, 21, 23, 30);
    const [first] = quickPrompts(lateEvening);
    const [, start] = first!.text.match(ISO)!;
    const expected = new Date(lateEvening);
    expected.setDate(expected.getDate() + 21);
    expect(start).toBe(
      `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`,
    );
  });
});

describe("quickPrompts cover the planner's travel shapes", () => {
  const prompts = quickPrompts(new Date(2026, 8, 21));

  it("offers a trip that states where it departs from", () => {
    expect(prompts.some(({ text }) => /\bfrom [A-Z][a-z]+ to\b/.test(text))).toBe(true);
  });

  it("offers a multi-city trip, which is what produces hops between cities", () => {
    expect(prompts.some(({ text }) => text.includes(" & "))).toBe(true);
  });

  it("offers a single-city trip, whose stops are connected by local transport", () => {
    expect(
      prompts.some(({ text }) => !text.includes(" & ") && !/\bfrom [A-Z][a-z]+ to\b/.test(text)),
    ).toBe(true);
  });
});

describe("quickPrompts against the real offline extractor", () => {
  it("yields a complete brief with no model key configured", async () => {
    const { extractBriefPatchLocally } = await import("@trip/orchestrator");
    for (const { label, text } of quickPrompts(new Date(2026, 8, 21))) {
      const patch = extractBriefPatchLocally(text);
      expect(patch.destination, `${label}: destination`).toBeTruthy();
      expect(patch.dates, `${label}: dates`).toHaveLength(2);
      expect(patch.budgetTotal, `${label}: budget`).toBeGreaterThan(0);

      if (/\bfrom ([A-Z][a-z]+) to\b/.test(text))
        expect(patch.origin, `${label}: origin`).toBe(/\bfrom ([A-Z][a-z]+) to\b/.exec(text)![1]);
    }
  });
});
