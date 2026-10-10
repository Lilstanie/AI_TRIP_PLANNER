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
];

export const SMOKE_JOURNEYS = LOCAL_JOURNEYS.filter((journey) => journey.smoke).map(
  (journey) => journey.name,
);

export const SUPPORTED_JOURNEYS = LOCAL_JOURNEYS.map((journey) => journey.name);
