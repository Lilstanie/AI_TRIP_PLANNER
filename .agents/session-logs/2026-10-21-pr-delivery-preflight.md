---
date: 2026-10-21
author: Codex
branch: fix/pr-delivery-status-preflight
pr: none
area: scripts, docs, skills
contract-impact: none
---

# Add a read-only PR delivery preflight

## What changed

- Added `scripts/pr-delivery-status.mjs` to check the exact clean local PR head, open/main PR state, passing head checks and required body evidence.
- Added a fixture-driven CLI self-check and a failure inventory; fixture results explicitly do not claim GitHub CI evidence.
- Documented the command in English and Chinese developer guides and the `review-trip-planner` skill.

## Why

Repeated delivery review needed one command to catch stale heads, incomplete CI and missing PR evidence without mutating GitHub or branches.

## Validation

- Pre-implementation `node --test scripts/pr-delivery-status.test.mjs`: expected red because the checker did not yet exist.
- `pnpm install --frozen-lockfile`: passed; lockfile unchanged.
- `pnpm test:scripts`: 58 passed, 0 failed (including 17 fixture scenarios).
- `pnpm verify:docs`: passed.
- `pnpm verify:pairs`: 27 pairs checked.
- `pnpm verify:protected`: passed.
- `pnpm exec prettier --check ...` on changed source, test, inventory, docs and skill: passed.

## Notes for the next person

The self-check uses a fake `gh` executable and temporary Git repositories; it proves local checker behavior only. No GitHub preflight has been claimed for this new command.
