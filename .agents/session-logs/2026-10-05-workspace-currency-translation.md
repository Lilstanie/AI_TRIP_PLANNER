---
date: 2026-10-05
author: Codex
branch: feature/workspace-currency-and-translation
pr: none
area: apps/web, packages/shared, docs
contract-impact: packages/shared
---

# Implement workspace display currency, original budget entry and Chinese interface

## What changed

- #147: shared money conversion, saved display currency, trip amount formatting and dated estimate notice.
- #150: preserve budget source amount/currency in forms and snapshot v4; recover compatible v3 trip sources.
- #148: typed authored Chinese copy across workspace, settings, trip, timeline and map controls; keep user, model and provider content verbatim.
- Update both workspace UI documentation languages, translation-pair records and implemented Agent Notes.

## Why

Keep planning arithmetic in AUD while preserving the traveller's original budget and letting the interface display a chosen currency. A trip source currency takes precedence without changing account Settings.

## Validation

- Failure inventories and failing browser checks preceded implementation; source-budget and display-money seam tests were written first.
- `pnpm test`: 987 tests passed across six packages (five package results reused verified cache).
- `pnpm typecheck`: six packages passed; `pnpm lint`: passed.
- `pnpm build`: passed; all 20 routes generated.
- `pnpm test:scripts`: 26 tests passed.
- Display-currency E2E: 50 checks passed at desktop/phone widths, including numeric conversions and rate date.
- Source-budget E2E: 22 checks passed, including reload, source precedence and unchanged Settings.
- Workspace-Chinese E2E: 26 checks passed, including HTTP fallback errors; desktop and phone screenshots inspected.
- Repeatable scripts: `apps/web/tests/e2e/{display-currency,source-budget,workspace-chinese}.e2e.mjs`.
- Artifacts: `output/playwright/{display-currency,source-budget,workspace-chinese}/`.
- Standards and specification reviews completed; identified regressions corrected and checks rerun.
- Docs, protected-file and all 24 translation-pair checks passed; broader formatting scan found four unchanged files only.

## Notes for the next person

- #149 already has PR #163; left its assistant-reply-language work untouched.
- No push, PR creation, merge or remote issue closure in this session.
- Clerk authentication UI and native iOS were not validated; these changes target the shared web workspace. Provider-native prose and errors are intentionally not translated.
- Existing non-fatal warnings remain: duplicate root lockfiles, deprecated lint command and jsdom canvas support.
- Decisions: [display currency](../notes/implemented/feature/2026-10-04-workspace-display-currency.md), [budget source](../notes/implemented/feature/2026-10-04-source-budget-entry.md).
