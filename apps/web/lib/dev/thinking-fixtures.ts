import type { AgentProgressEvent } from "@trip/shared";

/**
 * One run's progress frames, in the shape the orchestrator streams them.
 *
 * This is a development fixture: it exists so the thinking transcript can be
 * rendered, in a browser, without spending a provider call and without waiting
 * for a real plan. `/debug/thinking` renders it; nothing in the product imports
 * it.
 */

/** Reasoning deltas of one model call, streamed the way the emitter paces them:
 *  every delta of the call shares one index, and the client appends them. */
const reasoning = (
  agent: "itinerary" | "dining",
  episode: number,
  deltas: string[],
): AgentProgressEvent[] =>
  deltas.map((text) => ({ type: "agent_reasoning", agent, round: 1, episode, index: 0, text }));

/** Stand-in property pages, one per stay row that has one. */
const STAY_SITES: Record<number, string> = {
  0: "https://www.hilton.com/",
  2: "https://www.marriott.com/",
  5: "https://www.ihg.com/",
  9: "https://www.accor.com/",
};

const sights: AgentProgressEvent[] = [
  {
    type: "tool_started",
    agent: "itinerary",
    round: 1,
    callId: "itinerary:1:1",
    tool: "maps.places",
    label: "Search places",
    summary: "sight near Sydney",
    args: { near: "Sydney", category: "sight" },
  },
  {
    type: "tool_completed",
    agent: "itinerary",
    round: 1,
    callId: "itinerary:1:1",
    tool: "maps.places",
    label: "Search places",
    resultSummary: "6 place results",
    resultCount: 6,
    resultRows: [
      // A place whose provider reported its own site: the row shows that site's
      // icon instead of the category glyph.
      {
        label: "Sydney Opera House",
        detail: "sight · 9.1/10",
        kind: "attraction",
        url: "https://www.sydneyoperahouse.com/",
      },
      { label: "Darling Harbour", detail: "sight · 8.6/10", kind: "attraction" },
      { label: "Royal Botanic Garden", detail: "park · 8.8/10", kind: "nature" },
      { label: "Art Gallery of New South Wales", detail: "museum · 8.7/10", kind: "museum" },
      { label: "Queen Victoria Building", detail: "shopping · 8.4/10", kind: "shopping" },
      // An older emitter sends no kind: the tool's own glyph stands in.
      { label: "Mrs Macquarie's Chair", detail: "viewpoint · 9.0/10" },
    ],
  },
];

const food: AgentProgressEvent[] = [
  {
    type: "tool_started",
    agent: "dining",
    round: 1,
    callId: "dining:1:1",
    tool: "maps.places",
    label: "Search places",
    summary: "food near The Rocks",
    args: { near: "The Rocks", category: "food" },
  },
  {
    type: "tool_completed",
    agent: "dining",
    round: 1,
    callId: "dining:1:1",
    tool: "maps.places",
    label: "Search places",
    resultSummary: "3 place results",
    resultCount: 3,
    resultRows: [
      { label: "Quay", detail: "restaurant · 9.3/10", kind: "restaurant" },
      { label: "Pottery Cafe", detail: "cafe · 8.5/10", kind: "cafe" },
      { label: "The Lord Nelson", detail: "pub · 8.7/10", kind: "nightlife" },
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
  // One model call, streamed as paced deltas that share an index.
  ...reasoning("itinerary", 0, [
    "The traveller wants three days in Sydney for two people",
    " with a 4,000 AUD budget.\nDay planning is not optional, so itinerary is first; ",
    "the stay needs comparing before anything can be costed.\n",
  ]),
  // An older emitter numbered each paced flush; the client still merges them.
  { type: "agent_reasoning", agent: "dining", round: 1, episode: 0, index: 0, text: "Dining should follow the day plan " },
  { type: "agent_reasoning", agent: "dining", round: 1, episode: 0, index: 1, text: "rather than lead it.\nStart near The Rocks.\n" },
  ...sights,
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
      // A live search reports a page for some properties and not others; these
      // stand in for the ones it does, so the list shows site icons and
      // category glyphs side by side.
      ...(STAY_SITES[index] ? { url: STAY_SITES[index]! } : {}),
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
    resultSummary: "3 route options",
    resultCount: 3,
    resultRows: [
      { label: "train", detail: "train · 22m · AUD 18.50", kind: "transit" },
      { label: "drive", detail: "drive · 25m · AUD 60.00", kind: "drive" },
      { label: "walk", detail: "The Rocks → Circular Quay · 6m", kind: "walk" },
    ],
  },
  {
    type: "agent_completed",
    agent: "transport",
    round: 1,
    summary: "Airport transfer by train.",
    outcome: "Produced transport section.",
  },
  { type: "agent_started", agent: "dining", round: 1, objective: "Find dinner near The Rocks." },
  ...food,
  { type: "agent_completed", agent: "dining", round: 1, summary: "3 dinners picked.", outcome: "Produced dining section." },
  { type: "agent_started", agent: "destination-guide", round: 1 },
  {
    type: "tool_started",
    agent: "destination-guide",
    round: 1,
    callId: "destination-guide:1:1",
    tool: "weather.forecast",
    label: "Check weather",
    summary: "Sydney · 2026-11-10–2026-11-13",
    args: { city: "Sydney", from: "2026-11-10", to: "2026-11-13" },
  },
  {
    type: "tool_completed",
    agent: "destination-guide",
    round: 1,
    callId: "destination-guide:1:1",
    tool: "weather.forecast",
    label: "Check weather",
    resultSummary: "3 days of forecast",
    resultCount: 3,
    resultRows: [
      { label: "Tue 10 Nov", detail: "Sunny · 17–24°C", kind: "weather" },
      { label: "Wed 11 Nov", detail: "Showers · 16–21°C", kind: "weather" },
      { label: "Thu 12 Nov", detail: "Partly cloudy · 17–23°C", kind: "weather" },
    ],
  },
  { type: "agent_completed", agent: "destination-guide", round: 1, summary: "Mild and mostly dry." },
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

/**
 * The same run mid-flight: the stay search has started and not returned, and
 * the itinerary supervisor is still thinking — its last deltas arrive after
 * the search began, so its Think row is the streaming tail.
 */
export const thinkingFixtureRunning: AgentProgressEvent[] = thinkingFixture
  .filter(
    (event) =>
      !(event.type === "tool_completed" && event.callId === "accommodation:1:1") &&
      !(event.type === "agent_completed" && event.agent === "accommodation") &&
      !(
        event.type === "coordinator" &&
        (event.phase === "conflicts" || event.phase === "revision" || event.phase === "assembly")
      ) &&
      !(event.round === 2),
  )
  .concat(
    reasoning("itinerary", 1, [
      "Day one should stay close to the harbour.\n",
      "Opera House in the morning, then the Botanic Garden;",
      " Darling Harbour works best in the evening,",
      " once the stay is confirmed near The Rocks",
    ]),
  );
