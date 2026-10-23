---
date: 2026-10-23
author: Claude Code
branch: fix/chinese-example-trip-destination
pr: none
area: packages/orchestrator, apps/web tests, docs
contract-impact: none
---

# Chinese example chips plan without a model

## What changed

- `packages/orchestrator/src/chat-offline.ts`: the offline extractor reads a Chinese destination in
  "……的X之旅", stops a 去/前往 destination before "的旅行", ends a Chinese origin at 前往, and reads
  "X和Y" as "X & Y" when both names have at least two characters.
- `apps/web/tests/e2e/chinese-example-chip-plan.e2e.mjs` and its failure inventory (written first).
- `docs/architecture.md` and its Chinese pair.

## Why

Found while writing the #622 E2E. In mock mode with the Chinese interface, "悉尼 · 4 天" and
"悉尼和卧龙岗 · 5 天" replied "include the destination" and planned nothing; the two Melbourne chips
planned for "悉尼的" from "墨尔本前往悉尼的旅行".

## Validation

- `node scripts/redgreen.mjs chinese-example-chip-plan -- packages/orchestrator/src/chat-offline.ts`:
  before, exit 1 with 12/18 ok; after, exit 0 with 22/22 ok (all four Chinese chips and the first
  English chip plan the right destination, origin and day count).
- Orchestrator unit tests 296 passed.

## Known limitation

The Chinese replies still carry an English "Known estimate" sentence; not touched here.
