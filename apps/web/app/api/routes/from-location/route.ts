import { z, ZodError } from "zod";
import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { googleRouteFromCoordinates } from "@/lib/integrations/google";

const Input = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeId: z.string().min(1),
  mode: z.enum(["WALK", "TRANSIT"]),
});

export async function POST(request: Request) {
  try {
    const input = Input.parse(await request.json());
    return Response.json(
      await googleRouteFromCoordinates(
        { latitude: input.latitude, longitude: input.longitude },
        input.placeId,
        input.mode,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // An authored refusal is keyed; anything else is passed on exactly as it was raised.
    const notice = errorNotice(error instanceof ZodError ? undefined : error, {
      key: "Route lookup failed.",
    });
    return Response.json(noticeBody(notice), { status: 400 });
  }
}
