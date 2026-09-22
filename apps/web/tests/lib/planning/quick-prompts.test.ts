import { describe, it, expect } from "vitest";
import { quickPrompts } from "@/lib/planning/quick-prompts";

const ISO = /(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/;

describe("quickPrompts", () => {
  it("states everything a plan needs, so one click needs no follow-up", () => {
    for (const { label, text } of quickPrompts(new Date(2026, 8, 21))) {
      // A label may wrap to two lines in the button and still be scannable;
      // the limit is here to stop a whole sentence becoming one.
      expect(label.length, label).toBeLessThan(40);
      expect(text, label).toMatch(ISO);
      expect(text, label).toMatch(/\d+ AUD/);
      // Either a party size or an explicit solo trip.
      expect(text, label).toMatch(/\d+ people|solo/);
      expect(text, label).toMatch(/\d+ AUD/);
    }
  });

  it("always sits in the future, whenever it is generated", () => {
    // The point of computing the dates: a literal would quietly rot into a past
    // date, which live provider searches reject — the prompt would still look
    // right and only ever fail. Check a date far past the ones first written.
    for (const today of [new Date(2026, 8, 21), new Date(2031, 0, 1)]) {
      for (const { label, text } of quickPrompts(today)) {
        const [, start, end] = text.match(ISO)!;
        expect(new Date(start!).getTime(), `${label} start`).toBeGreaterThan(today.getTime());
        expect(new Date(end!).getTime(), `${label} end`).toBeGreaterThan(new Date(start!).getTime());
      }
    }
  });

  it("builds dates from local calendar fields, not a UTC shift", () => {
    // toISOString() would report the previous day for a late-evening local
    // time in a positive-offset zone, silently sending the wrong date.
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
    // Without an origin the arrival is never priced as a flight, so at least
    // one example has to exercise it.
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
    // The whole promise of these buttons is one click, no follow-up question.
    // With no model key the server falls back to pattern extraction, which only
    // sees the phrasings it was written for — so assert against that parser
    // rather than trusting the prompts to read well to a human.
    const { extractBriefPatchLocally } = await import("@trip/orchestrator");
    for (const { label, text } of quickPrompts(new Date(2026, 8, 21))) {
      const patch = extractBriefPatchLocally(text);
      expect(patch.destination, `${label}: destination`).toBeTruthy();
      expect(patch.dates, `${label}: dates`).toHaveLength(2);
      expect(patch.budgetTotal, `${label}: budget`).toBeGreaterThan(0);
      // An origin, when the prompt states one, has to survive extraction —
      // otherwise the trip is planned as if everyone left from Sydney.
      if (/\bfrom ([A-Z][a-z]+) to\b/.test(text))
        expect(patch.origin, `${label}: origin`).toBe(/\bfrom ([A-Z][a-z]+) to\b/.exec(text)![1]);
    }
  });
});
