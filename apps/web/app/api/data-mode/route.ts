import { configuredDataMode } from "@trip/tools";

/**
 * What the workspace toggle needs to describe itself honestly: the mode this
 * deployment defaults to, and whether live mode actually has provider keys —
 * without ever returning the keys themselves.
 */
export async function GET() {
  return Response.json(
    {
      configured: configuredDataMode(),
      providers: {
        hotelsAndFlights: Boolean(process.env.SERPAPI_KEY),
        maps: Boolean(process.env.MAPS_API_KEY),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
