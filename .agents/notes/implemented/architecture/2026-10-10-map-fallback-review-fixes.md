# Agent Note: Complete cycling and make stale background work terminal

Status: implemented

## Problem

PR #278's fallback review found that a background job queued behind another tab's edit repeatedly
retried a stale plan. Localized search names were replaced by unlocalized details, and #273's
cycling requirement had no leg mode. The OSM photo behavior also disagreed with its design contract.

## Decision

A locally cancelled or replaced background job remains retryable for a new plan. A cross-tab stale
plan is a terminal failure for background work: the revision owner stops offering its jobs and the
timeline shows a keyed stale-plan Notice. Loading a fresh plan permits work again.

OSM details receive `language`, defaulting to English. Provider caches include the language; browser
lookups track both data mode and language and refetch a saved ID after either changes. Manual
replacement searches also carry locale and data mode; preference suggestions key their cache by locale.
Typing requests carry `autocomplete: true`. The free provider answers them through Photon only;
unsupported Chinese suggestions or a Photon failure return no suggestions, never Nominatim. Explicit
searches still use the language-aware Nominatim path. This enforces its no-autocomplete policy.

Extend the shared `TravelModes` with `cycle`, preserving all existing modes. The leg chooser maps it
to Google's `BICYCLE` or the independent OSRM bike instance configured by `OSRM_BIKE_BASE_URL`.
The default is `https://routing.openstreetmap.de/routed-bike`; neither foot nor car profiles answer
cycling. Existing plans remain valid and Undo keeps the chosen mode. HTTP timeout/contact handling
and successful-answer caching are shared with other free providers; concurrent identical legs coalesce.

This partly supersedes [the completed fallback decision](2026-10-10-complete-map-fallback.md)
and the cycling restriction in [the original OSRM decision](2026-10-09-osrm-routes-offline-time-zone.md).
It also partly supersedes [the photo decision](../feature/2026-09-24-place-photos.md): OSM-linked
Commons photos require author, license and license link; without one the OSM card omits the photo
slot. Google cards retain their category-icon fallback. Neither path persists photo data.

## Alternatives considered

- Retry a cross-tab stale job as if locally cancelled: the plan never changes, so each render retries it.
- Preserve only the search name: saved-ID lookups and later language changes would still be wrong.
- Use the car OSRM endpoint for cycling: its profile does not establish a bicycle route.
- Rewrite the original photo decision: it still governs Google; retain it with an explicit OSM exception.

## Consequences

The shared contract gains one backward-compatible enum value, so consumers must recognize `cycle`.
Stale tabs need a fresh plan and do not silently overwrite another tab. Protection remains browser-local.
Public free providers have no SLA. Browser fixtures verify wiring and profile selection; they do not
establish physical-device behavior or route coverage in every destination.

## Sources

- Issues #270, #273 and #242; PR #278.
- [Google route modes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/RouteTravelMode).
- [FOSSGIS routing](https://routing.openstreetmap.de/).
