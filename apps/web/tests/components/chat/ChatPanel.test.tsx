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
  }) as AgentProgressEvent;

function Chat({ activityEvents = [] }: { activityEvents?: AgentProgressEvent[] }) {
  const [input, setInput] = useState("");
  return (
    <ChatPanel
      messages={[{ role: "agent", text: "Hello" }]}
      input={input}
      onInput={setInput}
      busy={false}
      activity={activityEvents}
      onSend={vi.fn()}
      onDecision={vi.fn()}
      onEdit={vi.fn()}
    />
  );
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
          onDecision={vi.fn()}
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
          onDecision={vi.fn()}
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
        onDecision={vi.fn()}
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
    ["agent_started", "Running"],
    ["agent_completed", "Complete"],
    ["agent_failed", "Needs attention"],
    ["unexpected", "Unknown status"],
  ])("exposes %s progress as %s and keeps details collapsed", (type, status) => {
    render(<Chat activityEvents={[activity(type)]} />);

    const progress = screen.getByRole("region", { name: "Planning progress" });
    expect(
      within(progress).getByRole("listitem", { name: new RegExp(`Day plan.*${status}`) }),
    ).toBeTruthy();
    const details = within(progress).getByRole("group", { name: "Day plan details" });
    expect(details.hasAttribute("open")).toBe(false);
    fireEvent.click(details.querySelector("summary")!);
    expect(details.hasAttribute("open")).toBe(true);
  });

  it("shows high-level planning stages, an answer placeholder, and a stop action while busy", () => {
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
        onDecision={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("Thinking", { selector: "strong" })).toBeTruthy();
    expect(screen.getByLabelText("Answer in progress")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop planning" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

function renderPanel(messages: Message[], overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  const onInput = vi.fn();
  render(
    <ChatPanel
      messages={messages}
      input=""
      onInput={onInput}
      busy={false}
      activity={[]}
      onSend={vi.fn()}
      onDecision={vi.fn()}
      onEdit={vi.fn()}
      {...overrides}
    />,
  );
  return { onInput };
}

describe("ChatPanel date picker", () => {
  it("opens the calendar automatically when the assistant asks about travel dates", async () => {
    renderPanel([{ role: "agent", text: "What dates are you hoping to travel?" }]);

    // A generous timeout: this is the first test to trigger next/dynamic's
    // import of DateRangePicker (react-day-picker + its stylesheet), and a cold
    // module transform can take longer than the default 1s poll. 5s was still
    // short enough to fail during a parallel full-suite run while passing when
    // this file ran alone — the failure was the clock, never the behaviour.
    expect(
      await screen.findByRole(
        "heading",
        { name: /when are you travelling/i },
        { timeout: 15_000 },
      ),
    ).toBeTruthy();
  });

  it("does not auto-open for an unrelated assistant message", () => {
    renderPanel([{ role: "agent", text: "Sydney is a fantastic choice for a family trip!" }]);

    expect(screen.queryByRole("heading", { name: /when are you travelling/i })).toBeNull();
  });

  it("does not auto-open when the traveller (not the assistant) mentions dates", () => {
    renderPanel([{ role: "user", text: "What dates work for you?" }]);

    expect(screen.queryByRole("heading", { name: /when are you travelling/i })).toBeNull();
  });

  it("still opens manually via the calendar button regardless of message content", async () => {
    renderPanel([]);

    fireEvent.click(screen.getByRole("button", { name: /pick travel dates from a calendar/i }));

    expect(
      await screen.findByRole("heading", { name: /when are you travelling/i }),
    ).toBeTruthy();
  });

  it("fills the composer with the picked dates instead of sending immediately", async () => {
    const { onInput } = renderPanel([{ role: "agent", text: "What dates are you travelling?" }]);
    await screen.findByRole("heading", { name: /when are you travelling/i });

    fireEvent.click(await screen.findByRole("button", { name: /use these dates/i }));

    // The confirm button starts disabled until a full range is picked, so
    // clicking it while empty must be a no-op — text still typed by the
    // traveller, not silently overwritten with an incomplete range.
    await waitFor(() => expect(onInput).not.toHaveBeenCalled());
  });
});
