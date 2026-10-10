import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import { mapProvider } from "@/lib/map-provider";
import { placeErrorResponse } from "@/lib/map-provider/place-error-response";

const SearchRequest = z.object({
  text: z.string().trim().min(1).max(200),
  autocomplete: z.boolean().optional(),
  language: z.enum(["en", "zh"]).optional(),
  destination: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const parsed = SearchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(noticeBody({ key: "Enter a place name to search." }), { status: 400 });
  try {
    const { value, source } = await mapProvider(request).searchPlaces(parsed.data);
    return Response.json({ places: value, source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placeErrorResponse(error);
  }
}
