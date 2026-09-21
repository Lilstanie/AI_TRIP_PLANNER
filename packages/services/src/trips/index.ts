import { TripPlan, type TripPlan as TripPlanData } from "@trip/shared";
import { jsonStore } from "../durable";

type StoredTrip = {
  plan: TripPlanData;
  updatedAt: string;
};

const tripKey = (tripId: string) => `trip:plan:${tripId}`;

/**
 * Server-side plan storage. The plan is the whole artifact: it carries the
 * itinerary, its budget and any unresolved conflicts, and nothing else.
 */
export const tripStore = {
  async get(tripId: string): Promise<TripPlanData | undefined> {
    const stored = await jsonStore.get<StoredTrip>(tripKey(tripId));
    if (!stored) return undefined;
    const parsed = TripPlan.safeParse(stored.plan);
    return parsed.success ? parsed.data : undefined;
  },
  async set(plan: TripPlanData): Promise<void> {
    const parsed = TripPlan.parse(plan);
    await jsonStore.set<StoredTrip>(tripKey(parsed.tripId), {
      plan: parsed,
      updatedAt: new Date().toISOString(),
    });
  },
};
