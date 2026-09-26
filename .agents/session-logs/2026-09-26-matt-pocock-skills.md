---
date: 2026-09-26
author: Codex
branch: main
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Adapt two engineering skills for AI_TRIP_PLANNER

## What changed

- Added `grill-with-docs` and `diagnosing-bugs` under `.agents/skills/`.
- Listed both in English and Chinese development docs; recorded source and MIT licence.
- Added the implemented process note and refreshed the development-doc translation hashes.

## Why

Adapted focused workflows from Matt Pocock's skills repository while preserving this project's docs, Agent Notes, and E2E-first rules.

## Validation

- `pnpm verify:docs` — passed; reports valid Agent Notes, skills, and Markdown links.
- `pnpm verify:protected` — passed relative to `origin/main`.
- `pnpm exec prettier --check ...` — passed for all changed Markdown files.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs` — passed; 11 pairs checked.
- `git diff --check` — passed.

`pnpm` printed its existing warning that `pnpm.overrides` in `package.json` is ignored by this pnpm version.

## Notes for the next person

No application code or tests changed. Skills are project-local and available through the existing `.claude/skills` symlink.
