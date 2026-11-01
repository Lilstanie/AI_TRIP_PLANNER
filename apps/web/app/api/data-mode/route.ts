import { mapProviderSetting } from "@/lib/map-provider";
import { configuredDataMode } from "@trip/tools";
import { liveDataBlock } from "@/lib/auth/live-data";

export async function GET() {
  const block = await liveDataBlock();
  return Response.json(
    {
      configured: configuredDataMode(),
      liveAvailable: block === undefined,
      liveBlock: block ?? null,
      providers: {
        hotelsAndFlights: Boolean(process.env.SERPAPI_KEY),
        maps: Boolean(process.env.MAPS_API_KEY) || mapProviderSetting() !== "google",
        webMapsProvider: mapProviderSetting(),
        mockGoogleUnavailable: process.env.MOCK_GOOGLE_MAPS === "unavailable",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
