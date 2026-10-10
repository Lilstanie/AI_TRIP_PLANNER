import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import { plan } from "@/tests/fixtures/workspace";

const askUser = (withPlan: boolean) =>
  new Response(
    JSON.stringify({
      type: "ask_user",
      reply: "Before I reshuffle the days, one thing:",
      known: { destination: plan.brief.destination, groupSize: 2 },
      questions: [
        {
          id: "pace",
          header: "Pace",
          question: "How busy should each day be?",
          options: [{ label: "Relaxed (Recommended)" }, { label: "Packed" }],
        },
        { id: "notes", question: "Anything else?", options: [{ label: "No" }] },
      ],
      ...(withPlan ? { plan } : {}),
    }) + "\n",
  );
const complete = () =>
  new Response(
    JSON.stringify({ type: "complete", response: { reply: "Days reshuffled", plan } }) + "\n",
  );

function stubFetch(...responses: Response[]) {
  let next = 0;
  const fetcher = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/data-mode")
      return Promise.resolve(
        Response.json({ configured: "mock", providers: { hotelsAndFlights: false, maps: false } }),
      );
    if (url === "/api/chat") return Promise.resolve(responses[next++]!);
    return Promise.resolve(Response.json({ places: [] }));
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const chatBodies = (fetcher: ReturnType<typeof stubFetch>) =>
  fetcher.mock.calls
    .filter(([url]) => url === "/api/chat")
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
const sendMessage = (text: string) => {
  fireEvent.change(screen.getByLabelText("Message AI Trip Planner"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};
const log = () =>
  within(document.querySelector<HTMLElement>(".workspace-panel--chat")!).getByRole("log");

const reply = (text: string) =>
  within(log()).getByText((_content, el) => el?.tagName === "P" && el.textContent === text);

describe("Structured questions in the workspace", () => {
  it("seats the question card in place of the composer and sends the answers with known", async () => {
    const fetcher = stubFetch(askUser(true), complete());
    render(<Workspace initialPlan={plan} />);
    sendMessage("make it calmer");

    await screen.findByRole("heading", { name: "How busy should each day be?" });
    expect(reply("Before I reshuffle the days, one thing:")).toBeTruthy();
    expect(screen.queryByLabelText("Message AI Trip Planner")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Relaxed" }));
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(within(log()).getByText(/Pace: Relaxed/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "How busy should each day be?" })).toBeNull();
    expect(screen.getByLabelText("Message AI Trip Planner")).toBeTruthy();
    await waitFor(() => reply("Days reshuffled"));

    const [, answer] = chatBodies(fetcher);
    expect(answer.message).toBe("Pace: Relaxed\nAnything else?: No");
    expect(answer.known).toEqual({ destination: plan.brief.destination, groupSize: 2 });
    expect(answer.plan).toMatchObject({ tripId: plan.tripId });
    expect(answer.brief).toMatchObject({ destination: plan.brief.destination });
  });

  it("dismisses the card with the close button and restores the composer", async () => {
    stubFetch(askUser(false));
    render(<Workspace initialPlan={plan} />);
    sendMessage("make it calmer");
    await screen.findByRole("heading", { name: "How busy should each day be?" });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss all questions" }));
    expect(screen.queryByRole("heading", { name: "How busy should each day be?" })).toBeNull();
    expect(screen.getByLabelText("Message AI Trip Planner")).toBeTruthy();

    expect(reply("Before I reshuffle the days, one thing:")).toBeTruthy();
  });

  it("drops a pending question when the traveller starts a new chat", async () => {
    stubFetch(askUser(true));
    render(<Workspace initialPlan={plan} />);
    sendMessage("make it calmer");
    await screen.findByRole("heading", { name: "How busy should each day be?" });
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(screen.getByLabelText("Message AI Trip Planner")).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "How busy should each day be?" })).toBeNull();
  });
});
