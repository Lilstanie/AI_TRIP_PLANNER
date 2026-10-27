---
date: 2026-10-28
author: Codex
branch: feature/trip-export-534
pr: none
area: apps/web, docs
contract-impact: none
---

# Export scheduled trips

## What changed

- Added copy and calendar download actions to the trip panel.
- Added text and iCalendar serialization, translations, and browser evidence.
- Documented calendar time semantics in both development guides.

## Why

Calendar times remain floating local times because the trip data has no reliable timezone.

## Validation

- `pnpm --filter @trip/web e2e trip-export`: 12 assertions passed across desktop, phone, light and dark; the pre-implementation run failed as expected.
- Web Vitest under Node 25.9.0: 57 files and 645 tests passed. Node 26 had four existing date-format failures.
- Web typecheck and lint passed.
- Documentation, translation-pair, protected-file, E2E selector and artifact checks passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: passed.

## Notes for the next person

Calendar times use the importing calendar's local timezone. Production browser and Node 22 CI evidence remain outstanding.
