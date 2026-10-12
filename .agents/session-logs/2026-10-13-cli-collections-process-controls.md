---
date: 2026-10-13
author: Codex
branch: refactor/cli-collections-acceptance
pr: none
area: testing, docs
contract-impact: none
---

# Reduce repeated browser setup in collections acceptance

## What changed

- Kept real production smoke and development replay in `local-cli-collections.e2e.mjs`.
- Moved seven orchestration commands to isolated subprocess fixtures with unchanged copied CLI modules.
- Retained selection/report assertions; added observed child events and a child-failure control.
- Synchronized local CLI EN/ZH, E2E-maintenance guidance and the owning testing decision.

## Why

Repeated browser assertions dominated collection-selection evidence. Fixtures test process contracts,
not UI coverage. Production CLI, browser journeys and CI configuration are unchanged.

## Validation

- Failure inventory preceded implementation; baseline source at `ac7e294` passed in 248.66 seconds.
- Same local command after optimization passed in 96.43 seconds: two real controls, seven fixture commands.
- Saved command outcomes and exact copies of all six CLI modules verified; raw assertion count unavailable.
- Four temporary-copy mutations (selection, timeout, child failure, missing second child) all failed assertions.
- Docs, 26 translation pairs, protection and scoped added-comment checks passed; zero added comments.
- `git diff --check` passed; final changed-file formatting is checked after the scoped commit.

## Notes for the next person

This is one local before/after observation, not a whole-CI speedup claim. No push or merge performed.
Evidence is retained in `output/e2e/cli-collections/run-U8S9Vq/` and external `cli-collections-evidence/`.
Original main's unrelated dirty and untracked files remain untouched. Remote CI is not re-run here.
