---
date: 2026-10-31
author: Claude Code
branch: fix/TP-213-neighbourhood-fill
pr: none
area: packages/agents
contract-impact: none
---

# Neighbourhoods fill in only when a city runs out of sights

## What changed

- `packages/agents/src/itinerary/index.ts`: each city's candidates are its sights (and museums when
  asked for); neighbourhoods join them only when there are fewer sights than days times the pace's
  daily maximum (relaxed 2, balanced 3, packed 6).
- `docs/architecture(.zh).md`.

## Why

The live packed Tokyo run on PR #859 listed 銀座, 渋谷, 丸の内, 秋葉原, 浅草, 谷中, 神楽坂 and 吉原 as
stops: every wiki-tagged neighbourhood was offered as a sight, although Tokyo had hundreds of sights.

## Validation

- `packages/agents` tsc and vitest 207 passed; no new tests. Live check on the Mac follows.

## Limitations

- The threshold counts all trip days for each city, so a short stay in one city of a multi-city
  trip can still get neighbourhoods offered.
