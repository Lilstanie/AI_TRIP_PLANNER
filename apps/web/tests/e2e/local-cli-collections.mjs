export const LOCAL_JOURNEYS = [
  { name: "agent-lab-single-agent", smoke: true },
  { name: "agent-lab-replay", smoke: false },
];

export const SMOKE_JOURNEYS = LOCAL_JOURNEYS.filter((journey) => journey.smoke).map(
  (journey) => journey.name,
);

export const SUPPORTED_JOURNEYS = LOCAL_JOURNEYS.map((journey) => journey.name);
