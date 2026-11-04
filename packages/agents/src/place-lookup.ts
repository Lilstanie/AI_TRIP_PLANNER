import type { AgentContext, Place, PlaceQuery } from "@trip/shared";

/**
 * Runs one MapsPort place lookup for a specialist. A provider failure resolves to no places, is
 * logged under `agent` and appends one line to `issues` for the proposal's assumptions. An aborted
 * request rejects with the signal's reason instead of degrading.
 */
export async function lookupPlaces(
  ctx: AgentContext,
  agent: string,
  query: PlaceQuery,
  issues: string[],
): Promise<Place[]> {
  try {
    return await ctx.tools.maps.places(query);
  } catch (error) {
    ctx.signal?.throwIfAborted();
    const category = query.category ?? "places";
    console.warn(
      `[${agent}] Place provider unavailable for ${category} in ${query.near}: ${error instanceof Error ? error.message : String(error)}`,
    );
    issues.push(
      `Place provider unavailable for ${category} in ${query.near}; using only remaining evidence.`,
    );
    return [];
  }
}
