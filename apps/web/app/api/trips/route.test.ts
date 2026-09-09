import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentUserMock, getShortTermMock, getTripMock, listTripsMock } = vi.hoisted(() => ({
  currentUserMock: vi.fn(),
  getShortTermMock: vi.fn(),
  getTripMock: vi.fn(),
  listTripsMock: vi.fn(),
}));

vi.mock("@trip/services", () => ({
  auth: { currentUser: currentUserMock },
  memory: {
    getShortTerm: getShortTermMock,
    getTrip: getTripMock,
    listTrips: listTripsMock,
  },
}));

import { GET } from "./route";

const trip = {
  tripId: "trip-1",
  userId: "demo-user",
  title: "Sydney",
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:02:00.000Z",
  plan: {
    tripId: "trip-1",
    planVersion: "plan-v1",
    brief: {
      tripId: "trip-1",
      userId: "demo-user",
      destination: "Sydney",
      dates: ["2026-10-01", "2026-10-05"],
      groupSize: 2,
      budgetTotal: 3000,
    },
    round: 1,
    budgetTotal: 3000,
    estTotal: 1800,
    overrunPct: -40,
    sections: [],
    hitl: [],
  },
};

describe("GET /api/trips", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    currentUserMock.mockResolvedValue({ id: "demo-user", displayName: "Demo User" });
  });

  it("lists the signed-in user's saved trips", async () => {
    const summary = {
      tripId: "trip-1",
      userId: "demo-user",
      title: "Sydney",
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
      destination: "Sydney",
      planVersion: "plan-v1",
    };
    listTripsMock.mockResolvedValue([summary]);

    const response = await GET(new Request("http://localhost/api/trips"));

    expect(response.status).toBe(200);
    expect(listTripsMock).toHaveBeenCalledWith("demo-user");
    expect(await response.json()).toEqual({ trips: [summary] });
  });

  it("returns a trip with its restored chat turns", async () => {
    getTripMock.mockResolvedValue(trip);
    getShortTermMock.mockResolvedValue([{ role: "user", content: "Plan Sydney" }]);

    const response = await GET(new Request("http://localhost/api/trips?tripId=trip-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      trip: { tripId: "trip-1", plan: { planVersion: "plan-v1" } },
      turns: [{ role: "user", content: "Plan Sydney" }],
    });
  });

  it("does not expose another user's trip", async () => {
    getTripMock.mockResolvedValue({ ...trip, userId: "someone-else" });

    const response = await GET(new Request("http://localhost/api/trips?tripId=trip-1"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Trip not found." });
    expect(getShortTermMock).not.toHaveBeenCalled();
  });
});
