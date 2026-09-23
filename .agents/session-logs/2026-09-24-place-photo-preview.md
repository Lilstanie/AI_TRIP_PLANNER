---
date: 2026-09-24
author: Claude Code (Opus 5.5)
branch: feature/place-photos
pr: none
area: apps/web, docs
contract-impact: api
---

# Preview the selected map place with its Google photo

## What changed

- `apps/web/lib/integrations/google.ts`: lookups request `photos`, and `placePhotoUri` exchanges a
  validated photo name for a `googleusercontent.com` URL with `skipHttpRedirect=true`.
- New `GET /api/places/photo`, which redirects to the image with `no-store`, so the server key
  never reaches the browser.
- New `components/map/PlacePreview.tsx`, shown above the place list in `TripMap` for the selected
  place. It has the photo, address, author attribution, an Open in Google Maps link and a pin
  fallback. `WorkspaceView` enables photos only in live mode with a Maps key.
- Docs: `api.md`, `workspace-ui.md`, `development.md`, the design contract and the place-photos
  note.

## Why

Google forbids caching photo names, so they live only in the existing in-memory lookups. The first
surface loads one image per selection, which keeps spending bounded without a quota counter.
`<img>` replaces `next/image` because its optimizer would fetch and cache Google's image on our
server.

## Validation

- `pnpm --filter @trip/web test`: 32 files, 305 tests passed, including the new photo tests.
- `pnpm --filter @trip/web typecheck` passed once a stale `.next/types` entry for the deleted debug
  page was removed; `pnpm --filter @trip/web lint` reported no warnings.
- `curl` with an invalid key confirmed Google's error shape (400 `API_KEY_INVALID`).
- The browser checks used a temporary `/debug/break-place-preview` page with live Google data for
  The Rocks and Bondi Beach, deleted afterwards:
  - The route returned 302 and a 400×300 image loaded, with the author credit shown.
  - Switching the selection switched the photo.
  - With photos off, the pin fallback showed and no image or credit.
  - Checked at 1440 × 1000 dark and 390 × 844 light, with no sideways scroll.

## Notes for the next person

- Photo thumbnails in lists or on markers need a monthly quota counter first.
- The design contract (from PR #61) must merge before this PR is retargeted to `main`.
