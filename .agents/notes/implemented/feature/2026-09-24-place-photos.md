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

The rule lives in the design contract. This note changes the contract only; no provider fetches
photos yet.

## Alternatives considered

**Keep the ban.** Rejected by the repository owner. It removes the visual comparison that makes
Mindtrip's place cards useful, and the photos are data the project can already get.

**Allow photography generally, including decorative heroes and backgrounds.** Rejected. Decorative
images compete with the map and the plan, which the contract keeps as the working surface, and they
make text contrast depend on the image.

**Use stock or generated images when the provider has none.** Rejected. An image that is not the
place misleads the traveller. This is the same honesty rule that governs source provenance.

## Consequences

- Showing photos needs a provider change: fresh photo names in the place data, the photo request,
  quota limits and a mock-mode fallback. It follows the
  [add-provider skill](../../../skills/add-provider/SKILL.md). If photo data crosses
  `packages/shared`, that change needs its own contract note.
- Photo requests are billed separately by Google Places, so thumbnails in long lists must be fetched
  within the quota rules.
- Reviews treat a decorative photo, text placed on a photo, missing attribution, or a stored photo
  name or image as contract violations.
