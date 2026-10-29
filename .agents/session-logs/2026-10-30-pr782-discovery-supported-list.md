---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web
contract-impact: none
---

# Align discovery supported list with LOCAL_JOURNEYS

## What changed

- Extended `discovery.e2e.mjs` supported inventory with `chat-generation` and `trip-home-send`.
- Pushed tip `99eb6532` onto PR #782 after the phone scroll and CI-contract tip.

## Why

CLI acceptance shard 2 failed because `e2e list` already exposed the new journeys while discovery still expected only three supported names.

## Validation

- `node apps/web/tests/cli-e2e/discovery.e2e.mjs`: passed.
- `node apps/web/tests/cli-e2e/local-cli-collections.e2e.mjs`: passed.

## Notes for the next person

- Waiting on #791 and #795 exact-HEAD reviews before Calendar (#796).
- Remote CI for tip `99eb6532` was still running when this log was written.
