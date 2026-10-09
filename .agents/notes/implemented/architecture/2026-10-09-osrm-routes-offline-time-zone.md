# Agent Note: Walking and driving fallback from OSRM per profile, and time zones worked out offline

Status: implemented

## Problem

With Google Routes or the Time Zone API unavailable, the web workspace had no travel times and no
trip time zone, and the Chinese and English timeline could not tell the traveller where a time came
from. The free routing option is OSRM, but its public demo server (`router.project-osrm.org`) routes
cars only and ignores the profile it is asked for, so a walk sent there comes back as a drive.

## Decision

The cycling restriction below is partly superseded by the
[review-fix decision](2026-10-10-map-fallback-review-fixes.md), which adds the shared `cycle` mode
and an independent bike instance. The profile separation and offline time-zone decisions still apply.

- **Walking and driving only.** Walking asks the foot profile of `OSRM_FOOT_BASE_URL`, defaulting to
  the FOSSGIS foot instance (`https://routing.openstreetmap.de/routed-foot`). Driving asks
  `OSRM_BASE_URL`, defaulting to the demo server, which is correct for cars. Each profile has its own
  base URL, so a self-hosted or paid instance replaces either one independently.
- **No cycling.** A leg has three modes (walk, transit, drive). Adding a cycling mode changes the
  shared leg and travel-mode contract in `packages/shared`, which needs its own Agent Note. Cycling
  waits for that leg mode.
- **Transit is not OSRM's.** A transit leg is answered by Transitous (ticket #276), never guessed from a
  road route.
- **Provenance is per route.** A route carries `source` (`google` or `osrm`) and the timeline labels
  each verified time with its service. A saved leg keeps no service label, because `arriveBy` has no
  provider field, and adding one is also a shared contract change.
- **Time zones offline.** When Google's Time Zone call fails, the zone is worked out from the place's
  coordinates with `@photostructure/tz-lookup` (CC0 data, no network call). A place without coordinates
  is refused rather than given UTC.

## Alternatives considered

- **One OSRM base with a path template for every profile.** Rejected: the demo server answers the car
  profile for any request, so one base would silently route walks by car.
- **`geo-tz` for exact borders.** Rejected: its data is about 74 MB, too large for a serverless
  function. The original `tz-lookup` package has been unmaintained since 2020, so the maintained
  `@photostructure/tz-lookup` fork is used. Its border simplification can give a point a few kilometres
  from a border the neighbouring zone, which a trip stop rarely is.
- **Adding cycling now.** Rejected for the shared contract change it needs; the ticket allows walking
  and driving only.

## Consequences

- The public OSRM servers are for non-commercial fair use with no uptime guarantee. The web fallback
  caches answered legs for 10 minutes and does not throttle to one request a second, so a busy
  deployment needs a self-hosted OSRM through the base URL settings.
- Fallback routes in mock data mode come from fixtures in `apps/web/lib/map-provider/mock-osm.ts`, so
  E2E never reaches OSRM.

## Sources

- GitHub issues #270 (spec) and #273 (this ticket).
- [Web map provider decision](2026-10-09-web-map-provider-fallback.md).
