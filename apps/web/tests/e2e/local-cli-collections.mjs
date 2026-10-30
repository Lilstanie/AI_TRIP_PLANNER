export const LOCAL_JOURNEYS = [
  {
    name: "agent-lab-single-agent",
    smoke: true,
    description:
      "Complete desktop and phone Agent Lab fixture journey with browser, API, keyboard, storage, and browser-error assertions.",
  },
  {
    name: "agent-lab-replay",
    smoke: false,
    description:
      "Tight-budget fixture journey covering artifact download, replay, comparison, invalid artifacts, and resulting UI and status.",
  },
  {
    name: "pending-ask-refresh",
    smoke: false,
    description:
      "Restores a pending question across reload and keeps it answerable after a failed submission.",
  },
  {
    name: "chat-generation",
    smoke: false,
    description:
      "Chat-owned generation across navigation, multiple Chats and Trips, control states, conflicts, deletion, and workspace teardown.",
  },
  {
    name: "new-chat",
    smoke: false,
    description:
      "Sidebar primary New chat entry, plain-chat Conversation-only sends, Trip association after Plan, and concurrent Chat isolation.",
  },
  {
    name: "trip-home-send",
    smoke: false,
    description:
      "Trip-home first-send atomicity, IME and keyboard handling, Chat identity, navigation state, and responsive sticky composer.",
  },
];

export const SMOKE_JOURNEYS = LOCAL_JOURNEYS.filter((journey) => journey.smoke).map(
  (journey) => journey.name,
);

export const SUPPORTED_JOURNEYS = LOCAL_JOURNEYS.map((journey) => journey.name);
