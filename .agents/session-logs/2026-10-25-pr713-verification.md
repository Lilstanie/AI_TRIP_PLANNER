---
date: 2026-10-25
author: Codex
branch: fix/TP-91-pr713-verification
pr: 713
area: apps/web, docs
contract-impact: none
---

# Verify progressive empty workspace before review

## What changed

- Updated TripFactChips workspace tests to type before editing progressively revealed controls.
- Repaired progressive-empty-workspace fixtures, chat navigation and phone facts assertions.
- Replaced removed language shortcuts in ui-language with Settings; retained locale persistence and phone coverage.
- Recorded failure modes and documented both browser journeys in the workspace UI language pair.

## Why

The original CI failures clicked intentionally hidden controls. Browser failures also came from
invalid streaming fixtures, asynchronous controls and obsolete navigation. Phone facts use a
sheet; the desktop chip wrapper has no bounding box there. Preserve those product contracts.

## Validation

- Existing TripFactChips tests: baseline 18 passed / 3 failed; corrected 21 passed.
- Web regression suite: 57 files, 642 tests passed; web typecheck and lint passed (existing warnings).
- `pnpm --filter @trip/web e2e progressive-empty-workspace ui-language`: both passed, 34 assertions, no page errors.
- Web production build, 70 script tests, docs/pairs/protected/selectors/artifacts, UI copy and scoped comment checks passed.
- Receipt: `output/e2e/runner/2026-10-25T06-40-00-602Z.json`; desktop 1440×1000, phone 390×844, English/Chinese.

## Notes for the next person

Local browser evidence uses response fixtures, not live planning providers. The Next development
indicator overlaps the phone Chat tab; the journey hides that development portal and still
checks runtime errors. Keep earlier failed artifacts alongside the passing evidence.
