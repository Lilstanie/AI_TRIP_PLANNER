---
date: 2026-10-04
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, packages/shared, packages/orchestrator, packages/tools, docs
contract-impact: packages/shared
---

# Structured addresses and personal repository update

## What changed

- Where uses required city/country and optional suburb/state for both ends, with up to 12 destinations.
- Added explicit browser-location reverse lookup, OSM attribution and late-response protection.
- Shared optional address metadata preserves legacy text; web requests require it before planning.
- Nominatim requests share a process gate and bounded cache; existing Google maps remain intact.
- Updated English/Chinese UI, API and setup docs, and the [address decision](../notes/implemented/feature/2026-10-04-structured-address-entry.md).

## Why

The user requires departure details without paid autocomplete or a local address database and
authorizes free OSM lookup only on a location-button click. The user requests pushing all current
changes to the personal repository, including the earlier nine-person/three-pet limits.

## Validation

- Test-first structured editor, contract and planning-gate checks failed before implementation.
- `corepack pnpm --filter './packages/**' --filter @trip/web -r run test`: 971 tests passed across six packages; pre-existing jsdom canvas warnings remain.
- The same package selection's `typecheck` and `lint` passed; lint reports no warnings.
- `NEXT_DIST_DIR=.next-push-check corepack pnpm --filter @trip/web build` passed.
- Playwright structured-address script: 13 checks passed at 1440×1000 and 390×844, including permission denial, manual fallback, invalid API input and stale lookup protection.
- Playwright traveller-limits script: 19 checks passed, including six invalid API requests.
- Playwright localisation-currency script passed after replacing an old saved-status race with a wait for the actual edited storage record.
- Reviewed desktop/phone address screenshots under ignored `output/playwright/structured-address/`.
- Documentation, translation-pair, protected-file and whitespace checks passed before commit.

## Notes for the next person

- Public Nominatim is best-effort; multiple instances need shared rate limiting or another configured provider. Manual names are not database-verified.
- Provider verification used public Sydney coordinates, not the user's location; browser tests stub external lookups.
- Push target is personal origin only; no team merge or production deployment is requested.
