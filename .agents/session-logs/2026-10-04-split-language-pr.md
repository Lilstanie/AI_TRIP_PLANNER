---
date: 2026-10-04
author: Codex
branch: feature/ui-language-gutter
pr: none
area: apps/web, docs
contract-impact: none
---

# First standalone PR: interface language and layout gutter

## What changed

- Started from current team main 7033a57, preserving the complete personal branch unchanged.
- Extracted only English/Chinese interface switching, localized controls/date/AUD formatting and the sidebar gutter.
- Added defaulted settings.language; old settings, legacy address entry, existing traveller bounds and planning paths remain unchanged.
- Kept display-currency selection, address contracts, reverse lookup and party caps out of the branch.
- Updated paired workspace docs and [language decision](../notes/implemented/feature/2026-10-04-interface-language-only.md).

## Why

Team review closed #144 and requested independent feature PRs, language first.
The account has no team push permission, so the PR source must remain the personal fork.

## Validation

- New E2E first failed on the original team UI: language switch missing. An initial attempt also found the dev server stopped; started it and repeated the test before extraction.
- `corepack pnpm --filter './packages/**' --filter @trip/web -r run test`: 980 tests passed across six packages.
- `corepack pnpm --filter @trip/web test`: final 450 web tests passed after removing currency-only seams; existing jsdom canvas warnings remain.
- `corepack pnpm test` failed before tests because Turbo selected bundled pnpm, attempted a registry install and aborted without a TTY; direct pinned package runs above passed.
- Web typecheck and lint passed; removed an unused LocaleProvider dependency after the initial lint warning.
- `NEXT_DIST_DIR=.next-language-check corepack pnpm --filter @trip/web build` passed; its generated tsconfig include is not part of the change.
- `ui-language.e2e.mjs`: 12 checks passed at 1440×1000 and 390×844, with reviewed screenshots/report in ignored output/playwright/ui-language.
- English/Chinese pair checks, docs, protected-file checks against upstream/main and whitespace checks passed.

## Notes for the next person

- First merge language, then submit display currency from updated main; address UI and explicit reverse lookup follow separately. Party caps require team agreement.
- No shared/orchestrator/tools/API changes, no credentials or generated screenshots committed, no automatic merge.
- Fork CI still needs maintainer approval; Vercel preview may need team authorization.
