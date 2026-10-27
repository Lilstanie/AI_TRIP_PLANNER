---
date: 2026-10-27
author: Claude Code
branch: feature/TP-118-review-fixes
pr: none
area: apps/web, docs
contract-impact: none
---

# Review fixes for the trip UI glass integration branch (PR #740)

## What changed

- `lib/trip/conflicts.ts`, `lib/trip/open-items.ts`, `OpenItemsBadge.tsx`: edit issues that name no stop show as plain-text Itinerary issue open items (new Agent Note supersedes one sentence of the badge note).
- `TripMap.tsx`, `lib/map/map-view.ts`: home-base centring no longer counts as a traveller move and skips a map the traveller already moved.
- `ChatPanel.tsx`, `PhoneTeamButton.tsx`, `WorkspaceView.tsx`: the Trajectory tab is keyed by the active chat so a selected turn does not carry into another chat.
- E2E: `trip-budget-issues` extended, new `map-home-pan` and `trajectory-conversation-switch`, each with a failure inventory.
- Docs: `docs/workspace-ui` (+ zh), `GLOSSARY.md`.

## Why

Each fix was reproduced by an E2E that failed first. Rejected after reading code: result `failed` for sections without a reply (the Trajectory note defines it), the Chats search focus (optional-chained, no shortcut exists), `ownJumped` and the jump effect (a pending parent jump always wins and is cleared in the same effect).

## Validation

- `pnpm --filter @trip/web e2e trip-budget-issues`, `trajectory-conversation-switch`: failed before, ok after.
- `map-home-pan` via `legacy-runner.mjs` with the synthetic Maps key: failed before, ok after.
- web build, typecheck, test (643 passed); lint reports only existing warnings.

## Notes for the next person

`map-home-pan` needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=map-animation-fixture`; the `pnpm e2e` wrapper blanks it.
