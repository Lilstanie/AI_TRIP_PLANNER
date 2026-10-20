---
date: 2026-10-20
author: Codex
branch: fix/sidebar-search-plurals
pr: none
area: apps/web, docs
contract-impact: none
---

# Singular search result announcements (#463)

## What changed

- `ChatsPanel.tsx` selects singular English wording for exactly one trip or chat.
- `workspace-messages.ts` keeps natural Chinese counting for both English keys.
- Added a failure inventory and repeatable catalog-fixture browser journey before implementation.
- Updated both workspace UI documents; no lasting decision or shared contract changed.

## Validation

- Base: `2e0f506b5d2eff7eeac4bd715519fabcce3160aa`; checks include the outgoing working tree.
- `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true LABEL=before-corrected-fixture pnpm --filter @trip/web e2e sidebar-search-counts`: 46/48 pass, exit 1; singular EN fails at both widths.
- Same command with `LABEL=after`: 48/48 pass, exit 0.
- Browser viewports: 1440×1000 and 390×844, EN/ZH; 0/1/2 matches, idle, polite statuses, clear focus, no page overflow or page errors.
- JSON and screenshots: `output/playwright/sidebar-search-counts/{before-corrected-fixture,after}/`.
- Runner reports: `output/e2e/runner/2026-10-20T08-36-29-961Z.json` (red), `2026-10-20T08-37-20-074Z.json` (green).
- Initial fixture attempt was invalid (mismatched saved trip identifiers, incomplete settings); fixed the fixture before the production edit. Its runner report is `2026-10-20T08-34-50-325Z.json`.
- `pnpm --filter @trip/web test`: 57 files, 632 tests pass; existing jsdom canvas warnings remain.
- `pnpm --filter @trip/web typecheck` and `lint`: pass.
- `pnpm verify:docs`, `verify:pairs` (27 pairs), `verify:protected`, `verify:e2e-artifacts`, `verify:e2e-selectors`: pass.
- Scoped added-comment check: three source/test files, no violations; `git diff --check`: pass.

## Notes for the next person

- Catalog fixtures only: no real provider, authentication, physical-device or screen-reader audio acceptance.
- Screenshots confirm layout; hidden result text is verified through DOM status assertions.
- No merge authorized. Evidence will be quoted in the PR before local output cleanup.
