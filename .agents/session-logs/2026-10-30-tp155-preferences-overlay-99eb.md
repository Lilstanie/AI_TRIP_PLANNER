---
date: 2026-10-30
author: Codex
branch: feature/TP-155-trip-action-panels
pr: 782
area: apps/web, docs
contract-impact: none
---

# TP-155 preference overlay after tip 99eb6532

## What changed

- Rebased `feature/TP-155-trip-action-panels` onto integration tip `99eb6532`.
- Trip preferences now overlay only locally changed fields onto the latest draft before Save/Replan.
- Extended `trip-home-action-panels` E2E and failure inventory for dirty preferences after an outside Budget save.

## Why

A dirty preferences draft previously retained the whole older Draft, so a later Budget chip save could be overwritten when preferences saved.

## Validation

- Exact-HEAD synthetic Maps-key production E2E pending on this commit.

## Notes for the next person

Calendar redesign remains `#796`. Fixture browser only.
