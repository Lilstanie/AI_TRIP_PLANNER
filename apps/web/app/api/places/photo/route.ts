import { z } from "zod";
import { noticeBody } from "@/lib/i18n/notice";
import { PHOTO_NAME, PHOTO_WIDTHS, type PhotoWidth } from "@/lib/integrations/google";
import { COMMONS_NAME } from "@/lib/map-provider/commons";
import { mapProvider } from "@/lib/map-provider";
import { placeErrorResponse } from "@/lib/map-provider/place-error-response";

const PhotoRequest = z.object({
  name: z
    .string()
    .max(1000)
    .refine(
      (name) => PHOTO_NAME.test(name) || COMMONS_NAME.test(name) || name === "osm:fixture/Toji",
    ),
  width: z.coerce
    .number()
    .refine((value): value is PhotoWidth => (PHOTO_WIDTHS as readonly number[]).includes(value)),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = PhotoRequest.safeParse({ name: params.get("name"), width: params.get("width") });
  if (!parsed.success) return Response.json(noticeBody({ key: "Unknown photo." }), { status: 400 });
  if (parsed.data.name === "osm:fixture/Toji") {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#b8d4bc"/><path d="M120 200h160v-90l-80-65-80 65z" fill="#6b4e36"/><text x="200" y="225" text-anchor="middle">To-ji · fixture image</text></svg>',
      {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-store",
          "X-Map-Provider": "osm",
        },
      },
    );
  }
  try {
    const { value, source } = await mapProvider(request).placePhoto(
      parsed.data.name,
      parsed.data.width,
    );
    return new Response(null, {
      status: 302,
      headers: { Location: value, "Cache-Control": "no-store", "X-Map-Provider": source },
    });
  } catch (error) {
    return placeErrorResponse(error, { key: "This photo is no longer available." });
  }
}
