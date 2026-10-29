---
date: 2026-10-29
author: Codex
branch: feature/TP-152-trip-home-send
pr: none
area: apps/web, docs, .agents
contract-impact: none
---

# Trip home first send (TP-152 / #792)

## What changed

- Replaced Start chat with one nonempty Trip-home Send that creates a linked Chat and starts one request from the explicit Trip snapshot.
- Added sticky home composer, message-derived Chat titles, embedded Retry, trip-scoped `writingTripIds`, and busy composer `readOnly` so focus can transfer during generation.
- Added `trip-home-send` production E2E plus failure inventory; updated related Trip-home journeys and docs/Agent Note.

## Why

Sending through the previous render's transport could target the wrong Plan. Empty Start chat created unused Chats and same-day titles collided.

## Validation

- `pnpm --filter @trip/web e2e run trip-home-send` → pass (103/103); final evidence `output/e2e/local-test-cli/2026-10-29T12-39-22-953Z-20132-cx5khy/`
- Earlier red retained under `.../2026-10-29T12-24-56-226Z-97499-vvikb8/` and `.../2026-10-29T12-34-03-442Z-11574-cddl8r/`
- `pnpm verify:e2e-selectors|docs|pairs|protected`, UI copy check, web `tsc`, lint, scoped comment check → pass
- review-trip-planner Standards+Spec and Ponytail full on the working-tree slice vs `95c80303`

## Notes for the next person

Fixture browser evidence only. Do not push/merge this branch until asked. Continue PR #782 later from this commit.
