---
date: 2026-10-30
author: Claude Code
branch: feature/TP-184-quiet-estimate-notice
pr: none
area: apps/web, docs
contract-impact: none
---

# Estimate notice only reports a real change

## What changed

- `lib/workspace/session.ts`: a planned turn sets `estimateChange` only when the estimated total
  moved by at least half a cent.
- `components/workspace/WorkspaceView.tsx`, `lib/i18n/workspace-messages.ts`: the
  "Estimate unchanged from the previous plan." branch and its translation are removed.
- `tests/e2e/offline-follow-up.e2e.mjs`, `estimate-notice.failures.md`, `docs/workspace-ui*.md`.

## Why

A question that changed nothing put a green notice with a Dismiss button above the chat. The reply
already states the total, so the notice should speak only when the total moves.

## Validation

- `offline-follow-up.e2e.mjs` against dev (mock data): before 10/12 (notice shown after a no-change
  turn in English and Chinese), after 12/12; a replan to four travellers still shows
  "Estimate changed by −AUD 53.30".
- Web `typecheck`, `lint`, workspace vitest (103 passed), `check-ui-copy`, `verify:docs`,
  translation pairs, `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- In mock data, going from two to four travellers lowers the total by AUD 53.30; left for a separate
  check of the mock pricing.
