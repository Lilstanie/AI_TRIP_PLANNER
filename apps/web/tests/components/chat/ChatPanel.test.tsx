import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AgentProgressEvent } from "@trip/shared";
import type { Message } from "@/lib/workspace";
import { ChatPanel } from "@/components/chat/ChatPanel";

const activity = (type: string): AgentProgressEvent =>
  ({
    type,
    agent: "itinerary",
    round: 1,
    ...(type === "agent_failed" ? { error: "Retry" } : {}),
    ...(type === "agent_started" ? { summary: "Drafting the day plan" } : {}),
  }) as AgentProgressEvent;

function Chat({
  activityEvents = [],
  busy = false,
}: {
  activityEvents?: AgentProgressEvent[];
  busy?: boolean;
}) {
  const [input, setInput] = useState("");
  return (
    <ChatPanel
      messages={[{ role: "agent", text: "Hello" }]}
      input={input}
      onInput={setInput}
      busy={busy}
      activity={activityEvents}
      onSend={vi.fn()}
      onEdit={vi.fn()}
    />
  );
}

/** The turn-level Think disclosure in a finished run: the only visible row. */
function thinkRow(): HTMLElement {
  return screen.getByRole("button", { name: /^Think/ });
}

/** The disclosure button of one subagent row. The row's own accessible name
 *  (and its status) lives on the enclosing listitem, so match that exactly
 *  rather than substring-searching the status suffix. */
function subagentRow(label: string, status = "Complete"): HTMLElement {
  const rows = screen.getAllByRole("listitem").filter(
    (row) => row.getAttribute("aria-label") === `${label} ${status}`,
  );
  expect(rows).toHaveLength(1);
  return within(rows[0]).getByRole("button");
}

