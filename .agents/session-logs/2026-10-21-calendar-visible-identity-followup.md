---
date: 2026-10-21
author: Codex
branch: fix/calendar-visible-trip-identity
pr: 499
area: apps/web, docs
contract-impact: none
---

# Keep duplicate calendar trip identities visible on phones

## What changed

- `TripsPage.tsx` shows a short destination prefix with the duplicate ordinal on compact bars.
- `workspace-trips.css` fits the marker within the narrowest tested trip segment.
- `calendar-trip-identity-search.e2e.mjs` checks exact visible labels and their painted bounds at 390px and 375px.
- Updated the failure inventory and English/Chinese workspace UI references.

## Why

The previous generic `#1`/`#2` markers fit but omitted the destination cue. The new `Syd·1`/`Syd·2` labels make the destination and distinguishing ordinal visible together.

## Validation

- `CHANNEL=chrome LABEL=visible-destination-ordinal-12px pnpm --filter @trip/web e2e calendar-trip-identity-search` — passed at 1440px, 390px, and 375px; exact visible labels, 12px text, glyph bounds and matching snapshot opens passed; no page errors.
- `pnpm --filter @trip/web test` — 57 files and 642 tests passed.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors`, and `pnpm verify:e2e-artifacts` — passed.
- Prettier check, `pnpm format:check-changed origin/main`, scoped added-comment check, and `git diff --check` — passed.
- Latest checked PR head `26f01ab752c4f39658757e7a30c656a1403ec232` was green; follow-up tree awaits push and CI.
- The run covers local saved-trip fixtures in mock mode; it does not verify live providers, authentication, or physical devices.

## Notes for the next person

- Current-head GitHub CI is recorded in the PR body after the follow-up push.
- Preserve screenshot evidence until parent upload/quotation.
