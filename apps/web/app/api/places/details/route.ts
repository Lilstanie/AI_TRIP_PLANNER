import { z } from "zod";
import {
  GoogleNotConfiguredError,
  GoogleRequestError,
  placeDetails,
} from "@/lib/integrations/google";

const DetailsRequest = z.object({ placeId: z.string().min(1).max(300) });

export async function POST(request: Request) {
  const parsed = DetailsRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A place ID is required." }, { status: 400 });
  try {
    return Response.json(
      { place: await placeDetails(parsed.data.placeId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // A missing key is permanent: every retry fails the same way, so the message
    // must not invite one. 503 says the deployment, not the request, is at fault.
    if (error instanceof GoogleNotConfiguredError)
      return Response.json(
        { error: "Google Places is not set up for this app." },
        { status: 503 },
      );
    const upstream = error instanceof GoogleRequestError ? error.status : undefined;
    if (upstream === 400 || upstream === 404)
      return Response.json({ error: "This saved place is no longer available." }, { status: 404 });
    return Response.json(
      {
        error:
          upstream === 429
            ? "Google Places is busy. Please retry shortly."
            : "Google Places is temporarily unavailable. Please retry.",
      },
      { status: upstream === 429 ? 429 : 502 },
    );
  }
}
