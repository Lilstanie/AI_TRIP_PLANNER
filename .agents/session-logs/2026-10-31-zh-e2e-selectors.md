---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-206-zh-e2e-selectors
pr: pending
area: apps/web/tests/e2e
contract-impact: none
---

# Point raw E2E Chinese selectors at the rewritten copy (TP-206 follow-up)

## What changed

- `trip-home-action-panels`, `quiet-walkthrough`, `trip-budget-issues` and `trajectory-tab` expected
  Chinese wording from before PR #856; their selectors now match `apps/web/lib/i18n/messages/zh-*.ts`.

## Why

These scripts fail on `main` before their Chinese steps (no Maps key, removed Conversation tab), so
the old wording was not caught when #856 was verified.

## Validation

Prettier, `verify:e2e-selectors`, `verify:e2e-artifacts` and `node --check` on the changed scripts.
A scan of every Chinese literal in `apps/web/tests/e2e` against the catalogs found no other stale
positive assertion.

## Notes for the next person

The Chinese steps of these four scripts still cannot run until their earlier failures are fixed.
