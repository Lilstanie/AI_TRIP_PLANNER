import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import {
  GoogleNotConfiguredError,
  GoogleRequestError,
  PHOTO_NAME,
  PHOTO_WIDTHS,
  placePhotoUri,
  placesUnavailable,
  type PhotoWidth,
} from "@/lib/integrations/google";

const PhotoRequest = z.object({
  name: z.string().regex(PHOTO_NAME),
  width: z.coerce
    .number()
    .refine((value): value is PhotoWidth => (PHOTO_WIDTHS as readonly number[]).includes(value)),
});

/**
 * Serve one place photo as a redirect to Google's image host, so an `<img>` can point here and
 * the server key never reaches the browser. The photo name comes from a fresh Places lookup in the
 * browser's memory; nothing is cached here, because Google forbids caching photo names.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = PhotoRequest.safeParse({ name: params.get("name"), width: params.get("width") });
  if (!parsed.success) return Response.json(noticeBody({ key: "Unknown photo." }), { status: 400 });
  try {
    const location = await placePhotoUri(parsed.data.name, parsed.data.width);
    return new Response(null, {
      status: 302,
      headers: { Location: location, "Cache-Control": "no-store" },
    });
  } catch (error) {
    // A missing key is permanent: every retry fails the same way, so the message
    // must not invite one. 503 says the deployment, not the request, is at fault.
    if (error instanceof GoogleNotConfiguredError)
      return Response.json(noticeBody({ key: "Google Places is not set up for this app." }), {
        status: 503,
      });
    const upstream = error instanceof GoogleRequestError ? error.status : undefined;
    // An expired or unknown name reads as "no photo", which the card already handles.
    if (upstream === 400 || upstream === 404)
      return Response.json(noticeBody({ key: "This photo is no longer available." }), {
        status: 404,
      });
    return Response.json(noticeBody(placesUnavailable(upstream)), {
      status: upstream === 429 ? 429 : 502,
    });
  }
}
