import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentProgressEvent } from "@trip/shared";
import { ThinkingProcess } from "@/components/chat/ThinkingProcess";

/** Expand a row only when it is closed, so a global action cannot undo the click. */
function openRow(row: HTMLElement) {
  if (row.getAttribute("aria-expanded") !== "true") fireEvent.click(row);
}

// A live-shaped run: two reasoning blocks, a stay search with its own options, a
// choice, a revision round with a heading, and settled tools.
const activity: AgentProgressEvent[] = [
  {
    type: "coordinator",
    phase: "dispatch",
    round: 1,
    summary: "Assigning planning tasks for Sydney.",
  },
  {
    type: "agent_reasoning",
    agent: "itinerary",
    round: 1,
    episode: 0,
    index: 0,
    text: "The traveller wants three days in Sydney.\n",
  },
  {
    type: "agent_reasoning",
    agent: "itinerary",
    round: 1,
    episode: 0,
    index: 1,
    text: "Delegate the stay search first.\n",
  },
  {
    type: "agent_started",
    agent: "accommodation",
    round: 1,
    objective: "Compare stays in Sydney for 2 guests.",
  },
  {
    type: "tool_started",
    agent: "accommodation",
    round: 1,
    callId: "accommodation:1:1",
    tool: "booking.searchStays",
    label: "Search stays",
    summary: "Sydney · 2026-11-10–2026-11-13",
    args: { city: "Sydney", checkIn: "2026-11-10", guests: "2" },
  },
  {
    type: "tool_completed",
    agent: "accommodation",
    round: 1,
    callId: "accommodation:1:1",
    tool: "booking.searchStays",
    label: "Search stays",
    resultSummary: "20 stay options",
    resultCount: 20,
    resultRows: Array.from({ length: 20 }, (_value, index) => ({
      label: `Stay ${index + 1}`,
      detail: `AUD ${100 + index}/night · 8.${index}/10`,
    })),
  },
  {
    type: "agent_completed",
    agent: "accommodation",
    round: 1,
    summary: "1 room, 3 nights in Sydney · AUD 690.00",
    outcome: "Produced accommodation section.",
    choice: {
      title: "Stay in Sydney",
      selected: { label: "Harbour Hotel", detail: "The Rocks · AUD 690.00 total · 9/10" },
      rationale: "Best rating within budget.",
      alternatives: [{ label: "Budget Inn", detail: "Outer · AUD 390.00 total" }],
    },
  },
  { type: "agent_started", agent: "itinerary", round: 1, objective: "Build the day plan." },
  {
    type: "tool_started",
    agent: "itinerary",
    round: 1,
    callId: "itinerary:1:1",
    tool: "maps.places",
    label: "Search places",
    summary: "sight near Sydney",
  },
  {
    type: "tool_completed",
    agent: "itinerary",
    round: 1,
    callId: "itinerary:1:1",
    tool: "maps.places",
    label: "Search places",
    resultSummary: "5 place results",
    resultCount: 5,
    resultRows: [{ label: "Opera House", detail: "sight · 9.1/10" }],
  },
  {
    type: "agent_completed",
    agent: "itinerary",
    round: 1,
    summary: "3 days planned.",
    outcome: "Produced itinerary section.",
  },
  {
    type: "coordinator",
    phase: "conflicts",
    round: 1,
    summary: "Checked budget: 1 revision request.",
  },
  {
    type: "coordinator",
    phase: "revision",
    round: 2,
    summary: "Cutting accommodation cost.",
    constraints: ["cut accommodation cost by ~20%"],
  },
  {
    type: "agent_started",
    agent: "accommodation",
    round: 2,
    constraints: ["cut accommodation cost by ~20%"],
  },
  {
    type: "agent_completed",
    agent: "accommodation",
    round: 2,
    summary: "Cheaper stay selected.",
    outcome: "Revised accommodation after: over budget.",
  },
  { type: "coordinator", phase: "assembly", round: 2, summary: "Assembling the plan." },
];

describe("thinking surface", () => {
  it("folds a settled turn behind a count line that names every round", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);

    const think = screen.getByRole("button", { name: /Think/ });
    expect(think.textContent).toContain("2 tool calls · 2 subagents · 2 rounds");
    // Folded until the reader opens the turn.
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // A round number never appears without the coordinator's explanation of it.
    expect(document.body.textContent).not.toContain("Round 1");
  });

  it("explains a revision round and opens a tool, a reasoning block and a choice", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));

    // The round heading carries what the round was for and the constraints it sent.
    expect(document.body.textContent).toContain("Round 2");
    expect(document.body.textContent).toContain("Cutting accommodation cost.");
    expect(document.body.textContent).toContain("cut accommodation cost by ~20%");

    // "Search stays: 20 stay options" opens to the 20 options themselves.
    openRow(screen.getByRole("button", { name: /Search stays/ }));
    expect(screen.getByText("Stay 20")).toBeTruthy();
    expect(screen.getByText("AUD 119/night · 8.19/10")).toBeTruthy();

    // A reasoning block is one row: first line while it is the newest, whole text once open.
    const reasoning = screen.getByRole("button", { name: /Delegate the stay search first/ });
    openRow(reasoning);
    const reasoningBodies = [...document.querySelectorAll(".thinking-reasoning__body")].map(
      (body) => body.textContent ?? "",
    );
    expect(reasoningBodies.some((text) => text.includes("The traveller wants three days in Sydney."))).toBe(true);
    expect(reasoningBodies.some((text) => text.includes("Delegate the stay search first."))).toBe(true);

    // The choice names the stay the specialist picked and hides the rest until asked.
    expect(screen.getByText("Harbour Hotel")).toBeTruthy();
    openRow(screen.getByRole("button", { name: /Other options/ }));
    expect(screen.getByText("Budget Inn")).toBeTruthy();
  });

  it("keeps the rows open and one live region while the turn runs", () => {
    const { container } = render(<ThinkingProcess activity={activity} busy />);

    const live = container.querySelectorAll("[aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]?.getAttribute("role")).toBe("status");
    expect(live[0]?.textContent).toContain("Deep diving");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("collapses every row again from the turn control", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
