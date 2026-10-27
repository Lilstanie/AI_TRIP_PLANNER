---
date: 2026-10-27
author: Claude
branch: feature/TP-110-team-capsule
pr: none
area: apps/web, docs
contract-impact: none
---

# Compact Agent Team capsule (TP-110, #734)

## What changed

- `TeamAvatars` shows at most three avatars, working specialists first; the phone button uses it too.
- `thinking.css`, `workspace-layout.css`, `phone-facts.css`: stacked avatars; the stack collapses to one icon only at 920 px or less.
- `team-panel-desktop`, `team-panel-phone`, `team-thinking`, `trajectory-demo` and `trip-workspace-layout` expect the capsule; failure inventories list the new scenarios.
- `docs/workspace-ui` (and `.zh`), `docs/demo-runbook` (and `.zh`), `docs/e2e-known-failures` (and `.zh`).

## Why

Three of the scripts already failed on `main` because the progressive-empty workspace changed the top bar; they now test the current UI (see known failures).

## Validation

`DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod` passed for `team-panel-desktop` (170 checks), `team-panel-phone` (98), `team-thinking` (40 before the final run), `trajectory-demo` (48) and `summary-jump` (68).
Web typecheck, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy` and `format:check-changed` passed; web lint reported only existing warnings.

## Notes for the next person

`trip-workspace-layout` needs a Chrome channel that is not installed here and was not run.
