import { describe, expect, it } from "vitest";
import { draftFor, knownFromDraft, parseDraft, parseSnapshot } from "@/lib/workspace";
import { plan, snapshot } from "@/tests/fixtures/workspace";

describe("stated budget in the workspace", () => {
  it("keeps the original amount beside the AUD budget through form and chat requests", () => {
    const draft = {
      ...draftFor(plan.brief),
      budgetTotal: "1050",
      budgetSource: { amount: 5000, currency: "CNY" as const },
    };
    const parsed = parseDraft(draft, plan.brief);
    expect(parsed.success && parsed.data.budgetSource).toEqual({ amount: 5000, currency: "CNY" });
    expect(knownFromDraft(draft)).toMatchObject({
      budgetTotal: 1050,
      budgetSource: { amount: 5000, currency: "CNY" },
    });
  });
  it("restores a source from chat and drops it when its AUD value no longer matches", () => {
    const draft = draftFor({
      ...plan.brief,
      budgetTotal: 1050,
      budgetSource: { amount: 5000, currency: "CNY" },
    });
    expect(draft.budgetSource).toEqual({ amount: 5000, currency: "CNY" });
    const changed = parseDraft({ ...draft, budgetTotal: "2000" }, plan.brief);
    expect(changed.success && changed.data.budgetSource).toBeUndefined();
  });
  it("upgrades existing AUD snapshots without losing unfinished draft edits", () => {
    const restored = parseSnapshot({ ...snapshot, version: 3 });
    expect(restored.version).toBe(4);
    expect(restored.draft).toEqual(snapshot.draft);
  });
});