/** The tool disclosure nested under an agent. */
function toolRow(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${label}`) });
}

describe("ChatPanel", () => {
  it("plans an example trip in one click, sending its own complete text", () => {
    const onSend = vi.fn();
    function EmptyChat() {
      const [input, setInput] = useState("");
      return (
        <ChatPanel
          messages={[]}
          input={input}
          onInput={setInput}
          busy={false}
          activity={[]}
          onSend={onSend}
          onEdit={vi.fn()}
        />
      );
    }
    render(<EmptyChat />);

    const log = screen.getByRole("log");
    expect(screen.getByRole("heading", { name: "Where to next?" })).toBeTruthy();
    expect(within(log).queryByText(/.+/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /sydney/i }));

    // The example sends its own text rather than staging it in the composer:
    // React state has not flushed when the click handler runs, so relying on
    // the input would send the previous (empty) value.
    expect(onSend).toHaveBeenCalledTimes(1);
    const [sent] = onSend.mock.calls[0]!;
    // Assert the facts, not the word order: the phrasing is constrained by the
    // offline extractor and has had to change once already.
    expect(sent).toMatch(/Sydney/);
    expect(sent).toMatch(/2 people/);
    expect(sent).toMatch(/total budget 4000 AUD/);
    // Complete enough to plan outright, so no follow-up question is needed.
    expect(sent).toMatch(/\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/);
  });

  it("does not scroll an empty chat above its heading", () => {
    const scrollTo = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    try {
      render(
        <ChatPanel
          messages={[]}
          input=""
          onInput={vi.fn()}
          busy={false}
          activity={[]}
          onSend={vi.fn()}
          onEdit={vi.fn()}
        />,
      );
      expect(screen.getByRole("heading", { name: "Where to next?" })).toBeTruthy();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      if (previous) Object.defineProperty(HTMLElement.prototype, "scrollTo", previous);
      else delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });

  it("labels messages once, in conversation order, without changing long content", () => {
    const longUrl = `https://example.test/${"very-long-path/".repeat(20)}旅行计划`;
    render(
      <ChatPanel
        messages={[
          { role: "user", text: "Plan Kyoto" },
          { role: "agent", text: longUrl },
        ]}
        input=""
        onInput={vi.fn()}
        busy={false}
        activity={[]}
        onSend={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const log = screen.getByRole("log");
    expect(Array.from(log.children).map((message) => message.textContent)).toEqual([
      "YouPlan Kyoto",
      `Travel planning assistant${longUrl}`,
    ]);
    expect(within(log).getByText("You")).toBeTruthy();
    expect(within(log).getByText("Travel planning assistant")).toBeTruthy();
    expect(within(log).getByText(longUrl).classList.contains("msg__content")).toBe(true);
    expect(log.querySelectorAll("[aria-label]")).toHaveLength(0);
  });

  it.each([
    ["agent_started", "Thinking"],
    ["agent_completed", "Complete"],
    ["agent_failed", "Needs attention"],
    ["unexpected", "Waiting"],
  ])("exposes %s as %s and keeps subagent details collapsed", (type, status) => {
    render(<Chat activityEvents={[activity(type)]} busy />);

    const progress = screen.getByRole("region", { name: "Thinking process" });
    const row = within(progress).getByRole("listitem", {
      name: new RegExp(`Day plan.*${status}`),
    });
    // The dot is decorative; the state also travels as text.
    expect(within(row).getAllByText(status).length).toBeGreaterThan(0);
    const details = within(row).getByRole("button", { name: /^Subagent .*Day plan/ });
    expect(details.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(details);
    expect(details.getAttribute("aria-expanded")).toBe("true");
  });

  it("folds a settled run behind its count line and unfolds it on demand", () => {
    render(
      <Chat
        activityEvents={[
          { type: "coordinator", phase: "dispatch", round: 1, summary: "Preparing" },
          { type: "agent_started", agent: "itinerary", round: 1 },
          {
            type: "tool_started",
            agent: "itinerary",
            round: 1,
            callId: "itinerary:1:1",
            tool: "maps.places",
            label: "Search places",
            summary: "sights near Sydney",
          },
          {
            type: "tool_completed",
            agent: "itinerary",
            round: 1,
            callId: "itinerary:1:1",
            tool: "maps.places",
            label: "Search places",
            resultSummary: "5 place result(s)",
            resultCount: 5,
          },
          { type: "agent_completed", agent: "itinerary", round: 1, summary: "Day plan drafted" },
        ]}
      />,
    );

    expect(thinkRow().textContent).toContain("1 tool call · 1 subagent");
    expect(screen.queryByRole("listitem", { name: "Day plan Complete" })).toBeNull();

    // Expand all reveals the whole run, and collapse all folds it again.
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByRole("listitem", { name: "Day plan Complete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByRole("listitem", { name: "Day plan Complete" })).toBeNull();
  });

  it("explains each round after the first and keeps them out of a single-round run", () => {
    const firstRound: AgentProgressEvent[] = [
      { type: "agent_started", agent: "itinerary", round: 1 },
      { type: "agent_completed", agent: "itinerary", round: 1, summary: "Day plan drafted" },
    ];
    const view = render(<Chat activityEvents={firstRound} busy />);

    expect(screen.queryByText(/^Round 1/)).toBeNull();

    view.rerender(
      <Chat
        busy
        activityEvents={[
          ...firstRound,
          {
            type: "coordinator",
            phase: "revision",
            round: 2,
            summary: "Revising the stay after a conflict",
            constraints: ["Keep the budget under AUD 4,000"],
          },
          {
            type: "agent_started",
            agent: "accommodation",
            round: 2,
            constraints: ["Free cancellation is required"],
          },
        ]}
      />,
    );

    // The count line names the volume; the heading explains why the round exists.
    fireEvent.click(thinkRow());
    expect(document.querySelector(".thinking-turn__body")?.textContent).toContain("2 rounds");
    expect(screen.getByText("Round 2 · Revising the stay after a conflict")).toBeTruthy();
    expect(screen.getByText("Keep the budget under AUD 4,000")).toBeTruthy();

    // The revision's own constraint lives in the agent whose round it is.
    fireEvent.click(subagentRow("Stay", "Revising"));
    expect(screen.getByText("Free cancellation is required")).toBeTruthy();
  });

  it("shows the DeepSeek-style thinking transcript and a stop action while busy", () => {
    const onCancel = vi.fn();
    render(
      <ChatPanel
        messages={[{ role: "user", text: "Plan Sydney" }]}
        input=""
        onInput={vi.fn()}
        busy
        activity={[
          { type: "coordinator", phase: "dispatch", round: 1, summary: "Preparing" },
          { type: "agent_started", agent: "itinerary", round: 1 },
        ]}
        onCancel={onCancel}
        onSend={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Deep diving/)).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toContain("Deep diving");
    fireEvent.click(thinkRow());
    expect(thinkRow().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("list", { name: "Subagents thinking together" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop planning" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows all subagents without exposing internal reasoning", () => {
    render(
      <ChatPanel
        messages={[{ role: "user", text: "Plan Sydney" }]}
        input=""
        onInput={vi.fn()}
        busy
        activity={[{ type: "agent_started", agent: "itinerary", round: 1 }]}
        onSend={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByRole("listitem", { name: "Day plan Thinking" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Getting around Waiting" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Stay Waiting" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Destination guide Waiting" })).toBeTruthy();
    expect(screen.getByRole("listitem", { name: "Food & dining Waiting" })).toBeTruthy();
    expect(screen.queryByText(/chain[- ]of[- ]thought/i)).toBeNull();
  });

  it("renders live tool actions and settles them when the stream reports a result", () => {
    const baseActivity: AgentProgressEvent[] = [
      { type: "coordinator", phase: "dispatch", round: 1, summary: "Assigning work" },
      { type: "agent_started", agent: "itinerary", round: 1, summary: "Building the day plan" },
      {
        type: "tool_started",
        agent: "itinerary",
        round: 1,
        callId: "itinerary:1:1",
        tool: "maps.places",
        label: "Search places",
        summary: "sight near Sydney",
      },
    ];
    const view = render(
      <ChatPanel
        messages={[{ role: "user", text: "Plan Sydney" }]}
        input=""
        onInput={vi.fn()}
        busy
        activity={baseActivity}
        onSend={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Deep diving/).length).toBe(1);
    // No arguments and no result rows means nothing to disclose: a plain row.
    expect(screen.getByRole("group", { name: "Search places running" })).toBeTruthy();
    view.rerender(
      <ChatPanel
        messages={[{ role: "user", text: "Plan Sydney" }]}
        input=""
        onInput={vi.fn()}
        busy
        activity={[
          ...baseActivity,
          {
            type: "tool_completed",
            agent: "itinerary",
            round: 1,
            callId: "itinerary:1:1",
            tool: "maps.places",
            label: "Search places",
            resultSummary: "5 place result(s)",
            resultCount: 5,
          },
        ]}
        onSend={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "Search places completed" }).textContent).toContain(
      "5 place result(s)",
    );
  });

  it("reveals a tool call's arguments, result rows and truncation note when expanded", () => {
    render(
      <Chat
        busy
        activityEvents={[
          { type: "agent_started", agent: "accommodation", round: 1 },
          {
            type: "tool_started",
            agent: "accommodation",
            round: 1,
            callId: "accommodation:1:1",
            tool: "booking.searchStays",
            label: "Search stays",
            summary: "Sydney · 2026-03-01–2026-03-05",
            args: { city: "Sydney", guests: "2" },
          },
          {
            type: "tool_completed",
            agent: "accommodation",
            round: 1,
            callId: "accommodation:1:1",
            tool: "booking.searchStays",
            label: "Search stays",
            resultSummary: "34 stay option(s)",
            resultCount: 34,
            resultRows: [
              { label: "Harbour View Hotel", detail: "The Rocks · AUD 210.00/night" },
              { label: "Surry Hills Loft", detail: "Surry Hills · AUD 180.00/night" },
            ],
            resultTruncated: true,
          },
          { type: "agent_completed", agent: "accommodation", round: 1 },
        ]}
      />,
    );

    const row = toolRow("Search stays");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Harbour View Hotel")).toBeNull();

    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Harbour View Hotel")).toBeTruthy();
    expect(screen.getByText("Surry Hills Loft")).toBeTruthy();
    expect(screen.getByText("The Rocks · AUD 210.00/night")).toBeTruthy();
    expect(screen.getByText("Showing the first 2 of 34")).toBeTruthy();
  });

  it("renders a streamed reasoning block collapsed on its last line and expands to the full text", () => {
    render(
      <Chat
        busy
        activityEvents={[
          { type: "agent_started", agent: "itinerary", round: 1 },
          {
            type: "agent_reasoning",
            agent: "itinerary",
            round: 1,
            episode: 0,
            index: 0,
            text: "**Weighing the neighbourhoods**\nCherrybrook suits the family.",
          },
        ]}
      />,
    );

    // While the block is the streaming tail the summary follows the last line,
    // with the double-asterisk markers stripped from the summary only.
    const row = screen.getByRole("button", { name: /Cherrybrook suits the family\.$/ });
    expect(row.textContent).not.toContain("**");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".thinking-reasoning__body")).toBeNull();

    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".thinking-reasoning__body")?.textContent).toBe(
      "**Weighing the neighbourhoods**\nCherrybrook suits the family.",
    );
  });

  it("surfaces the accommodation choice, with its alternatives behind a disclosure", () => {
    render(
      <Chat
        busy
        activityEvents={[
          { type: "agent_started", agent: "accommodation", round: 1 },
          {
            type: "agent_completed",
            agent: "accommodation",
            round: 1,
            summary: "Stay chosen",
            choice: {
              title: "Stay in Sydney",
              selected: { label: "Harbour View Hotel", detail: "The Rocks · AUD 210.00/night" },
              rationale: "Best rating inside the budget.",
              alternatives: [
                { label: "Surry Hills Loft", detail: "Surry Hills · AUD 180.00/night" },
                { label: "Bondi Beach House", detail: "Bondi · AUD 240.00/night" },
              ],
            },
          },
        ]}
      />,
    );

    fireEvent.click(subagentRow("Stay"));
    expect(screen.getByText("Stay in Sydney")).toBeTruthy();
    expect(screen.getByText("Harbour View Hotel")).toBeTruthy();
    expect(screen.getByText("Best rating inside the budget.")).toBeTruthy();
    expect(screen.queryByText("Surry Hills Loft")).toBeNull();

    const other = screen.getByRole("button", { name: "Other options (2)" });
    expect(other.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(other);
    expect(screen.getByText("Surry Hills Loft")).toBeTruthy();
    expect(screen.getByText("Bondi Beach House")).toBeTruthy();
  });

  // The chat asks nothing and confirms nothing. A question the assistant cannot
  // answer is prose in the transcript, and the traveller answers by typing in the
  // composer; there is no answer surface and no confirmation card to render.
  it("renders no confirmation card and no question surface", () => {
    renderPanel([{ role: "agent", text: "Which dates did you mean — 3 March or 3 April?" }]);

    expect(document.querySelector(".question")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send answer" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Type your answer" })).toBeNull();
    for (const text of [
      "Confirm your trip basics",
      "Confirm this plan",
      "Review unresolved conflicts",
    ])
      expect(screen.queryByText(text)).toBeNull();
  });
});

function renderPanel(
  messages: Message[],
  overrides: Partial<Parameters<typeof ChatPanel>[0]> = {},
) {
  const onInput = vi.fn();
  render(
    <ChatPanel
      messages={messages}
      input=""
      onInput={onInput}
      busy={false}
      activity={[]}
      onSend={vi.fn()}
      onEdit={vi.fn()}
      {...overrides}
    />,
  );
  return { onInput };
}
