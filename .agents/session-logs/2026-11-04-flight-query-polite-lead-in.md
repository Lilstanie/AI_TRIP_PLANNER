---
date: 2026-11-04
author: Claude Code
branch: fix/flight-query-long-lead-in
pr: 963 (TP-370)
area: packages/orchestrator
contract-impact: none
---

# A polite 你 or 您 no longer becomes part of a Chinese flight origin

## What changed

- `packages/orchestrator/src/chat/flight-query.ts`: `LEADING_CN` strips 你 and 您.
- `packages/orchestrator/tests/flight-query.test.ts`: three Chinese lead-ins with 你 or 您 and no 从.
- `packages/orchestrator/tests/flight-query-lead-in.failures.md`: the case added to the inventory.

## Why

PR 963 first fixed the whole lead-in bug; PR 961 merged the same fix first. Run against main, the
only case 961 left was "麻烦你帮我看一下洛杉矶到东京", which searched flights from "你帮我看一下洛杉矶".
963 was cut down to that case.

## Validation

- New test on main before the fix: 1 failed (`from` was "你帮我看一下洛杉矶"); after it 16 passed.
- Repository checks: see the pull request Evidence section.

## Notes for the next person

- Other unknown Chinese lead words without 从 still stay in the origin, as the inventory says.
