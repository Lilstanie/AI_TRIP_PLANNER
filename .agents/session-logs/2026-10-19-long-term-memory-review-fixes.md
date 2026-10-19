---
date: 2026-10-19
author: Codex
branch: feature/long-term-memory-integration
pr: none
area: apps/web, packages/agents, packages/orchestrator, packages/tools, packages/shared, docs
contract-impact: packages/shared
---

# Complete account-memory integration and review fixes

## What changed

- Connected six memory categories to production specialists and enforced trip/profile precedence.
- Made saved account opt-out authoritative; localized Settings rows and chat notices.
- Merged accommodation fields in one category, preserving whole-value undo and legacy reads.
- Added optional `StayQuery.stayType` through mock, SerpApi and Google queries and cache keys.
- Removed repeated preference parsing; synchronized API, architecture, UI and development docs.

## Validation

- `pnpm --filter @trip/web build`: passed, 24 routes/pages.
- `pnpm typecheck`: all six packages passed after final formatting.
- `pnpm turbo run lint`: all six packages passed; earlier empty-catch failure fixed.
- Existing package tests: web 57 files/635 tests; agents 12/131; orchestrator 23/275; tools 11/141; shared 4/58 passed.
- `CHANNEL=chrome PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/e2e/run.mjs long-term-memory`: passed, final report `apps/web/output/e2e/runner/2026-10-19T02-54-37-807Z.json`.
- `node apps/web/tests/e2e/accommodation-memory.e2e.mjs` with the same browser executable: passed; merged fields, rating 10 and public-token undo verified.
- Memory Settings fixture: four desktop/phone English/Chinese cases passed, with screenshots and traces.
- Settings E2E: 36 checks passed; signed-out memory Settings: 16 checks passed.
- Docs, protected files, 27 translation pairs, selectors and artifacts (80 scripts) passed.
- Scoped added-comment check against `2e0f506b`: no violations; `git diff --check` passed.
- Earlier opt-out and stay-type assertions failed before their fixes; passing reruns retain the failure history.

## Notes for the next person

- Runtime: Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.82; models disabled, deterministic provider data, PGlite and fixture account identity.
- Final workspace E2E exercises production route, UI and specialists. It supersedes the earlier integration log's missing specialist-output evidence.
- Accommodation regression uses a browser form and production routes/storage/reader, not the production workspace UI.
- Live Clerk, deployed Neon migration and model recognition remain unverified; stay type is a search preference, not independently verified property metadata.
- Existing web tests emit jsdom Canvas warnings. Initial direct lint output scanned generated Next files; the package-script equivalent above passed.
- No merge authorized. #439/#440 remain needs-triage; #441 awaits Clerk E2E credentials.
