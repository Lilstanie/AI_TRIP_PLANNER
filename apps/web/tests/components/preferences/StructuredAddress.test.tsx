import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { blankDraft, type Draft, parseDraft } from "@/lib/workspace";
import { WhereFields } from "@/components/preferences/WhereFields";

function Harness({ save }: { save: (draft: Draft) => void }) {
  const [value, setValue] = useState(blankDraft());
  return (
    <>
      <WhereFields value={value} onChange={setValue} errors={{}} suggestPlaces={false} />
      <button onClick={() => save(value)}>Inspect draft</button>
    </>
  );
}

describe("structured trip addresses", () => {
  it("keeps destination and origin city/country with optional suburb/state in the draft", () => {
    const save = vi.fn();
    render(<Harness save={save} />);
    const destination = screen.getByRole("group", { name: "Destination 1" });
    const origin = screen.getByRole("group", { name: "Departing from" });
    fireEvent.change(within(destination).getByLabelText("City *"), { target: { value: "Sydney" } });
    fireEvent.change(within(destination).getByLabelText("Country *"), {
      target: { value: "Australia" },
    });
    fireEvent.change(within(destination).getByLabelText("Suburb (optional)"), {
      target: { value: "Glebe" },
    });
    fireEvent.change(within(origin).getByLabelText("City *"), { target: { value: "Melbourne" } });
    fireEvent.change(within(origin).getByLabelText("Country *"), {
      target: { value: "Australia" },
    });
    fireEvent.click(screen.getByText("Inspect draft"));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      destination: "Sydney, Glebe, Australia",
      origin: "Melbourne, Australia",
      locations: {
        destinations: [{ city: "Sydney", country: "Australia", suburb: "Glebe", state: "" }],
        origin: { city: "Melbourne", country: "Australia" },
      },
    });
  });

  it("requires an origin and both city/country instead of accepting country alone", () => {
    const draft = {
      ...blankDraft(),
      destination: "Sydney",
      start: "2026-11-01",
      end: "2026-11-04",
      groupSize: "2",
      budgetTotal: "2000",
      locations: {
        destinations: [{ city: "Sydney", country: "", suburb: "", state: "" }],
        origin: { city: "", country: "Australia", suburb: "", state: "" },
      },
    };
    expect(parseDraft(draft, { tripId: "t" }).success).toBe(false);
  });
});
