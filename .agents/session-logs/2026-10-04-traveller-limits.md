---
date: 2026-10-04
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, packages/shared, packages/orchestrator, docs
contract-impact: packages/shared
---

# Limit trips to nine people and three pets

## What changed

- Shared full/partial briefs and orchestrator patches enforce a 1–9 person total and 0–3 pets.
- Who steppers stop additions at the limits, allow removals, and show bilingual guidance/errors.
- Settings travel defaults follow the same people cap; invalid party issues return to Who.
- Updated both workspace UI documentation languages and the traveller-party decision record.
- Added the [limit decision](../notes/implemented/architecture/2026-10-04-party-limits.md) and browser regression script.

## Validation

- Test-first contract, editor and error-routing checks failed on the old implementation, then passed.
- `corepack pnpm test` failed before tests: Turbo selected bundled pnpm 11, which attempted an install and aborted without a TTY.
- `corepack pnpm --filter './packages/**' --filter @trip/web -r run test` passed all six packages (967 tests); existing jsdom canvas warnings remain.
- `corepack pnpm --filter './packages/**' --filter @trip/web -r run typecheck` passed.
- `corepack pnpm --filter @trip/web lint` passed.
- `PLAYWRIGHT=... CHANNEL=chrome node apps/web/tests/e2e/traveller-limits.e2e.mjs` passed at 1440×1000 and 390×844; 19 checks cover mixed people, independent pets, removing/replacing, saving, Chinese helper, phone layout, page errors and six invalid API requests (400).
- The E2E selector initially used the wrong Chinese accessible name/colon; corrected against component source before the successful run.
- Reviewed screenshots: `output/playwright/traveller-limits/desktop-en.png` and `phone-zh.png`; report stored alongside them.
- `node scripts/verify-docs.mjs`, pairing and protected-file checks, and `git diff --check` passed.

## Notes for the next person

- No push or deployment. Existing port-3000 dev server was reused.
- Oversized historical data is not silently clamped; it fails the new validation. Limits do not guarantee availability or pet-policy suitability.
- No live providers or model-driven planning were invoked in this verification.
