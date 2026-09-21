import type { AgentProgressEvent } from "@trip/shared";

/**
 * One run's progress frames, in the shape the orchestrator streams them.
 *
 * This is a development fixture: it exists so the thinking transcript can be
 * rendered, in a browser, without spending a provider call and without waiting
 * for a real plan. `/debug/thinking` renders it; nothing in the product imports
 * it.
 */

const places = (agent: "itinerary" | "dining", callId: string, near: string): AgentProgressEvent[] => [
  {
    type: "tool_started",
    agent,
    round: 1,
    callId,
    tool: "maps.places",
    label: "Search places",
    summary: `sight near ${near}`,
    args: { near, category: "sight" },
  },
  {
    type: "tool_completed",
    agent,
    round: 1,
    callId,
    tool: "maps.places",
    label: "Search places",
    resultSummary: "5 place results",
    resultCount: 5,
    resultRows: [
      { label: "Sydney Opera House", detail: "sight · 9.1/10" },
      { label: "Royal Botanic Garden", detail: "park · 8.8/10" },
      { label: "Art Gallery of New South Wales", detail: "museum · 8.7/10" },
      { label: "The Rocks Discovery Museum", detail: "museum · 8.2/10" },
      { label: "Mrs Macquarie's Chair", detail: "viewpoint · 9.0/10" },
    ],
  },
];

/** A turn that searched, compared 20 stays, picked one, then revised for budget. */
export const thinkingFixture: AgentProgressEvent[] = [
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
    text:
      "The traveller wants three days in Sydney for two people with a 4,000 AUD budget.\n" +
      "Day planning is not optional, so itinerary is first; the stay needs comparing before\n" +
      "anything can be costed, and dining should follow the day plan rather than lead it.\n",
  },
  ...places("itinerary", "itinerary:1:1", "Sydney"),
  {
    type: "agent_started",
    agent: "accommodation",
    round: 1,
    objective: "Compare eligible Sydney stays for 2 guests, 10–13 November 2026.",
  },
  {
    type: "tool_started",
    agent: "accommodation",
    round: 1,
    callId: "accommodation:1:1",
    tool: "booking.searchStays",
    label: "Search stays",
    summary: "Sydney · 2026-11-10–2026-11-13",
    args: { city: "Sydney", checkIn: "2026-11-10", checkOut: "2026-11-13", guests: "2" },
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
      label: `Sydney stay ${String(index + 1).padStart(2, "0")}`,
      detail: `AUD ${90 + index * 11}/night · ${(7 + (index % 25) / 10).toFixed(1)}/10 · ${
        index % 3 === 0 ? "No free cancellation" : "Free cancellation"
      }`,
    })),
    resultTruncated: true,
  },
  {
    type: "agent_completed",
    agent: "accommodation",
    round: 1,
    summary: "1 room, 3 nights in Sydney · AUD 690.00",
    outcome: "Produced accommodation section.",
    choice: {
      title: "Stay in Sydney",
      selected: {
        label: "Harbour Rocks Hotel",
        detail: "The Rocks · AUD 690.00 total · 9.1/10 · Free cancellation",
      },
      rationale: "Highest rating within the nightly budget, with free cancellation.",
      alternatives: [
        { label: "Sydney Backpackers", detail: "Haymarket · AUD 330.00 total · 8.4/10" },
        { label: "The Ultimo", detail: "Haymarket · AUD 486.00 total · 8.8/10" },
      ],
    },
  },
  {
    type: "agent_started",
    agent: "itinerary",
    round: 1,
    objective: "Build a three-day Sydney plan with a relaxed pace.",
  },
  {
    type: "agent_completed",
    agent: "itinerary",
    round: 1,
    summary: "3 days planned.",
    outcome: "Produced itinerary section.",
  },
  { type: "agent_started", agent: "transport", round: 1 },
  {
    type: "tool_started",
    agent: "transport",
    round: 1,
    callId: "transport:1:1",
    tool: "maps.route",
    label: "Check route",
    summary: "Sydney Airport → The Rocks",
    args: { from: "Sydney Airport", to: "The Rocks", date: "2026-11-10" },
  },
  {
    type: "tool_completed",
    agent: "transport",
    round: 1,
    callId: "transport:1:1",
    tool: "maps.route",
    label: "Check route",
    resultSummary: "1 route option",
    resultCount: 1,
    resultRows: [{ label: "train", detail: "train · 22m · AUD 18.50" }],
  },
  {
    type: "agent_completed",
    agent: "transport",
    round: 1,
    summary: "Airport transfer by train.",
    outcome: "Produced transport section.",
  },
  ...places("dining", "dining:1:1", "The Rocks"),
  {
    type: "coordinator",
    phase: "conflicts",
    round: 1,
    summary: "Checked budget and schedules: 1 revision request.",
    constraints: ["cut accommodation cost by ~20%"],
  },
  {
    type: "coordinator",
    phase: "revision",
    round: 2,
    summary: "Revising affected sections.",
    constraints: ["cut accommodation cost by ~20%"],
  },
  {
    type: "agent_started",
    agent: "accommodation",
    round: 2,
    objective: "Cut the Sydney stay by about 20% without losing free cancellation.",
    constraints: ["cut accommodation cost by ~20%"],
  },
  {
    type: "agent_completed",
    agent: "accommodation",
    round: 2,
    summary: "Cheaper stay selected: AUD 540.00.",
    outcome: "Revised accommodation after: over budget.",
  },
  { type: "coordinator", phase: "assembly", round: 2, summary: "Assembling the plan." },
];

/** The same run one frame earlier: the stay search has started and not returned. */
export const thinkingFixtureRunning: AgentProgressEvent[] = thinkingFixture
  .filter(
    (event) =>
      !(event.type === "tool_completed" && event.callId === "accommodation:1:1") &&
      !(
        event.type === "coordinator" &&
        (event.phase === "conflicts" || event.phase === "revision" || event.phase === "assembly")
      ) &&
      !(event.round === 2),
  )
  .concat({
    type: "tool_started",
    agent: "accommodation",
    round: 1,
    callId: "accommodation:1:1",
    tool: "booking.searchStays",
    label: "Search stays",
    summary: "Sydney · 2026-11-10–2026-11-13",
    args: { city: "Sydney", checkIn: "2026-11-10", checkOut: "2026-11-13", guests: "2" },
  });
