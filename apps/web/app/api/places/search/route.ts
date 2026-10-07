import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import {
  GoogleNotConfiguredError,
  GoogleRequestError,
  placesUnavailable,
  searchPlaces,
} from "@/lib/integrations/google";

const SearchRequest = z.object({
  text: z.string().trim().min(1).max(200),
  destination: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const parsed = SearchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(noticeBody({ key: "Enter a place name to search." }), { status: 400 });
  try {
    return Response.json(
      { places: await searchPlaces(parsed.data.text, parsed.data.destination) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // A missing key is permanent: every retry fails the same way, so the message
    // must not invite one. 503 says the deployment, not the request, is at fault.
    if (error instanceof GoogleNotConfiguredError)
      return Response.json(noticeBody({ key: "Google Places is not set up for this app." }), {
        status: 503,
      });
    // Upstream failures are retryable; keep provider details and the query out of the message.
    const status = error instanceof GoogleRequestError && error.status === 429 ? 429 : 502;
    return Response.json(noticeBody(placesUnavailable(status)), { status });
  }
}
