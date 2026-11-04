---
date: 2026-11-04
author: Claude Code
branch: fix/flight-query-cn-lead-in
pr: none
area: packages/orchestrator, packages/tools
contract-impact: none
---

# Chinese flight questions find a known city after any lead-in

## What changed

- `packages/tools/src/airports.ts`: `knownCitySuffix()` returns the longest trailing part of a text
  that names a city in the airport table; `packages/tools/src/index.ts` exports it and
  `tests/public-boundary.test.ts` lists it.
- `packages/orchestrator/src/chat/flight-query.ts`: `city()` keeps that suffix for Han-script
  values, so "你好洛杉矶到东京" reads 洛杉矶; an unknown origin stays as it was.
- Failure inventory `packages/orchestrator/tests/flight-query-cn-lead-in.failures.md`, written
  before the fix; new cases in `flight-query.test.ts`.
- [City table note](../notes/implemented/architecture/2026-11-04-flight-query-city-table.md),
  the provider-selection note's export facts, `docs/architecture.md` and its Chinese pair, and
  `packages/tools/README.md`.

## Why

Han text has no word boundary, so only a list of names can tell a greeting from a city. The
airport table is the list the flight search already resolves against; `Intl.Segmenter` splits
悉尼 and 布宜诺斯艾利斯, and more `LEADING_CN` words cover only the words listed.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/flight-query.test.ts` before the fix:
  2 failed, 16 passed (`你好洛杉矶` kept as the origin; `你好东京到东京` parsed).
- `pnpm --filter @trip/orchestrator test`: 40 files, 450 tests passed.
- `pnpm --filter @trip/tools test`: 12 files, 173 tests passed.
- `pnpm turbo run typecheck --filter=...@trip/tools`: 4 tasks successful; both packages lint clean.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`,
  `node scripts/check-file-length.mjs`, `node scripts/verify-branch-name.mjs`: clean.

## Notes for the next person

A Chinese city that is not in `airports.ts` still keeps an unlisted lead-in; adding it to the
table fixes both the parser and the search.
