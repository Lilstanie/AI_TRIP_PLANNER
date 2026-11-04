# Destination guide with OpenStreetMap unreachable

Written before the fix. Ways the guide can go wrong when every OpenStreetMap endpoint refuses the
connection in live mode:

1. A rejected place lookup escapes the guide, so the workflow reports `agent_failed` for
   `destination-guide` and the whole plan fails ("Unable to update this trip").
2. The guide catches the failure but invents an attraction that no provider returned.
3. The guide plans, but its source still reads `fallback`, `estimated` or `live`, hiding that the place
   evidence is missing.
4. The guide plans, but its assumptions do not say which place lookups failed.
5. A catch swallows an abort, so a cancelled plan keeps running after the place lookup rejects.
6. The itinerary section, which already degrades, stops planning next to the guide.
7. A lookup leaves the machine, so the run depends on the real network.

Repeat with `pnpm --filter @trip/orchestrator exec vitest run tests/guide-osm-unreachable.e2e.test.ts`.
The run writes `output/e2e/guide-osm-unreachable/plan.json`.
