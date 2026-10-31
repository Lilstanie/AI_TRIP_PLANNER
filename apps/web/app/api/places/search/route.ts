import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import { mapProviderFor } from "@/lib/map-provider";
import { requestDataMode } from "@/lib/auth/live-data";
import { placeErrorResponse } from "@/lib/map-provider/place-error-response";
import { KIND_QUERY_WORD } from "@/lib/trip/add-filters";

const MAX_QUERY = 200;

const SearchRequest = z.object({
  text: z.string().trim().min(1).max(MAX_QUERY),
  autocomplete: z.boolean().optional(),
  language: z.enum(["en", "zh"]).optional(),
  destination: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(["stays", "restaurants", "experiences", "events"]).optional(),
});

export async function POST(request: Request) {
  const parsed = SearchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(noticeBody({ key: "enterAPlaceNameTo" }), { status: 400 });
  const { kind, ...query } = parsed.data;
  const withKind = kind ? `${query.text} ${KIND_QUERY_WORD[kind]}` : query.text;
  const text = withKind.length <= MAX_QUERY ? withKind : query.text;
  try {
    const { value, source } = await mapProviderFor(await requestDataMode(request)).searchPlaces({
      ...query,
      text,
    });
    return Response.json({ places: value, source }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placeErrorResponse(error);
  }
}
