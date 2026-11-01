---
date: 2026-11-01
author: Claude Code for Joey
branch: refactor/TP-250-map-folder
pr: none
area: apps/web, docs
contract-impact: none
---

# Move the Web map providers under lib/map (TP-250)

## What changed

- `apps/web/lib/map-provider/*` moved to `apps/web/lib/map/providers/`; its tests moved from `tests/lib/map-provider/` to `tests/lib/map/providers/`. Imports of `@/lib/map-provider` now read `@/lib/map/providers`.
- Docs, the add-provider and review skills, the Web map provider note, the READMEs and the Stage 2 evidence table point at the new folder.

## Why

Item 4 of Joey's 2026-11-01 structure review: `lib/map` and `lib/map-provider` sat side by side. `lib/chat/run-header.ts` stays: it keeps the header name out of `runs.ts`, which imports server-only `@trip/services`, so the browser transport can use it.

## Validation

- `pnpm --filter @trip/web typecheck` passed; `pnpm --filter @trip/web test`: 60 files, 662 tests passed; lint shows only existing hook warnings.

## Notes for the next person

The rendered Archify diagrams link to old commits and keep the old path on purpose.
