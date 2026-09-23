import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentProgressEvent } from "@trip/shared";
import { ThinkingProcess } from "@/components/chat/ThinkingProcess";

/** The turn-level Think row. */
function turnRow(): HTMLElement {
  return screen.getAllByRole("button", { name: /^Think/ })[0];
}

/** The disclosure of one subagent row, found through its listitem label;
 *  `nth` picks a later round's row for an agent that worked in several. */
function subagentButton(label: string, status: string, nth = 0): HTMLElement {
  const item = screen.getAllByRole("listitem", { name: `${label} ${status}` })[nth];
  return within(item).getAllByRole("button")[0];
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
    resultRows: [
      {
        label: "Opera House",
        detail: "sight · 9.1/10",
        kind: "attraction",
        url: "https://www.sydneyoperahouse.com/whats-on",
      },
      { label: "Darling Harbour", detail: "sight · 8.6/10" },
    ],
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
  it("folds a settled turn behind a count line and keeps every row collapsed", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);

    const think = turnRow();
    expect(think.textContent).toContain("2 tool calls · 2 subagents · 2 rounds");
    expect(think.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // A round number never appears without the coordinator's explanation of it.
    expect(document.body.textContent).not.toContain("Round 1");
  });

  it("starts collapsed while busy too, with one live region", () => {
    const { container } = render(<ThinkingProcess activity={activity} busy />);

    expect(turnRow().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    const live = container.querySelectorAll("[aria-live]");
    expect(live).toHaveLength(1);
    expect(live[0]?.getAttribute("role")).toBe("status");
    expect(live[0]?.textContent).toContain("Deep diving");
  });

  it("opens Think to its subagent rows only, and each subagent on its own", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());

    // Think's children are subagent rows (plus the round heading that explains
    // round 2); nothing below a subagent is visible yet.
    expect(screen.getAllByRole("list", { name: "Subagents thinking together" })).toHaveLength(2);
    // Stay worked in both rounds, so it has one row per round.
    expect(screen.getAllByRole("listitem", { name: "Stay Complete" })).toHaveLength(2);
    expect(screen.getByRole("listitem", { name: "Day plan Complete" })).toBeTruthy();
    expect(document.body.textContent).toContain("Round 2 · Cutting accommodation cost.");
    expect(screen.queryByRole("button", { name: /^Search stays/ })).toBeNull();
    expect(document.querySelector(".thinking-reasoning")).toBeNull();
    expect(document.querySelector(".thinking-subagent__body")).toBeNull();

    // Opening one subagent opens only that one.
    const stay = subagentButton("Stay", "Complete");
    fireEvent.click(stay);
    expect(stay.getAttribute("aria-expanded")).toBe("true");
    expect(subagentButton("Day plan", "Complete").getAttribute("aria-expanded")).toBe("false");
    expect(subagentButton("Stay", "Complete", 1).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: /^Search stays/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Search places/ })).toBeNull();
    expect(screen.queryByText("Stay 20")).toBeNull();
  });

  it("opens a tool, a reasoning block and a choice one at a time", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Stay", "Complete"));

    // "Search stays: 20 stay options" opens to the 20 options themselves.
    fireEvent.click(screen.getByRole("button", { name: /^Search stays/ }));
    expect(screen.getByText("Stay 20")).toBeTruthy();
    expect(screen.getByText("AUD 119/night · 8.19/10")).toBeTruthy();

    // The choice names the stay the specialist picked and hides the rest until asked.
    expect(screen.getByText("Harbour Hotel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Other options/ }));
    expect(screen.getByText("Budget Inn")).toBeTruthy();

    // Two old-style reasoning slices of one model call are one Think row whose
    // settled summary is the call's first line.
    fireEvent.click(subagentButton("Day plan", "Complete"));
    const reasoning = screen.getAllByRole("button", { name: /^Think/ }).slice(1);
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].textContent).toContain("The traveller wants three days in Sydney.");
    fireEvent.click(reasoning[0]);
    expect(document.querySelector(".thinking-reasoning__body")?.textContent).toBe(
      "The traveller wants three days in Sydney.\nDelegate the stay search first.\n",
    );
  });

  it("merges streamed deltas into one running row that follows the newest line", () => {
    const streaming: AgentProgressEvent[] = [
      { type: "agent_started", agent: "itinerary", round: 1 },
      ...["Weighing the harbour", " walk against the ferry.\nThe ferry", " is quicker."].map(
        (text): AgentProgressEvent => ({
          type: "agent_reasoning",
          agent: "itinerary",
          round: 1,
          episode: 0,
          index: 0,
          text,
        }),
      ),
    ];
    render(<ThinkingProcess activity={streaming} busy />);

    // The turn row follows the same line, right-anchored.
    const turnSummary = turnRow().querySelector(".thinking-row__summary");
    expect(turnSummary?.textContent).toBe("The ferry is quicker.");
    expect(turnSummary?.hasAttribute("data-follow-end")).toBe(true);

    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Day plan", "Thinking"));
    const rows = document.querySelectorAll(".thinking-reasoning");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute("data-state")).toBe("running");
    const summary = rows[0]?.querySelector(".thinking-row__summary");
    expect(summary?.textContent).toBe("The ferry is quicker.");
    expect(summary?.hasAttribute("data-follow-end")).toBe(true);
  });

  it("gives every result row a category glyph, from its kind or its tool", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Day plan", "Complete"));
    fireEvent.click(screen.getByRole("button", { name: /^Search places/ }));

    const opera = screen.getByText("Opera House").closest("li");
    // This one has a web page, so its kind only names the fallback glyph.
    expect(opera?.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe("attraction");
    // No kind on the wire: maps.places falls back to the generic place glyph.
    const harbour = screen.getByText("Darling Harbour").closest("li");
    expect(harbour?.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe("place");

    fireEvent.click(subagentButton("Stay", "Complete"));
    fireEvent.click(screen.getByRole("button", { name: /^Search stays/ }));
    const stay = screen.getByText("Stay 1").closest("li");
    expect(stay?.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe("stay");
  });

  it("shows the site's icon for a result with a page, and the glyph for one without", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Day plan", "Complete"));
    fireEvent.click(screen.getByRole("button", { name: /^Search places/ }));

    const opera = screen.getByText("Opera House").closest("li");
    const favicon = opera?.querySelector("img.thinking-tool__row-favicon");
    expect(favicon?.getAttribute("src")).toBe(
      "https://www.google.com/s2/favicons?domain=www.sydneyoperahouse.com&sz=32",
    );
    // Only the host reaches the icon service, and the request names no referrer.
    expect(favicon?.getAttribute("src")).not.toContain("whats-on");
    expect(favicon?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(opera?.querySelector("svg")).toBeNull();
    // The row still says what kind of thing it is, for the fallback and for CSS.
    expect(opera?.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe("attraction");

    // A row whose provider reported no page keeps the category glyph.
    const harbour = screen.getByText("Darling Harbour").closest("li");
    expect(harbour?.querySelector("img")).toBeNull();
    expect(harbour?.querySelector("svg")).toBeTruthy();
  });

  it("falls back to the category glyph when the site icon fails to load", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Day plan", "Complete"));
    fireEvent.click(screen.getByRole("button", { name: /^Search places/ }));

    const opera = () => screen.getByText("Opera House").closest("li");
    fireEvent.error(opera()!.querySelector("img")!);

    expect(opera()?.querySelector("img")).toBeNull();
    expect(opera()?.querySelector("svg")).toBeTruthy();
    expect(opera()?.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe("attraction");
  });

  it("reads a call's arguments as one line: the journey, the date, then the rest", () => {
    const routed: AgentProgressEvent[] = [
      { type: "agent_started", agent: "transport", round: 1 },
      {
        type: "tool_started",
        agent: "transport",
        round: 1,
        callId: "transport:1:1",
        tool: "maps.routeOptions",
        label: "Compare ways to travel",
        summary: "Sydney → Wollongong",
        args: { from: "Sydney", to: "Wollongong", date: "2026-11-24", passengers: "2" },
      },
    ];
    render(<ThinkingProcess activity={routed} busy />);
    fireEvent.click(turnRow());
    fireEvent.click(subagentButton("Getting around", "Thinking"));
    fireEvent.click(screen.getByRole("button", { name: /^Compare ways to travel/ }));

    const args = document.querySelector(".thinking-tool__args");
    expect(args).toBeTruthy();
    // One line, not a label/value row per argument.
    expect(args?.tagName).toBe("P");
    expect([...args!.querySelectorAll(".thinking-tool__arg-value")].map((el) => el.textContent))
      .toEqual(["Sydney", "Wollongong", "2026-11-24", "2"]);
    expect([...args!.querySelectorAll(".thinking-tool__arg-sep")].map((el) => el.textContent))
      .toEqual(["→", "·"]);
    // The separators are decoration; what is read is "from Sydney to Wollongong".
    for (const separator of args!.querySelectorAll(".thinking-tool__arg-sep"))
      expect(separator.getAttribute("aria-hidden")).toBe("true");
    expect(args?.textContent).toContain("from Sydney");
    expect(args?.textContent).toContain("to Wollongong");
    // Anything that is not a journey or a date stays a `key value` chip.
    const chip = args!.querySelector(".thinking-tool__arg-chip");
    expect(chip?.querySelector(".thinking-tool__arg-key")?.textContent).toBe("passengers");
    expect(chip?.textContent).toBe("passengers2");
  });

  it("has no trailing chevron and no expand-all control", () => {
    const { container } = render(<ThinkingProcess activity={activity} busy={false} />);
    fireEvent.click(turnRow());

    expect(screen.queryByRole("button", { name: /Expand all|Collapse all/ })).toBeNull();
    expect(container.querySelector(".thinking-line__chevron, .thinking-control")).toBeNull();
    // A closed row's only chevron is the hover preview inside its leading box.
    for (const line of container.querySelectorAll(".thinking-row__line")) {
      const last = line.lastElementChild;
      expect(last?.classList.contains("thinking-row__chevron")).toBe(false);
      for (const chevron of line.querySelectorAll(".thinking-row__chevron"))
        expect(chevron.closest(".thinking-row__leading")).toBeTruthy();
    }
  });

  it("toggles a row from the keyboard", () => {
    render(<ThinkingProcess activity={activity} busy={false} />);
    const think = turnRow();
    fireEvent.keyDown(think, { key: "Enter" });
    expect(think.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(think, { key: " " });
    expect(think.getAttribute("aria-expanded")).toBe("false");
  });
});
