export const sydney = {
  id: "e2e-sydney",
  displayName: { text: "Sydney" },
  formattedAddress: "Sydney NSW, Australia",
  location: { latitude: -33.8688, longitude: 151.2093 },
  source: "osm",
};

export const seedTrip = () => {
  const tripId = "empty-day-trip";
  const plan = {
    tripId,
    brief: {
      tripId,
      userId: "local",
      destination: "Sydney",
      origin: "Honolulu",
      dates: ["2026-11-02", "2026-11-03"],
      groupSize: 1,
      budgetTotal: 400,
    },
    round: 1,
    budgetTotal: 400,
    estTotal: 100,
    overrunPct: 0,
    sections: [
      {
        id: "itinerary",
        label: "Day plan",
        status: "draft",
        summary: "Sydney stops",
        estCost: 100,
        proposal: {
          agent: "itinerary",
          summary: "Sydney stops",
          items: [
            {
              id: `${tripId}-stop-1`,
              kind: "activity",
              day: 1,
              detail: "Harbour walk",
              estCost: 100,
              startTime: "09:00",
              endTime: "10:00",
            },
          ],
          assumptions: [],
          conflictsWith: [],
        },
      },
    ],
  };
  const snapshot = {
    version: 3,
    id: `${tripId}-chat`,
    savedAt: "2026-10-16T00:00:00Z",
    plan,
    draft: {
      destination: "Sydney",
      origin: "Honolulu",
      start: "2026-11-02",
      end: "2026-11-03",
      groupSize: "1",
      budgetTotal: "400",
      preferences: [],
      nationality: "",
      roomAllocation: "shared",
      minRating: "0",
      freeCancellation: false,
    },
    messages: [],
    input: "",
  };
  const tripKey = `trip:${tripId}`;
  const conversationKey = `conversation:${snapshot.id}`;
  const catalog = {
    version: 4,
    activeConversationId: conversationKey,
    activeTripId: tripKey,
    conversations: [
      {
        id: conversationKey,
        title: "Sydney",
        updatedAt: snapshot.savedAt,
        tripId: tripKey,
        messages: [],
        input: "",
        snapshot,
      },
    ],
    trips: [
      {
        id: tripKey,
        title: "Sydney",
        updatedAt: snapshot.savedAt,
        conversationIds: [conversationKey],
        snapshot,
      },
    ],
    layout: {
      sidebar: { collapsed: false },
      preferences: { open: false, width: 280 },
      trip: { open: true, width: 340 },
      view: "chat",
      editorView: "map",
    },
  };
  return { snapshot, catalog };
};
