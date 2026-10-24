---
date: 2026-10-24
author: Claude (Joey's project thread)
branch: fix/chinese-travel-tips
pr: pending
area: packages/agents, packages/orchestrator, apps/web
contract-impact: none
---

# Chinese Travel tips and fallback stop descriptions

## What changed

- `packages/agents/src/summary-copy.ts`: English and Chinese copy for the destination-guide fallback
  (attraction detail, customs, safety, entry and health plus the appended verification sentence,
  monthly weather, two-month scope, packing items), the itinerary fallback stop and the dining
  fallback restaurant. English text is byte-for-byte as before.
- `destination-guide/index.ts`, `weather-evidence.ts` (`weatherPacking` takes the reply language),
  `itinerary/index.ts` and `dining/index.ts` read that copy with `ctx.replyLanguage`.
- New `chinese-travel-tips` E2E and failure inventory (written first); `weather-packing` web E2E and
  orchestrator test expect Chinese packing in the zh run. `docs/architecture` en/zh.

## Why

Issue #545: with no model, the Chinese interface showed English Travel tips and stop descriptions,
because the deterministic fallback text was English-only. Model-written text already gets
`replyLanguageRule`.

## Validation

- `node scripts/redgreen.mjs chinese-travel-tips -- <five agents source files>`: before exit 1,
  8/11 ok; after exit 0, 11/11 ok.
- `pnpm --filter @trip/agents test` 147 passed; `pnpm --filter @trip/orchestrator test` 311 passed.

## Notes for the next person

- Mock place names ("Mock attraction near 悉尼") and provider weather summaries stay as supplied.
- Agent assumptions (provenance notes) are still English; they are not shown as Travel tips bodies.
