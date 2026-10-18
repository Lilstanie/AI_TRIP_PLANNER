---
date: 2026-10-17
author: Codex
branch: fix/triage-oct17
pr: 438
area: apps/web, packages/agents, packages/orchestrator, packages/shared, docs
contract-impact: packages/shared
---

# Integrate the October 17 issue triage batch

## What changed

- Triaged 24 issues; 23 have implementation briefs, while #421 was closed as unconfirmed.
- Added `noAccommodation` across shared contracts, planning, preferences and saved drafts.
- Corrected past-date clarification, unchanged-plan replies and pending-question restoration.
- Improved mobile controls, accessible notices, thinking rows and trip readability.
- Added overnight-city and dated-transfer validation; synchronized API, architecture and workspace docs.

## Why

The owner selected no accommodation as distinct from booked accommodation, and approved the minimum
on-trip behavior. Parallel implementers use `gpt-6-luna` with high reasoning in isolated worktrees.
The integration branch and draft PR above are the continuation point.

## Validation

- Initial integration `pnpm build`, `pnpm typecheck`, `pnpm lint`: passed across six packages.
- Initial integration `pnpm test`: 1,222 tests passed; `pnpm test:scripts`: 35 passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`: passed.
- `pnpm verify:e2e-artifacts`, `pnpm verify:e2e-selectors`: passed for 71 scripts.
- Changed-file formatting and scoped added-comment checks: passed.
- Public date acceptance: 12 passed; settled mobile settings: 16 passed; chat targets: 7 passed.
- No-accommodation API: 8 passed; browser save/reload: 10 passed at desktop and phone widths.
- Pending-question refresh, accessibility, tip-scope and empty-transport acceptance passed.

## Notes for the next person

PR #438 starts as a draft. Final on-trip integration, transfer fallback timing, budget caution,
independent Standards/Spec review and final-head CI evidence belong in its updated Evidence section.
Earlier local runs precede those final changes and must not be presented as final-tree evidence.
Browser checks use mock providers with Clerk credentials absent; live availability and booking
fulfilment are not verified. Timed next-stop highlighting is deferred. Do not merge without explicit
owner authorization. See the [contract note](../notes/implemented/architecture/2026-10-17-no-accommodation.md).
