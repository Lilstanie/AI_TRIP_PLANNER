---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-288-phone-fact-chip-divider
pr: none
area: apps/web
contract-impact: none
---

# Phone fact chips lose the stray desktop divider

## What changed

- `apps/web/app/styles/phone/polish.css`: on a phone the fact chips are separate pills, so the
  desktop divider (`.fact-chip + .fact-chip::before` in `workspace/trip-facts.css`) is hidden there.

## Why

UI loop round 1 (2026-11-02): screenshots of the deployed site at 390 px showed a thin grey bar on
the left edge of every chip after the first, in zh and en.

## Validation

- Local dev server, Playwright screenshots at 390 px (zh-CN, en-US): no bar; 1440 px desktop keeps
  its dividers inside the single pill.
- No machine check: the repo has no CSS linter, and wiring one into CI needs protected root files.

## Notes for the next person

- Other desktop pseudo-elements may leak into phone restyles of the same components.
