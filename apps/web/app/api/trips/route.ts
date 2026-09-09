import { NextResponse } from "next/server";
import { auth, memory } from "@trip/services";
import { TripListResponse, TripSession } from "@trip/shared";

export async function GET(request: Request) {
  const user = await auth.currentUser();
  const tripId = new URL(request.url).searchParams.get("tripId")?.trim();

  if (!tripId) {
    const trips = (await memory.listTrips?.(user.id)) ?? [];
    return NextResponse.json(TripListResponse.parse({ trips }));
  }

  const trip = await memory.getTrip?.(tripId);
  if (!trip || trip.userId !== user.id) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  const turns = await memory.getShortTerm(tripId);
  return NextResponse.json(TripSession.parse({ trip, turns }));
}
