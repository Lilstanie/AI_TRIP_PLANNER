# Agent Note: Provider place photos

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The [design contract](../../../../docs/design/ui-guidelines.md) banned photography outright, so that
the workspace would not drift into decorative imagery. Choosing a place is partly visual, though. A
traveller comparing a garden, a lookout and a hotel decides faster when they can see them.
[Mindtrip](https://mindtrip.ai), now the main interaction reference, relies on place photos in
previews, cards, detail views, itinerary rows and map markers. The Google Places provider this
project already uses can supply photos for the places it returns.

## Decision

Photos are allowed as **content about a specific place**, sourced only from that place's provider.
They may appear in place cards, previews and detail, in itinerary and place-list thumbnails, and on
map markers. Decorative photography stays banned: hero banners, backgrounds, and stock or generated
images.

Each photo slot has:

- the provider's required attribution;
- nothing persisted except the place ID: photo names come fresh from a Places response, because Google
  forbids caching them and they expire, and image bytes are never stored;
- a fixed aspect ratio, lazy loading, and a category-icon fallback on `--surface-2`;
- the container's radius and a 1 px hairline;
- no text laid directly on the image;
- alt text taken from the place name.

The rule lives in the design contract. The first surface is the map's place preview:

- `apps/web/lib/integrations/google.ts` asks Places for `photos` on the lookups the map already
  makes. The names stay in browser memory with the rest of the lookup.
- `GET /api/places/photo` exchanges one name for Google's image URL and redirects to it, so the
  server key never reaches the browser.
- The preview loads one image for the selected place, and only in live data mode with a Maps key.

## Alternatives considered

**Keep the ban.** Rejected by the repository owner. It removes the visual comparison that makes
Mindtrip's place cards useful, and the photos are data the project can already get.

**Allow photography generally, including decorative heroes and backgrounds.** Rejected. Decorative
images compete with the map and the plan, which the contract keeps as the working surface, and they
make text contrast depend on the image.

**Use stock or generated images when the provider has none.** Rejected. An image that is not the
place misleads the traveller. This is the same honesty rule that governs source provenance.

## Consequences

- Photo data stays in the web app's own `GooglePlace` type; `packages/shared` does not change. A
  change that moves photos into the shared contracts needs its own contract note.
- Adding `photos` to the field mask costs nothing extra, because `rating` already puts the lookups
  in a higher billing tier. Each image is a separate billed request.
- There is no monthly photo quota counter. Spending is bounded by one image per selection in live
  mode. Thumbnails in lists or on markers would multiply requests, so they need a counter in the
  shared store first, following the [add-provider skill](../../../skills/add-provider/SKILL.md).
- Reviews treat a decorative photo, text placed on a photo, missing attribution, or a stored photo
  name or image as contract violations.
