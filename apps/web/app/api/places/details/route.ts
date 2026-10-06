import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import { GoogleRequestError, placesUnavailable, placeDetails } from "@/lib/integrations/google";

const DetailsRequest = z.object({ placeId: z.string().min(1).max(300) });

export async function POST(request: Request) {
  const parsed = DetailsRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(noticeBody({ key: "A place ID is required." }), { status: 400 });
  try {
    return Response.json(
      { place: await placeDetails(parsed.data.placeId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const upstream = error instanceof GoogleRequestError ? error.status : undefined;
    if (upstream === 400 || upstream === 404)
      return Response.json(noticeBody({ key: "This saved place is no longer available." }), {
        status: 404,
      });
    return Response.json(noticeBody(placesUnavailable(upstream)), {
      status: upstream === 429 ? 429 : 502,
    });
  }
}
