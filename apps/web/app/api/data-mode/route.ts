import { mapProviderSetting } from "@/lib/map-provider";
import { configuredDataMode } from "@trip/tools";

export async function GET() {
  return Response.json(
    {
      configured: configuredDataMode(),
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
