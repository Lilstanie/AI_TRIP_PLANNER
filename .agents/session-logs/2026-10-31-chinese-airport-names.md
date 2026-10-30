---
date: 2026-10-31
author: Claude Code
branch: fix/TP-176-chinese-airport-names
pr: none
area: packages/tools
contract-impact: none
---

# Resolve Chinese city names to airports for live flights

## What changed

- `packages/tools/src/airports.ts`: every city in the table also resolves from its simplified and
  traditional Chinese names (`CHINESE_NAMES`); a trailing 市 is ignored.
- `packages/tools/tests/airports.test.ts`: failure modes written first (simplified, traditional,
  padded, 市 suffix, a city with no Chinese name), then the table.

## Why

A real all-live run on main asked for 悉尼 to 东京 and got no flights; the same trip in English
priced normally. SerpApi rejects city names, so an unknown name means no flight search at all.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/airports.test.ts` before the table: 3 failed,
  5 passed; after: 8/8. `pnpm --filter @trip/tools test`: 144/144.
- `pnpm turbo run typecheck --filter=...@trip/tools`: 4/4 successful.

## Notes for the next person

The reply still does not say why a flight search found nothing when a city is unmapped.
