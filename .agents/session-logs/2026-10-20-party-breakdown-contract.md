---
date: 2026-10-20
author: Codex
branch: fix/party-breakdown-review
pr: 447
area: packages/orchestrator, apps/web, docs, .agents/notes
contract-impact: packages/shared
---

# Preserve stated traveller totals when chat also extracts a party breakdown

## What changed

- Updated `packages/orchestrator/src/chat-offline.ts`, `brief.ts` and `chat.ts` to keep explicit
  `groupSize` authoritative and drop a mismatched `party`.
- Preserved the existing party E2E scripts and failure inventory; covered the reported 1-adult,
  1-child case in English and Chinese at desktop and phone widths, including save and reopen.
- Clarified the contract in the EN/ZH workspace docs and added an enforcement note linked to the
  existing traveller-party decision.
- Merged fresh main `040428cc7c77743021bf50da94de0d248200c14e` before final validation.

## Why

The implemented traveller-party decision says `groupSize` is authoritative, but extraction and
normalization could replace it with the category sum. The new note preserves that decision and
records where the existing contract is enforced.

## Validation

- `pnpm --filter @trip/web e2e party-breakdown`: 9/9, including explicit total 4 with a 1-adult,
  1-child mismatch retaining 4 and dropping `party`.
- `CHANNEL=chrome pnpm --filter @trip/web e2e party-breakdown-browser`: passed on Chrome 155;
  8 initial/reopened locale and viewport states showed Adults 1, Children 1, others 0.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed.
- Orchestrator/web typechecks and lint passed; `pnpm verify:docs`, `verify:pairs`,
  `verify:protected`, changed-file formatting and `git diff --check` passed.

## Notes for the next person

E2E uses the local mock planner and does not validate live model-provider extraction. Browser
screenshots and API runner JSON are retained in `output/` until the updated PR body quotes this
evidence; then run `pnpm clean:output`.
