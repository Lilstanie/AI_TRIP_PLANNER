import { describe, expect, it } from "vitest";
import { NoticeError } from "@/lib/i18n/notice";
import { applyItemAction } from "@/lib/trip/item-actions";
import { plan as fixture } from "@/tests/fixtures/workspace";

describe("item action refusals", () => {
  it("names the full day as a keyed notice", () => {
    const p = structuredClone(fixture);
    p.sections[0]!.proposal!.items = [
      {
        id: "late",
        kind: "activity",
        detail: "Late",
        day: 2,
        startTime: "21:00",
        endTime: "23:00",
      },
      { id: "idea", kind: "activity", detail: "Idea" },
    ];
    let error: unknown;
    try {
      applyItemAction(p, "idea", { kind: "day", day: 2 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(NoticeError);
    expect((error as NoticeError).notice).toEqual({
      key: "Day {day} has no room left for this stop; shorten another stop first.",
      params: { day: 2 },
    });
  });

  it("refuses a stop that is gone with a keyed notice", () => {
    expect(() => applyItemAction(structuredClone(fixture), "missing", { kind: "remove" })).toThrow(
      NoticeError,
    );
  });
});
