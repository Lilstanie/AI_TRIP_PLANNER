import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageItem } from "@/components/chat/MessageItem";

describe("MessageItem", () => {
  it("renders a user message as a right-aligned bubble", () => {
    const { container } = render(<MessageItem message={{ role: "user", text: "Plan Kyoto" }} />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains("msg-item--user")).toBe(true);
    const bubble = within(row).getByText("Plan Kyoto");
    expect(bubble.classList.contains("msg-item__bubble")).toBe(true);
    expect(within(row).getByText("You")).toBeTruthy();
  });

  it("renders an agent message full-width with no bubble", () => {
    const { container } = render(
      <MessageItem message={{ role: "agent", text: "Here's the plan." }} />,
    );
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains("msg-item--agent")).toBe(true);
    expect(row.querySelector(".msg-item__bubble")).toBeNull();
    expect(within(row).getByText("Here's the plan.").closest(".msg-item__body")).toBeTruthy();
    expect(within(row).getByText("Travel planning assistant")).toBeTruthy();
  });

  it("renders the turn's Think fold above the reply it produced", () => {
    const { container } = render(
      <MessageItem
        message={{
          role: "agent",
          text: "Here's the plan.",
          activity: [
            { type: "agent_started", agent: "itinerary", round: 1 },
            { type: "agent_completed", agent: "itinerary", round: 1, summary: "3 days planned." },
          ],
        }}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    const fold = within(row).getByRole("region", { name: "Thinking process" });
    const body = within(row)
      .getByText("Here's the plan.")
      .closest(".msg-item__body") as HTMLElement;
    expect(fold.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no fold for a reply without a transcript", () => {
    render(<MessageItem message={{ role: "agent", text: "Hi." }} />);
    expect(screen.queryByRole("region", { name: "Thinking process" })).toBeNull();
  });

  it("formats today's clock as HH:mm and omits it entirely without a timestamp", () => {
    const now = new Date();
    now.setHours(9, 5, 0, 0);
    const { container, rerender } = render(
      <MessageItem message={{ role: "user", text: "Hi", at: now.getTime() }} />,
    );
    expect(container.querySelector(".msg-item__clock")?.textContent).toBe("09:05");

    rerender(<MessageItem message={{ role: "user", text: "Hi" }} />);
    expect(container.querySelector(".msg-item__clock")).toBeNull();
  });

  it("formats another day's clock with a short date", () => {
    const other = new Date();
    other.setDate(other.getDate() - 2);
    other.setHours(14, 30, 0, 0);
    const { container } = render(
      <MessageItem message={{ role: "agent", text: "Earlier", at: other.getTime() }} />,
    );
    const clock = container.querySelector(".msg-item__clock")?.textContent ?? "";
    expect(clock).toContain("14:30");
    expect(clock).not.toBe("14:30");
  });

  it("renders lightweight markdown -- lists and bold -- without raw HTML", () => {
    render(
      <MessageItem
        message={{
          role: "agent",
          text: "**Day 1**\n\n- Visit the museum\n- <script>alert(1)</script>",
        }}
      />,
    );
    expect(screen.getByText("Day 1").tagName).toBe("STRONG");
    expect(screen.getByText("Visit the museum").closest("li")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("opens links in a new tab without a referrer", () => {
    render(
      <MessageItem
        message={{ role: "agent", text: "See [this trip](https://example.test/trip)." }}
      />,
    );
    const link = screen.getByRole("link", { name: "this trip" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
  it("reveals the newest reply word by word, in order, with the text intact", () => {
    const { container } = render(
      <MessageItem
        message={{ role: "agent", text: "**Day 1**\n\nWalk the old town at dawn." }}
        animate
      />,
    );
    const body = container.querySelector(".msg-item__body") as HTMLElement;
    const words = [...body.querySelectorAll(".msg-reveal__word")];
    expect(words.map((w) => w.textContent)).toEqual([
      "Day",
      "1",
      "Walk",
      "the",
      "old",
      "town",
      "at",
      "dawn.",
    ]);

    // Staggered, increasing, and the whole reveal stays inside a second.
    const delays = words.map((w) => Number.parseFloat((w as HTMLElement).style.animationDelay));
    expect(delays[0]).toBe(0);
    expect(delays.every((d, i) => i === 0 || d > delays[i - 1])).toBe(true);
    expect(delays[delays.length - 1]).toBeLessThanOrEqual(700);

    // Markdown still renders, and the reply reads as one run of text.
    expect(screen.getByText("Day", { selector: "strong span" }).closest("strong")).toBeTruthy();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "P" && element.textContent === "Walk the old town at dawn.",
      ),
    ).toBeTruthy();
  });

  it("compresses the stagger so a long reply is still revealed within the budget", () => {
    const { container } = render(
      <MessageItem
        message={{ role: "agent", text: Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ") }}
        animate
      />,
    );
    const words = [...container.querySelectorAll(".msg-reveal__word")];
    expect(words).toHaveLength(200);
    const lastDelay = Number.parseFloat((words[199] as HTMLElement).style.animationDelay);
    expect(lastDelay).toBeLessThanOrEqual(700);
  });

  it("leaves code spans unsplit", () => {
    const { container } = render(
      <MessageItem message={{ role: "agent", text: "Run `pnpm dev` now." }} animate />,
    );
    const code = container.querySelector("code") as HTMLElement;
    expect(code.querySelector(".msg-reveal__word")).toBeNull();
    expect(code.textContent).toBe("pnpm dev");
  });

  it("does not animate a reply that is not the newest one", () => {
    const { container } = render(<MessageItem message={{ role: "agent", text: "Old reply." }} />);
    expect(container.querySelector(".msg-reveal__word")).toBeNull();
    expect(screen.getByText("Old reply.")).toBeTruthy();
  });

  it("never replays: the reveal is latched at mount", () => {
    const message = { role: "agent", text: "Settled." } as const;
    const { container, rerender } = render(<MessageItem message={message} />);
    rerender(<MessageItem message={message} animate />);
    expect(container.querySelector(".msg-reveal__word")).toBeNull();

    const fresh = render(<MessageItem message={message} animate />);
    const first = fresh.container.querySelector(".msg-reveal__word");
    fresh.rerender(<MessageItem message={message} animate />);
    // Same element, so the CSS animation is not restarted by a re-render.
    expect(fresh.container.querySelector(".msg-reveal__word")).toBe(first);
  });
  it("shows the files a message was sent with, above its bubble", () => {
    const { container } = render(
      <MessageItem
        message={{
          role: "user",
          text: "Is this the shrine?",
          attachments: [
            {
              name: "shrine.jpg",
              mediaType: "image/jpeg",
              kind: "image",
              thumbnail: "data:image/jpeg;base64,AAAA",
              bytes: 2048,
            },
            { name: "notes.md", mediaType: "text/markdown", kind: "text", bytes: 512 },
          ],
        }}
      />,
    );

    const row = container.firstElementChild as HTMLElement;
    const list = within(row).getByRole("list", { name: "Attached files" });
    // The chips come before the bubble, as DSH's attachment row does.
    expect(list.compareDocumentPosition(within(row).getByText("Is this the shrine?"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const [photo, notes] = within(list).getAllByRole("listitem");
    expect(within(photo as HTMLElement).getByText("shrine.jpg")).toBeTruthy();
    expect((photo as HTMLElement).querySelector("img")?.getAttribute("alt")).toBe("");
    expect(within(notes as HTMLElement).getByText("notes.md")).toBeTruthy();
    // A sent message shows its files; it cannot un-send one.
    expect(within(list).queryByRole("button")).toBeNull();
  });

  it("renders a message with no attachments exactly as before", () => {
    const { container } = render(<MessageItem message={{ role: "user", text: "Plan Kyoto" }} />);
    expect(container.querySelector(".attachment-chips")).toBeNull();
  });
});
