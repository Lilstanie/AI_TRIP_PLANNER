import { z } from "zod";
import { reverseAddress, NominatimError } from "@trip/tools";
const Coordinates = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  language: z.enum(["en", "zh-CN"]).default("en"),
});
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  const parsed = Coordinates.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid coordinates" }, { status: 400 });
  try {
    const { latitude, longitude, language } = parsed.data;
    return Response.json(
      { address: await reverseAddress(latitude, longitude, language) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Address unavailable; enter manually" },
      {
        status: error instanceof NominatimError && error.reason === "rate_limit" ? 429 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
