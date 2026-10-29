---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web
contract-impact: none
---

# Align chat-owned generation unit contracts and CLI fixture journeys

## What changed

- Updated `session.test.ts` for `status: "stopped"` and opened blank `estimateChange`/`status`.
- Reworked Workspace New-chat / history unit cases to keep owned generation alive.
- Extended `local-cli-collections.e2e.mjs` stubs for `chat-generation` and `trip-home-send`.
- Integrated TP-152 phone follow-up `ab8d8d82` as tip `9884b30a`.

## Why

PR #782 CI failed after chat-owned generation landed: old unit tests still expected abort-on-navigation, and the CLI fixture still packaged only three journeys.

## Validation

- `vitest` focused ownership/session cases: 4 passed.
- `node apps/web/tests/cli-e2e/local-cli-collections.e2e.mjs`: passed.
- `trip-home-send` exact tip rerun started after integration.

## Notes for the next person

- Phone clipping fix evidence lives under TP-152 worktree `12-59-57` / reviews `/tmp/tp152-reviews/ab8d8d8`.
- Still waiting on #791 and #795 before Calendar (#796).
