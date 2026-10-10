import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import { mapProvider } from "@/lib/map-provider";
import { placeErrorResponse } from "@/lib/map-provider/place-error-response";

const DetailsRequest = z.object({
  placeId: z.string().min(1).max(300),
  language: z.enum(["en", "zh"]).optional(),
});

export async function POST(request: Request) {
  const parsed = DetailsRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(noticeBody({ key: "A place ID is required." }), { status: 400 });
  try {
    const { value, source } = await mapProvider(request).placeDetails(
      parsed.data.placeId,
      parsed.data.language,
    );
    return Response.json({ place: value, source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placeErrorResponse(error, { key: "This saved place is no longer available." });
  }
}
