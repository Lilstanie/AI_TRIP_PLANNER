---
date: 2026-10-29
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-151 global New chat and isolated Conversation generation

## What changed

- Sidebar New chat calls the plain Conversation action, including keyboard and collapsed navigation.
- Empty phone Mine keeps New chat and New trip beside their own collections; Trips keeps New trip.
- New chat cannot reuse a running Conversation; untouched initial state creates no saved history row.
- Stable profile defaults allow storage to settle; existing dependent tests follow the new entry.
- Added the browser failure inventory, journey, paired workspace/runbook/CLI docs and superseding note.

## Validation

- Integration tip `95c80303` is merged by `d34e1e4b`; all prior WIP was audited and preserved.
- `CHANNEL=chrome pnpm --silent --filter @trip/web e2e run new-chat --json`: 43/43 PASS.
- Earlier new-chat red runs and the saved-local timeout remain under `output/e2e/local-test-cli/`.
- Save regression red: `2026-10-29T12-14-37-627Z-69688-eld94x`; green: `2026-10-29T12-15-59-367Z-72100-wv9mp2`.
- `pnpm --filter @trip/web e2e sidebar-no-chat-plus --prod`: PASS after exact Chinese label matching.
- Web typecheck/lint, verify:docs, verify:pairs, verify:protected, verify:e2e-selectors and verify:e2e-artifacts: PASS.
- Scoped check-added-comments and check-ui-copy: PASS.
- Existing web tests on Node 24.22.1: 57 files, 635 tests PASS; Node 26.12.1: four Intl date-spacing failures.
- Final committed-head browser runs and independent reviews are recorded in `/tmp/tp151-delivery/`.

## Notes for the next person

- Local controlled mock streams only; live providers, production login and physical-device behavior are unverified.
- Page reload/closure background execution is outside #791; no new unit tests were authored.
- No push, comment, Jira update, merge, branch deletion, Astra or protected configuration change.
- #795 action-panel tests and unrelated spec formatting remain outside this ticket's staged scope.
- Dependency symlinks, temporary tsconfigs and generated artifacts are excluded from the commit.
